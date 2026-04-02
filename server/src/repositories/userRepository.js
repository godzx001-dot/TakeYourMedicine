export async function findUserByOpenId(connection, openid) {
  const [rows] = await connection.execute(
    `SELECT user_id AS userId, openid, nickname, avatar_url AS avatarUrl
     FROM app_user
     WHERE openid = ?
     LIMIT 1`,
    [openid]
  );
  return rows[0] || null;
}

export async function createUser(connection, openid) {
  const [result] = await connection.execute(
    `INSERT INTO app_user (openid)
     VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = LAST_INSERT_ID(user_id)`,
    [openid]
  );
  return { userId: result.insertId, openid };
}

export async function updateUserProfileByOpenId(connection, { openid, nickname, avatarUrl }) {
  await connection.execute(
    `UPDATE app_user
     SET nickname = COALESCE(?, nickname),
         avatar_url = COALESCE(?, avatar_url)
     WHERE openid = ?`,
    [nickname || null, avatarUrl || null, openid]
  );
}
