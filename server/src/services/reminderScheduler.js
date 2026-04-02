import { pool } from '../db/pool.js';
import { sendDoseClickedEmail } from './emailService.js';
import { sendPushplusMessage } from './pushplusService.js';

const CHECKPOINTS = [
  { hour: 10, minClicks: 1, label: '早上' },
  { hour: 14, minClicks: 2, label: '中午' },
  { hour: 21, minClicks: 3, label: '晚上' }
];

const DAILY_SUMMARY_HOUR = 22;
const DAILY_SUMMARY_MARK_HOUR = 110;

let timer = null;
let lastCheckpointTickKey = '';
let lastSummaryTickKey = '';

function getShanghaiNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second'))
  };
}

function shanghaiDateString({ year, month, day }) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function toUtcIso(dateLocal, hour) {
  const local = new Date(`${dateLocal}T${String(hour).padStart(2, '0')}:00:00+08:00`);
  return local.toISOString().slice(0, 19).replace('T', ' ');
}

async function markCheckpointTriggered(connection, userId, dateLocal, checkpointHour) {
  await connection.execute(
    `INSERT INTO dose_checkpoint_reminder (user_id, dose_date_local, checkpoint_hour)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE checkpoint_hour = checkpoint_hour`,
    [userId, dateLocal, checkpointHour]
  );

  const [rows] = await connection.execute(
    `SELECT reminder_id AS reminderId
     FROM dose_checkpoint_reminder
     WHERE user_id = ? AND dose_date_local = ? AND checkpoint_hour = ?
     LIMIT 1`,
    [userId, dateLocal, checkpointHour]
  );

  return rows[0]?.reminderId || null;
}

async function hasReminderBeenTriggered(connection, userId, dateLocal, checkpointHour) {
  const [rows] = await connection.execute(
    `SELECT reminder_id AS reminderId
     FROM dose_checkpoint_reminder
     WHERE user_id = ? AND dose_date_local = ? AND checkpoint_hour = ?
     LIMIT 1`,
    [userId, dateLocal, checkpointHour]
  );
  return rows.length > 0;
}

async function listUsersWithActiveEmails(connection) {
  const [rows] = await connection.execute(
    `SELECT
      u.user_id AS userId,
      u.openid AS openid,
      er.email AS email
     FROM app_user u
     JOIN email_recipient er ON er.user_id = u.user_id AND er.is_active = 1
     ORDER BY u.user_id ASC`
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, { userId: row.userId, openid: row.openid, emails: [] });
    }
    map.get(row.userId).emails.push(row.email);
  }
  return Array.from(map.values());
}

async function getClicksCount(connection, userId, dateLocal, checkpointHour) {
  const cutoffUtc = toUtcIso(dateLocal, checkpointHour);
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS cnt
     FROM dose_click dc
     JOIN dose_slot ds ON ds.dose_slot_id = dc.dose_slot_id
     WHERE ds.user_id = ?
       AND ds.dose_date_local = ?
       AND dc.clicked_at_utc <= ?`,
    [userId, dateLocal, cutoffUtc]
  );
  return Number(rows[0]?.cnt || 0);
}

async function listTodayClicks(connection, userId, dateLocal) {
  const [rows] = await connection.execute(
    `SELECT
      dt.display_name AS displayName,
      dt.code AS doseTypeCode,
      dc.clicked_at_utc AS clickedAtUtc
     FROM dose_click dc
     JOIN dose_slot ds ON ds.dose_slot_id = dc.dose_slot_id
     JOIN dose_type dt ON dt.dose_type_id = ds.dose_type_id
     WHERE ds.user_id = ?
       AND ds.dose_date_local = ?
     ORDER BY dc.clicked_at_utc ASC`,
    [userId, dateLocal]
  );
  return rows;
}

function toBeijingTimeText(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

function buildDailySummaryHtml(dateLocal, user, clicks) {
  const total = clicks.length;
  const amCount = clicks.filter((item) => item.doseTypeCode === 'AM').length;
  const midCount = clicks.filter((item) => item.doseTypeCode === 'MID').length;
  const nightCount = clicks.filter((item) => item.doseTypeCode === 'NIGHT').length;

  const rowsHtml = clicks.length === 0
    ? `<tr><td colspan="3" style="padding:10px 12px;color:#6a7f76;">今天暂无吃药打卡记录</td></tr>`
    : clicks
      .map((item, idx) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">第${idx + 1}次</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${item.displayName || item.doseTypeCode}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${toBeijingTimeText(item.clickedAtUtc)}（北京时间）</td>
        </tr>
      `)
      .join('');

  return `
    <div style="margin:0;padding:24px;background:#f4fbf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18312b;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbefe4;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(20,84,61,0.08);">
        <div style="padding:20px 24px;background:linear-gradient(90deg,#20c997 0%,#2dd36f 100%);color:#ffffff;">
          <div style="font-size:22px;font-weight:700;">吃药了吗 · 每日汇总</div>
          <div style="margin-top:6px;font-size:13px;opacity:0.92;">${dateLocal} 关注账号吃药情况</div>
        </div>
        <div style="padding:22px 24px;line-height:1.75;">
          <p style="margin:0 0 12px;font-size:16px;">您好，以下是今日关注账号（${user.openid}）的吃药汇总。</p>
          <table style="width:100%;border-collapse:collapse;background:#f8fcfa;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;width:140px;">总点击次数</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">${total}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">分时段汇总</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#1f3a33;">早上 ${amCount} 次，中午 ${midCount} 次，晚上 ${nightCount} 次</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;color:#5a7269;">通知邮箱</td>
              <td style="padding:10px 12px;color:#1f3a33;">${user.emails.join('，')}</td>
            </tr>
          </table>

          <div style="margin-top:14px;font-size:14px;font-weight:700;color:#215042;">每次点击明细</div>
          <table style="margin-top:8px;width:100%;border-collapse:collapse;background:#f8fcfa;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;width:90px;">序号</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;width:140px;">时段</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e4f2ea;color:#5a7269;">点击时间</td>
            </tr>
            ${rowsHtml}
          </table>
        </div>
        <div style="padding:12px 24px;background:#f7faf8;color:#74867f;font-size:12px;">TakeYourMedicine · 每日自动汇总</div>
      </div>
    </div>
  `;
}

