<?php
// fotowe/config.php - Bootstrap, CORS, Upload Directories, and Idempotent Schema Initialization
if (file_exists(__DIR__ . '/../config.php')) {
    require_once __DIR__ . '/../config.php';
} elseif (file_exists(__DIR__ . '/../../config.php')) {
    require_once __DIR__ . '/../../config.php';
} else {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Konfigurasi database utama tidak ditemukan.'
    ]);
    exit();
}

// Ensure additional custom headers allowed cleanly
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, X-Auth-Token, X-Admin-Email");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function fotoweGetPublicBaseUrl() {
    $protocol = 'https';
    if (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
        (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
    ) {
        $protocol = 'https';
    }
    $host = !empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'api-laporanwe.mkverse.my.id';
    return $protocol . '://' . $host;
}

function fotoweGetApiBaseUrl() {
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/api/fotowe/index.php';
    $pos = strpos($script, '/fotowe/');
    $prefix = $pos !== false ? substr($script, 0, $pos) : '/api';
    if ($prefix === '') {
        $prefix = '/api';
    }
    return fotoweGetPublicBaseUrl() . $prefix . '/fotowe';
}

function fotoweGetUploadRootDir() {
    $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/') : '';
    if ($docRoot !== '' && is_dir($docRoot)) {
        return $docRoot . '/uploads/fotowe';
    }
    $parentApi = realpath(__DIR__ . '/..');
    if ($parentApi !== false) {
        $base = dirname($parentApi);
        return $base . '/uploads/fotowe';
    }
    return __DIR__ . '/uploads';
}

function fotoweEnsureUploadDirs() {
    $root = fotoweGetUploadRootDir();
    foreach (['', '/originals', '/thumbs', '/covers'] as $sub) {
        $dir = $root . $sub;
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }
    $htaccessPath = $root . '/.htaccess';
    if (!file_exists($htaccessPath)) {
        $rules = "<IfModule mod_headers.c>\n" .
            "    Header set Access-Control-Allow-Origin \"*\"\n" .
            "    Header set Access-Control-Allow-Methods \"GET, OPTIONS\"\n" .
            "</IfModule>\n";
        @file_put_contents($htaccessPath, $rules);
    }
    return $root;
}

function fotoweEnsureSchema(PDO $pdo) {
    static $initialized = false;
    if ($initialized) {
        return;
    }
    $initialized = true;

    $pdo->exec("
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
            KEY `idx_fotowe_proj_updated` (`updated_at`),
            KEY `idx_fotowe_proj_owner_id` (`owner_user_id`),
            KEY `idx_fotowe_proj_owner_email` (`owner_email`),
            KEY `idx_fotowe_proj_visibility` (`visibility`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function fotoweSaveBase64Cover($dataUrl, $projectId) {
    if (!is_string($dataUrl) || trim($dataUrl) === '') {
        return null;
    }
    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i', trim($dataUrl), $m)) {
        return null;
    }
    $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
    $bin = base64_decode($m[2], true);
    if ($bin === false || strlen($bin) === 0 || strlen($bin) > 2 * 1024 * 1024) {
        return null;
    }

    $uploadRoot = fotoweEnsureUploadDirs();
    $safeProj = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$projectId);
    $hash = substr(sha1($bin), 0, 12);
    $fileName = 'cover_' . $safeProj . '_' . $hash . '.' . $ext;
    $destPath = $uploadRoot . '/covers/' . $fileName;

    if (@file_put_contents($destPath, $bin) === false) {
        return null;
    }

    return fotoweGetPublicBaseUrl() . '/uploads/fotowe/covers/' . $fileName;
}

function fotoweNormalizeId($rawId, $prefix = 'ftw_') {
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string)$rawId));
    if ($clean === '') {
        return $prefix . bin2hex(random_bytes(8));
    }
    return substr($clean, 0, 64);
}
