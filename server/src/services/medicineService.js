import { AppError, errorCodes } from '../utils/errors.js';
import { parseMedicineEventPayload, todaySlotsQuerySchema } from '../utils/validators.js';
import { getShanghaiDateString, getTodayDateStringByTimezone } from '../utils/time.js';
import { pool, withTransaction } from '../db/pool.js';
import { createUser, findUserByOpenId, updateUserProfileByOpenId } from '../repositories/userRepository.js';
import {
  createDoseClick,
  createDoseNotification,
  createDoseSlot,
  createDoseStageClickEvent,
  findDoseTypeByCode,
  getDoseTypeClickCounts,
  listTodayDoseSlots
} from '../repositories/doseRepository.js';
import { sendDoseClickedEmail } from './emailService.js';
import { sendPushplusMessage } from './pushplusService.js';

async function findOrCreateUserByOpenid(connection, openid) {
  const existing = await findUserByOpenId(connection, openid);
  if (existing) {
    return existing;
  }
  return createUser(connection, openid);
}

function resolveDoseTypeCode(inputCode, clickedAtIso) {
  if (inputCode) {
    return inputCode;
  }

  const date = new Date(clickedAtIso);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  const hour = Number(formatter.format(date));

  if (hour < 11) return 'AM';
  if (hour < 15) return 'MID';
  return 'NIGHT';
}

function getPlannedAtUtcForDate(doseDateLocal, doseTypeCode, clickIndex = 1) {
  const baseMapping = {
    AM: '01:00:00.000Z',
    MID: '04:00:00.000Z',
    NIGHT: '10:00:00.000Z'
  };

  const time = baseMapping[doseTypeCode] || baseMapping.AM;
  const plannedAt = new Date(`${doseDateLocal}T${time}`);

  const offsetMinutesMap = {
    AM: 20,
    MID: 30,
    NIGHT: 20
  };

  const offsetMinutes = Number(offsetMinutesMap[doseTypeCode] || 20);
  if (clickIndex > 1) {
    plannedAt.setUTCMinutes(plannedAt.getUTCMinutes() + (clickIndex - 1) * offsetMinutes);
  }

  return plannedAt;
}

function formatBeijingTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(/\//g, '-');
}

