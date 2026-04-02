export async function findDoseTypeByCode(connection, code) {
  const [rows] = await connection.execute(
    `SELECT dose_type_id AS doseTypeId, code, display_name AS displayName, scheduled_time AS scheduledTime
     FROM dose_type
     WHERE code = ?
     LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

export async function createDoseSlot(connection, payload) {
  const { userId, doseDateLocal, doseTypeId, plannedAtUtc } = payload;
  const [result] = await connection.execute(
    `INSERT INTO dose_slot (user_id, dose_date_local, dose_type_id, planned_at_utc)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE planned_at_utc = planned_at_utc`,
    [userId, doseDateLocal, doseTypeId, plannedAtUtc]
  );

  if (result.insertId) {
    return result.insertId;
  }

  const [rows] = await connection.execute(
    `SELECT dose_slot_id AS doseSlotId
     FROM dose_slot
     WHERE user_id = ? AND dose_date_local = ? AND dose_type_id = ?
     LIMIT 1`,
    [userId, doseDateLocal, doseTypeId]
  );

  return rows[0]?.doseSlotId;
}

export async function createDoseClick(connection, payload) {
  const { doseSlotId, clickedAtUtc, clientRequestId } = payload;

  const [existing] = await connection.execute(
    'SELECT dose_slot_id AS doseSlotId FROM dose_click WHERE dose_slot_id = ? LIMIT 1',
    [doseSlotId]
  );

  if (existing.length > 0) {
    return { created: false, eventId: `evt_slot_${doseSlotId}` };
  }

  await connection.execute(
    `INSERT INTO dose_click (dose_slot_id, clicked_at_utc, client_request_id)
     VALUES (?, ?, ?)`,
    [doseSlotId, clickedAtUtc, clientRequestId || null]
  );

  return { created: true, eventId: `evt_slot_${doseSlotId}` };
}

export async function createDoseNotification(connection, payload) {
  const { doseSlotId, subject, bodyTemplateCode } = payload;

  const [existing] = await connection.execute(
    `SELECT notification_id AS notificationId
     FROM dose_email_notification
     WHERE dose_slot_id = ?
     LIMIT 1`,
    [doseSlotId]
  );

  if (existing.length > 0) {
    return existing[0].notificationId;
  }

  const [result] = await connection.execute(
    `INSERT INTO dose_email_notification
      (dose_slot_id, dose_email_kind, dose_click_id, subject, body_template_code)
     VALUES (?, 'DOSE_CLICKED', ?, ?, ?)`,
    [doseSlotId, doseSlotId, subject, bodyTemplateCode]
  );

  return result.insertId;
}

export async function createDoseStageClickEvent(connection, payload) {
  const { userId, doseDateLocal, doseTypeCode, clickedAtUtc } = payload;
  await connection.execute(
    `INSERT INTO dose_stage_click_event (user_id, dose_date_local, dose_type_code, clicked_at_utc)
     VALUES (?, ?, ?, ?)`,
    [userId, doseDateLocal, doseTypeCode, clickedAtUtc]
  );
}

export async function getDoseTypeClickCounts(connection, userId, doseDateLocal) {
  const [rows] = await connection.execute(
    `SELECT dose_type_code AS doseTypeCode, COUNT(1) AS clickCount
     FROM dose_stage_click_event
     WHERE user_id = ? AND dose_date_local = ?
     GROUP BY dose_type_code`,
    [userId, doseDateLocal]
  );

  return rows;
}

export async function listTodayDoseSlots(connection, userId, dateLocal) {
  const [rows] = await connection.execute(
    `SELECT
      dt.code AS doseTypeCode,
      dt.display_name AS displayName,
      MIN(ds.planned_at_utc) AS plannedAt,
      COALESCE(sce.clickCount, 0) AS clickCount,
      CASE
        WHEN COALESCE(sce.clickCount, 0) > 0 THEN 'DONE'
        WHEN MAX(CASE WHEN dmr.dose_slot_id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'MISSED'
        ELSE 'PENDING'
      END AS status
    FROM dose_type dt
    LEFT JOIN dose_slot ds
      ON ds.dose_type_id = dt.dose_type_id
      AND ds.user_id = ?
      AND ds.dose_date_local = ?
    LEFT JOIN (
      SELECT dose_type_code, COUNT(1) AS clickCount
      FROM dose_stage_click_event
      WHERE user_id = ? AND dose_date_local = ?
      GROUP BY dose_type_code
    ) sce ON sce.dose_type_code = dt.code
    LEFT JOIN dose_missed_reminder dmr ON dmr.dose_slot_id = ds.dose_slot_id
    GROUP BY dt.dose_type_id, dt.code, dt.display_name, sce.clickCount
    ORDER BY dt.dose_type_id ASC`,
    [userId, dateLocal, userId, dateLocal]
  );

  return rows;
}
