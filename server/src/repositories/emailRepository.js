export async function findActiveEmailsByUserId(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT recipient_id AS recipientId, email, is_active AS isActive, created_at AS createdAt
     FROM email_recipient
     WHERE user_id = ? AND is_active = 1
     ORDER BY recipient_id DESC`,
    [userId]
  );
  return rows || [];
}

export async function replaceUserEmails(connection, { userId, emails, isActive }) {
  await connection.execute(
    'UPDATE email_recipient SET is_active = 0 WHERE user_id = ?',
    [userId]
  );

  for (const email of emails) {
    await connection.execute(
      `INSERT INTO email_recipient (user_id, email, is_active)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
      [userId, email, isActive ? 1 : 0]
    );
  }

  const placeholders = emails.map(() => '?').join(',');
  const [rows] = await connection.execute(
    `SELECT recipient_id AS recipientId, email, is_active AS isActive, created_at AS createdAt
     FROM email_recipient
     WHERE user_id = ? AND email IN (${placeholders})
     ORDER BY recipient_id DESC`,
    [userId, ...emails]
  );

  return rows || [];
}
