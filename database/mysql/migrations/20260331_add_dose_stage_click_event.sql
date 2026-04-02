CREATE TABLE IF NOT EXISTS dose_stage_click_event (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  dose_date_local DATE NOT NULL,
  dose_type_code VARCHAR(16) NOT NULL,
  clicked_at_utc DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  PRIMARY KEY (event_id),
  KEY idx_stage_click_user_date_type (user_id, dose_date_local, dose_type_code),
  KEY idx_stage_click_clicked_at (clicked_at_utc),
  CONSTRAINT fk_stage_click_user
    FOREIGN KEY (user_id) REFERENCES app_user(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