function formatBeijingIso(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+08:00`;
}


export async function createMedicineEvent(openid, payload, traceId) {
  let input;
  try {
    input = parseMedicineEventPayload(payload);
  } catch (error) {
    throw new AppError({ ...errorCodes.validation, details: error?.issues || error?.message || null });
  }

  const eventResult = await withTransaction(async (connection) => {
    const user = await findOrCreateUserByOpenid(connection, openid);

    if (input.nickname || input.avatarUrl) {
      await updateUserProfileByOpenId(connection, {
        openid,
        nickname: input.nickname,
        avatarUrl: input.avatarUrl
      });
    }

    const doseTypeCode = resolveDoseTypeCode(input.doseTypeCode, input.clickedAt);
    const doseType = await findDoseTypeByCode(connection, doseTypeCode);
    if (!doseType) {
      throw new AppError({ ...errorCodes.validation, message: 'doseTypeCode 无效' });
    }

    const doseLabelMap = { AM: '早上', MID: '中午', NIGHT: '晚上' };

    const clickedAt = new Date(input.clickedAt);
    const doseDateLocal = getShanghaiDateString(clickedAt);

    const clickCountRows = await getDoseTypeClickCounts(connection, user.userId, doseDateLocal);
    const countMap = clickCountRows.reduce((acc, row) => {
      acc[row.doseTypeCode] = Number(row.clickCount || 0);
      return acc;
    }, {});

    const currentClickIndex = Number(countMap[doseTypeCode] || 0) + 1;
    const doseLabel = `${doseLabelMap[doseTypeCode] || doseType.displayName || '本次'}第${currentClickIndex}次`;
    const plannedAtUtc = getPlannedAtUtcForDate(doseDateLocal, doseTypeCode, currentClickIndex);

    const doseSlotId = await createDoseSlot(connection, {
      userId: user.userId,
      doseDateLocal,
      doseTypeId: doseType.doseTypeId,
      plannedAtUtc
    });

    await createDoseStageClickEvent(connection, {
      userId: user.userId,
      doseDateLocal,
      doseTypeCode,
      clickedAtUtc: clickedAt
    });

    const clickResult = await createDoseClick(connection, {
      doseSlotId,
      clickedAtUtc: clickedAt,
      clientRequestId: input.clientRequestId
    });

    const subject = `【吃药了吗】${doseLabel}已确认吃药`;
    const notificationId = await createDoseNotification(connection, {
      doseSlotId,
      subject,
      bodyTemplateCode: 'DOSE_CLICKED_V1'
    });

    return {
      eventId: clickResult.eventId,
      notificationId: String(notificationId),
      status: clickResult.created ? 'RECORDED' : 'DEDUPED',
      doseLabel,
      subject,
      clickedAt,
      clickIndex: currentClickIndex,
      stageProgress: {
        AM: Number(countMap.AM || 0) + (doseTypeCode === 'AM' ? 1 : 0),
        MID: Number(countMap.MID || 0) + (doseTypeCode === 'MID' ? 1 : 0),
        NIGHT: Number(countMap.NIGHT || 0) + (doseTypeCode === 'NIGHT' ? 1 : 0)
      }
    };
  });

  const beijingTime = formatBeijingTime(eventResult.clickedAt);
  const displayName = input.nickname || '微信用户';
  const mailHtml = `
      <div style="margin:0;padding:24px;background:#f4fbf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18312b;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbefe4;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(20,84,61,0.08);">
          <div style="padding:20px 24px;background:linear-gradient(90deg,#20c997 0%,#2dd36f 100%);color:#ffffff;">
            <div style="font-size:22px;font-weight:700;">吃药了吗 · 温馨提醒</div>
            <div style="margin-top:6px;font-size:13px;opacity:0.92;">用药打卡已成功记录</div>
          </div>
          <div style="padding:22px 24px;line-height:1.75;">
            <p style="margin:0 0 12px;font-size:16px;">您好，${displayName}，已记录本次 <strong style="color:#16a34a;">${eventResult.doseLabel}</strong> 时段吃药。</p>
            <table style="width:100%;border-collapse:collapse;background:#f8fcfa;border-radius:10rpx;overflow:hidden;">
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;width:120px;">用户昵称</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${input.nickname || '未授权'}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">打卡时间</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${beijingTime}（北京时间）</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">通知邮箱</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${input.emails.join('，')}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;color:#5a7269;">来源</td>
                <td style="padding:10px 12px;color:#1f3a33;">${input.source}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:13px;color:#6b7f77;">请继续保持规律打卡，祝你健康每一天。</p>
          </div>
          <div style="padding:12px 24px;background:#f7faf8;color:#74867f;font-size:12px;">TakeYourMedicine · 自动通知邮件</div>
        </div>
      </div>
    `;

  const notifySummary = {
    mail: 'SENT',
    pushplus: 'SENT'
  };

  try {
    await sendDoseClickedEmail({
      to: input.emails.join(','),
      subject: eventResult.subject,
      html: mailHtml
    });
  } catch (error) {
    notifySummary.mail = 'FAILED';
    console.error('[MAIL_SEND_FAILED]', traceId, error?.message || error);
  }

  const pushContent = `
    <div style="margin:0;padding:24px;background:#f4fbf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18312b;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbefe4;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(20,84,61,0.08);">
        <div style="padding:20px 24px;background:linear-gradient(90deg,#20c997 0%,#2dd36f 100%);color:#ffffff;">
          <div style="font-size:22px;font-weight:700;">吃药了吗 · 温馨提醒</div>
          <div style="margin-top:6px;font-size:13px;opacity:0.92;">用药打卡已成功记录</div>
        </div>
        <div style="padding:22px 24px;line-height:1.75;">
          <p style="margin:0 0 12px;font-size:16px;">您好，${displayName}，已记录本次 <strong style="color:#16a34a;">${eventResult.doseLabel}</strong> 时段吃药。</p>
          <table style="width:100%;border-collapse:collapse;background:#f8fcfa;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;width:120px;">用户昵称</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${input.nickname || '未授权'}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">打卡时间</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${beijingTime}（北京时间）</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">通知邮箱</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${input.emails.join('，')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;color:#5a7269;">来源</td>
              <td style="padding:10px 12px;color:#1f3a33;">${input.source}</td>
            </tr>
          </table>
        </div>
        <div style="padding:12px 24px;background:#f7faf8;color:#74867f;font-size:12px;">TakeYourMedicine · 自动通知</div>
      </div>
    </div>
  `;
  try {
    await sendPushplusMessage({
      title: eventResult.subject,
      content: pushContent,
      template: 'html'
    });
  } catch (error) {
    notifySummary.pushplus = 'FAILED';
    console.error('[PUSHPLUS_SEND_FAILED]', traceId, error?.message || error);
  }

  const acceptedAtDate = new Date();

  return {
    eventId: eventResult.eventId,
    notificationId: eventResult.notificationId,
    status: eventResult.status,
    acceptedAt: formatBeijingTime(acceptedAtDate),
    acceptedAtUtc: acceptedAtDate.toISOString(),
    traceId,
    notifySummary,
    stageProgress: eventResult.stageProgress
  };
}

export async function getTodayDoseSlots(openid, query) {
  const parsed = todaySlotsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError({ ...errorCodes.validation, details: parsed.error.flatten() });
  }

  const { timezone } = parsed.data;
  const date = getTodayDateStringByTimezone(timezone);

  const connection = await pool.getConnection();
  try {
    const user = await findOrCreateUserByOpenid(connection, openid);
    const rows = await listTodayDoseSlots(connection, user.userId, date);

    return {
      date,
      serverNowLocal: formatBeijingIso(new Date()),
      slots: rows.map((row) => ({
        doseTypeCode: row.doseTypeCode,
        displayName: row.displayName,
        plannedAt: row.plannedAt ? formatBeijingIso(new Date(row.plannedAt)) : null,
        status: row.status,
        clickCount: Number(row.clickCount || 0)
      }))
    };
  } finally {
    connection.release();
  }
}
