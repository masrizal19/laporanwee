-- ============================================================================
-- LaporanWe Performance Indexes Migration (Idempotent & Safe)
-- Target: MySQL 5.7 / 8.0 / MariaDB 10.x
-- Rules: Does NOT drop tables, columns, or modify any existing user data.
-- Run via: mysql -u <user> -p <db_name> < database/performance_indexes.sql
-- ============================================================================

DROP PROCEDURE IF EXISTS lw_add_index_if_missing;

DELIMITER //
CREATE PROCEDURE lw_add_index_if_missing(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns VARCHAR(255)
)
BEGIN
    DECLARE v_table_exists INT DEFAULT 0;
    DECLARE v_index_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO v_table_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table;

    IF v_table_exists > 0 THEN
        SELECT COUNT(*) INTO v_index_exists
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index;

        IF v_index_exists = 0 THEN
            SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_columns, ')');
            PREPARE stmt FROM @ddl;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END //
DELIMITER ;

-- Authentication & Users
CALL lw_add_index_if_missing('auth_tokens', 'idx_auth_tokens_hash', '`token_hash`');
CALL lw_add_index_if_missing('auth_tokens', 'idx_auth_tokens_user', '`user_id`');
CALL lw_add_index_if_missing('users', 'idx_users_email', '`email`');
CALL lw_add_index_if_missing('users', 'idx_users_status', '`status`');

-- Daily Reports & Realtime Polling
CALL lw_add_index_if_missing('daily_reports', 'idx_daily_reports_order', '`report_date` DESC, `created_at` DESC, `id` DESC');
CALL lw_add_index_if_missing('daily_reports', 'idx_daily_reports_updated', '`updated_at`');
CALL lw_add_index_if_missing('daily_reports', 'idx_daily_reports_created', '`created_at`');
CALL lw_add_index_if_missing('daily_reports', 'idx_daily_reports_status', '`status`');
CALL lw_add_index_if_missing('daily_reports', 'idx_daily_reports_user_email', '`user_email`');

-- Daily Report Files (eliminates N+1 cover lookups & speeds up Galeri Berkas)
CALL lw_add_index_if_missing('daily_report_files', 'idx_drf_report_cat_id', '`report_id`, `file_category`, `id`');
CALL lw_add_index_if_missing('daily_report_files', 'idx_drf_category', '`file_category`');

-- Tasks (Kanban & Report Link)
CALL lw_add_index_if_missing('tasks', 'idx_tasks_report_id', '`daily_report_id`');
CALL lw_add_index_if_missing('tasks', 'idx_tasks_status', '`status`');

-- Activities Feed
CALL lw_add_index_if_missing('activities', 'idx_activities_created', '`created_at` DESC');
CALL lw_add_index_if_missing('activities', 'idx_activities_kind', '`kind`');

-- Profile Settings
CALL lw_add_index_if_missing('profile_settings', 'idx_profile_settings_user', '`user_id`');

DROP PROCEDURE IF EXISTS lw_add_index_if_missing;
