-- Database schema for "吃药了吗 / TakeYourMedicine"
-- Target DB: MySQL 8.x (InnoDB, utf8mb4)
-- Time convention:
-- - All *_utc columns are stored in UTC as DATETIME(3)
-- - Recommended: set MySQL session time_zone = '+00:00' in application connections

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET time_zone = '+00:00';

-- ----------------------------
-- Core tables
-- ----------------------------

CREATE TABLE IF NOT EXISTS app_user (
  user_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid      VARCHAR(128) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_app_user_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS email_recipient (
  recipient_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  email         VARCHAR(320) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (recipient_id),
  UNIQUE KEY uk_email_recipient_user_email (user_id, email),
  KEY idx_email_recipient_user_active (user_id, is_active),
  CONSTRAINT fk_email_recipient_user
    FOREIGN KEY (user_id) REFERENCES app_user(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Static lookup: three default dose types (morning/noon/evening)
CREATE TABLE IF NOT EXISTS dose_type (
  dose_type_id    SMALLINT UNSIGNED NOT NULL,
  code            VARCHAR(16) NOT NULL,   -- AM / MID / NIGHT
  display_name    VARCHAR(32) NOT NULL,   -- 早 / 中 / 晚
  scheduled_time  TIME NOT NULL,          -- 09:00:00 / 12:00:00 / 18:00:00 (Beijing local time)
  PRIMARY KEY (dose_type_id),
  UNIQUE KEY uk_dose_type_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Daily slot instance per user per type (the "one chance" anchor)
CREATE TABLE IF NOT EXISTS dose_slot (
  dose_slot_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  dose_date_local  DATE NOT NULL,                -- Beijing local date (YYYY-MM-DD)
  dose_type_id     SMALLINT UNSIGNED NOT NULL,
  planned_at_utc   DATETIME(3) NOT NULL,         -- planned moment in UTC
  created_at       DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (dose_slot_id),
  UNIQUE KEY uk_dose_slot_user_date_type (user_id, dose_date_local, dose_type_id),
  KEY idx_dose_slot_planned_at_utc (planned_at_utc),
  KEY idx_dose_slot_user_planned (user_id, planned_at_utc),
  CONSTRAINT fk_dose_slot_user
    FOREIGN KEY (user_id) REFERENCES app_user(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dose_slot_type
    FOREIGN KEY (dose_type_id) REFERENCES dose_type(dose_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Click record: at most once per dose_slot
CREATE TABLE IF NOT EXISTS dose_click (
  dose_slot_id       BIGINT UNSIGNED NOT NULL,
  clicked_at_utc     DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  client_request_id  VARCHAR(128) NULL,          -- optional idempotency key
  payload_json       JSON NULL,
  PRIMARY KEY (dose_slot_id),
  UNIQUE KEY uk_dose_click_client_request_id (client_request_id),
  KEY idx_dose_click_clicked_at_utc (clicked_at_utc),
  CONSTRAINT fk_dose_click_slot
    FOREIGN KEY (dose_slot_id) REFERENCES dose_slot(dose_slot_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Missed reminder: at most once per dose_slot
CREATE TABLE IF NOT EXISTS dose_missed_reminder (
  dose_slot_id      BIGINT UNSIGNED NOT NULL,
  deadline_utc      DATETIME(3) NOT NULL,         -- planned_at_utc + 60 minutes
  triggered_at_utc  DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  sent_at_utc       DATETIME(3) NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending/sent/failed
  PRIMARY KEY (dose_slot_id),
  KEY idx_missed_deadline_status (deadline_utc, status),
  CONSTRAINT fk_dose_missed_slot
    FOREIGN KEY (dose_slot_id) REFERENCES dose_slot(dose_slot_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- One notification (email intent) per dose_slot at most (enforces "最多发一次")
CREATE TABLE IF NOT EXISTS dose_email_notification (
  notification_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dose_slot_id             BIGINT UNSIGNED NOT NULL,
  dose_email_kind          VARCHAR(24) NOT NULL,  -- DOSE_CLICKED / DOSE_MISSED
  dose_click_id            BIGINT UNSIGNED NULL,  -- references dose_click(dose_slot_id)
  dose_missed_reminder_id  BIGINT UNSIGNED NULL,  -- references dose_missed_reminder(dose_slot_id)
  subject                  VARCHAR(256) NOT NULL,
  body_template_code       VARCHAR(64) NOT NULL,
  payload_json             JSON NULL,
  created_at               DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (notification_id),
  UNIQUE KEY uk_notification_slot (dose_slot_id),
  UNIQUE KEY uk_notification_click (dose_click_id),
  UNIQUE KEY uk_notification_missed (dose_missed_reminder_id),
  KEY idx_notification_kind_created (dose_email_kind, created_at),
  CONSTRAINT fk_notification_slot
    FOREIGN KEY (dose_slot_id) REFERENCES dose_slot(dose_slot_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notification_click
    FOREIGN KEY (dose_click_id) REFERENCES dose_click(dose_slot_id),
  CONSTRAINT fk_notification_missed
    FOREIGN KEY (dose_missed_reminder_id) REFERENCES dose_missed_reminder(dose_slot_id),
  CONSTRAINT chk_notification_kind_ref CHECK (
    (dose_email_kind = 'DOSE_CLICKED' AND dose_click_id IS NOT NULL AND dose_missed_reminder_id IS NULL)
    OR
    (dose_email_kind = 'DOSE_MISSED' AND dose_click_id IS NULL AND dose_missed_reminder_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Delivery log: one notification can deliver to many recipients; enforce idempotency per recipient
CREATE TABLE IF NOT EXISTS email_delivery_log (
  delivery_id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id          BIGINT UNSIGNED NOT NULL,
  recipient_id             BIGINT UNSIGNED NOT NULL,
  recipient_email_snapshot VARCHAR(320) NOT NULL,
  status                   VARCHAR(16) NOT NULL DEFAULT 'queued', -- queued/sending/sent/failed
  attempts                 INT UNSIGNED NOT NULL DEFAULT 0,
  sent_at_utc              DATETIME(3) NULL,
  error_message            TEXT NULL,
  created_at               DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (delivery_id),
  UNIQUE KEY uk_delivery_notification_recipient (notification_id, recipient_id),
  KEY idx_delivery_status_created (status, created_at),
  CONSTRAINT fk_delivery_notification
    FOREIGN KEY (notification_id) REFERENCES dose_email_notification(notification_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_delivery_recipient
    FOREIGN KEY (recipient_id) REFERENCES email_recipient(recipient_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ----------------------------
-- Seed / reference data
-- ----------------------------

INSERT INTO dose_type(dose_type_id, code, display_name, scheduled_time)
VALUES
  (1, 'AM', '早',   '09:00:00'),
  (2, 'MID', '中',  '12:00:00'),
  (3, 'NIGHT', '晚','18:00:00')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  display_name = VALUES(display_name),
  scheduled_time = VALUES(scheduled_time);