async function processDailySummary() {
  const now = getShanghaiNow();
  const dateLocal = shanghaiDateString(now);

  const connection = await pool.getConnection();
  try {
    const users = await listUsersWithActiveEmails(connection);

    for (const user of users) {
      const triggered = await hasReminderBeenTriggered(connection, user.userId, dateLocal, DAILY_SUMMARY_MARK_HOUR);
      if (triggered) continue;

      const clicks = await listTodayClicks(connection, user.userId, dateLocal);
      const subject = `【每日汇总】${dateLocal} 吃药情况`;
      const htmlBody = buildDailySummaryHtml(dateLocal, user, clicks);

      try {
        await sendDoseClickedEmail({
          to: user.emails.join(','),
          subject,
          html: htmlBody
        });
      } catch (error) {
        console.error('[DAILY_SUMMARY_MAIL_FAILED]', user.openid, error?.message || error);
      }

      try {
        await sendPushplusMessage({
          title: subject,
          content: htmlBody,
          template: 'html'
        });
      } catch (error) {
        console.error('[DAILY_SUMMARY_PUSH_FAILED]', user.openid, error?.message || error);
      }

      await markCheckpointTriggered(connection, user.userId, dateLocal, DAILY_SUMMARY_MARK_HOUR);
    }
  } finally {
    connection.release();
  }
}

async function processCheckpoint(checkpoint) {
  const now = getShanghaiNow();
  const dateLocal = shanghaiDateString(now);

  const connection = await pool.getConnection();
  try {
    const users = await listUsersWithActiveEmails(connection);

    for (const user of users) {
      const triggered = await hasReminderBeenTriggered(connection, user.userId, dateLocal, checkpoint.hour);
      if (triggered) {
        continue;
      }

      const count = await getClicksCount(connection, user.userId, dateLocal, checkpoint.hour);
      if (count >= checkpoint.minClicks) {
        await markCheckpointTriggered(connection, user.userId, dateLocal, checkpoint.hour);
        continue;
      }

      const subject = `【注意】今天对应（${checkpoint.label}）时段还未吃药`;
      const htmlBody = `
        <div style="margin:0;padding:24px;background:#fff7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#3b1f1f;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #f3d8d8;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(125,34,34,0.08);">
            <div style="padding:20px 24px;background:linear-gradient(90deg,#ef4444 0%,#f97316 100%);color:#ffffff;">
              <div style="font-size:22px;font-weight:700;">吃药了吗 · 未按时提醒</div>
              <div style="margin-top:6px;font-size:13px;opacity:0.92;">请及时联系并督促吃药</div>
            </div>
            <div style="padding:22px 24px;line-height:1.75;">
              <p style="margin:0 0 12px;font-size:16px;">今天对应 <strong style="color:#dc2626;">${checkpoint.label}</strong> 时段还未吃药，请及时联系并督促吃药。</p>
              <table style="width:100%;border-collapse:collapse;background:#fff8f8;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 12px;border-bottom:1px solid #f6e0e0;color:#8b4a4a;width:120px;">检查时间点</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #f6e0e0;color:#5f2a2a;">${checkpoint.hour}:00（北京时间）</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;color:#8b4a4a;">通知邮箱</td>
                  <td style="padding:10px 12px;color:#5f2a2a;">${user.emails.join('，')}</td>
                </tr>
              </table>
            </div>
            <div style="padding:12px 24px;background:#fff5f5;color:#9f6b6b;font-size:12px;">TakeYourMedicine · 自动提醒</div>
          </div>
        </div>
      `;

      try {
        await sendDoseClickedEmail({
          to: user.emails.join(','),
          subject,
          html: htmlBody
        });
      } catch (error) {
        console.error('[CHECKPOINT_MAIL_FAILED]', user.openid, error?.message || error);
      }

      try {
        await sendPushplusMessage({
          title: subject,
          content: htmlBody,
          template: 'html'
        });
      } catch (error) {
        console.error('[CHECKPOINT_PUSH_FAILED]', user.openid, error?.message || error);
      }

      await markCheckpointTriggered(connection, user.userId, dateLocal, checkpoint.hour);
    }
  } finally {
    connection.release();
  }
}

async function tick() {
  const now = getShanghaiNow();
  if (now.minute !== 0) {
    return;
  }

  const key = `${now.year}-${now.month}-${now.day}-${now.hour}`;

  if (now.hour === DAILY_SUMMARY_HOUR && key !== lastSummaryTickKey) {
    lastSummaryTickKey = key;
    await processDailySummary();
  }

  const checkpoint = CHECKPOINTS.find((item) => item.hour === now.hour);
  if (!checkpoint) {
    return;
  }

  if (key === lastCheckpointTickKey) {
    return;
  }

  lastCheckpointTickKey = key;
  await processCheckpoint(checkpoint);
}

export function startReminderScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((error) => {
      console.error('[REMINDER_SCHEDULER_TICK_ERROR]', error);
    });
  }, 15000);
}
