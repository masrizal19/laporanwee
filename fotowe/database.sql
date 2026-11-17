-- ============================================================================
-- FOTOWE Shared Cloud Workspace Schema (MySQL 5.7+ / 8.0 / MariaDB 10.x)
-- Executed automatically idempotently by /api/fotowe/config.php (CREATE IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `fotowe_projects` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `dpi` SMALLINT UNSIGNED NOT NULL DEFAULT 300,
    `color_mode` ENUM('rgb', 'gray') NOT NULL DEFAULT 'rgb',
    `active_artboard` INT UNSIGNED NOT NULL DEFAULT 0,
    `owner_user_id` BIGINT UNSIGNED NOT NULL,
    `owner_name` VARCHAR(160) NULL,
    `owner_email` VARCHAR(191) NOT NULL,
    `thumbnail_url` TEXT NULL,
    `visibility` ENUM('workspace', 'private') NOT NULL DEFAULT 'workspace',
    `version` INT UNSIGNED NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_fotowe_proj_updated` (`updated_at` DESC),
    KEY `idx_fotowe_proj_owner_id` (`owner_user_id`),
    KEY `idx_fotowe_proj_owner_email` (`owner_email`),
    KEY `idx_fotowe_proj_visibility` (`visibility`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fotowe_photos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `photo_key` VARCHAR(64) NOT NULL,
    `owner_user_id` BIGINT UNSIGNED NOT NULL,
    `original_name` VARCHAR(255) NOT NULL DEFAULT 'foto.jpg',
    `mime_type` VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `width` INT UNSIGNED NOT NULL DEFAULT 0,
    `height` INT UNSIGNED NOT NULL DEFAULT 0,
    `file_path` VARCHAR(500) NOT NULL,
    `file_url` TEXT NOT NULL,
    `thumb_path` VARCHAR(500) NULL,
    `thumb_url` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_fotowe_photo_key` (`photo_key`),
    KEY `idx_fotowe_photos_owner` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fotowe_artboards` (
    `id` VARCHAR(64) NOT NULL,
    `project_id` VARCHAR(64) NOT NULL,
    `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(120) NOT NULL,
    `template_code` VARCHAR(16) NOT NULL DEFAULT '4R',
    `photo_size_index` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `active_slot` INT UNSIGNED NOT NULL DEFAULT 0,
    `thumbnail_url` TEXT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_fotowe_ab_project_order` (`project_id`, `sort_order`),
    CONSTRAINT `fk_fotowe_ab_project`
        FOREIGN KEY (`project_id`) REFERENCES `fotowe_projects` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fotowe_slots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `artboard_id` VARCHAR(64) NOT NULL,
    `slot_index` INT UNSIGNED NOT NULL,
    `photo_id` BIGINT UNSIGNED NULL,
    `photo_url` TEXT NULL,
    `thumb_url` TEXT NULL,
    `photo_name` VARCHAR(255) NOT NULL DEFAULT '',
    `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `zoom` DOUBLE NOT NULL DEFAULT 1,
    `offset_x` DOUBLE NOT NULL DEFAULT 0,
    `offset_y` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('empty', 'filled') NOT NULL DEFAULT 'empty',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_fotowe_ab_slot` (`artboard_id`, `slot_index`),
    KEY `idx_fotowe_slot_photo` (`photo_id`),
    CONSTRAINT `fk_fotowe_slot_ab`
        FOREIGN KEY (`artboard_id`) REFERENCES `fotowe_artboards` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fotowe_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `project_id` VARCHAR(64) NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `user_email` VARCHAR(191) NOT NULL,
    `permission` ENUM('viewer', 'editor') NOT NULL DEFAULT 'editor',
    `granted_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_fotowe_perm_proj_email` (`project_id`, `user_email`),
    KEY `idx_fotowe_perm_user_id` (`user_id`),
    CONSTRAINT `fk_fotowe_perm_project`
        FOREIGN KEY (`project_id`) REFERENCES `fotowe_projects` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
