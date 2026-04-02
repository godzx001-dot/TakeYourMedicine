import { pool, withTransaction } from '../db/pool.js';
import { AppError, errorCodes } from '../utils/errors.js';
import { parseNotificationEmailPayload } from '../utils/validators.js';
import { createUser, findUserByOpenId } from '../repositories/userRepository.js';
import { findActiveEmailsByUserId, replaceUserEmails } from '../repositories/emailRepository.js';

async function findOrCreateUserByOpenid(connection, openid) {
  const existing = await findUserByOpenId(connection, openid);
  if (existing) {
    return existing;
  }
  return createUser(connection, openid);
}

export async function getMyNotificationEmail(openid) {
  const connection = await pool.getConnection();
  try {
    const user = await findOrCreateUserByOpenid(connection, openid);
    const emailRows = await findActiveEmailsByUserId(connection, user.userId);
    const emails = emailRows.map((row) => row.email);

    return {
      email: emails[0] || '',
      emails,
      isActive: emails.length > 0,
      updatedAt: emailRows[0]?.createdAt || null
    };
  } finally {
    connection.release();
  }
}

export async function updateMyNotificationEmail(openid, payload) {
  let input;
  try {
    input = parseNotificationEmailPayload(payload);
  } catch (error) {
    throw new AppError({ ...errorCodes.validation, details: error?.issues || error?.message || null });
  }

  return withTransaction(async (connection) => {
    const user = await findOrCreateUserByOpenid(connection, openid);

    const rows = await replaceUserEmails(connection, {
      userId: user.userId,
      emails: input.emails,
      isActive: input.isActive
    });

    if (!rows || rows.length === 0) {
      throw new AppError({ message: '保存通知邮箱失败', status: 500, code: 50001 });
    }

    const emails = rows.map((row) => row.email);

    return {
      email: emails[0],
      emails,
      isActive: true,
      updatedAt: rows[0].createdAt
    };
  });
}
