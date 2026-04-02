CREATE TABLE IF NOT EXISTS dose_checkpoint_reminder (
  reminder_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  dose_date_local DATE NOT NULL,
  checkpoint_hour TINYINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (reminder_id),
  UNIQUE KEY uk_checkpoint_user_date_hour (user_id, dose_date_local, checkpoint_hour),
  KEY idx_checkpoint_date_hour (dose_date_local, checkpoint_hour),
  CONSTRAINT fk_checkpoint_user
    FOREIGN KEY (user_id) REFERENCES app_user(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
