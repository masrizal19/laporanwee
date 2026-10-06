<?php
// profile/settings.php - Manage User Profile & Crop Settings
require_once __DIR__ . '/auth-helper.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET' && $method !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];

// Ensure profile_settings table exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS profile_settings (
            user_id INT NOT NULL PRIMARY KEY,
            crop_zoom DECIMAL(5,2) DEFAULT 1.00,
            crop_x DECIMAL(8,2) DEFAULT 0.00,
            crop_y DECIMAL(8,2) DEFAULT 0.00,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (Exception $e) {}

if ($method === 'GET') {
    $cropSettings = [
        'crop_zoom' => 1.0,
        'crop_x' => 0.0,
        'crop_y' => 0.0,
    ];

    try {
        $stmt = $pdo->prepare("SELECT crop_zoom, crop_x, crop_y FROM profile_settings WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if ($row) {
            $cropSettings = [
                'crop_zoom' => (float)$row['crop_zoom'],
                'crop_x' => (float)$row['crop_x'],
                'crop_y' => (float)$row['crop_y'],
            ];
        }
    } catch (Exception $e) {}

    response(true, 'Berhasil mengambil pengaturan crop profil.', [
        'data' => $cropSettings
    ], 200);
}

if ($method === 'POST') {
    $input = $_POST;
    if (empty($input)) {
        $rawJson = file_get_contents('php://input');
        if (!empty($rawJson)) {
            $decoded = json_decode($rawJson, true);
            if (is_array($decoded)) {
                $input = $decoded;
            }
        }
    }

    $zoom = isset($input['crop_zoom']) ? (float)$input['crop_zoom'] : (isset($input['zoom']) ? (float)$input['zoom'] : 1.0);
    $x = isset($input['crop_x']) ? (float)$input['crop_x'] : (isset($input['x']) ? (float)$input['x'] : 0.0);
    $y = isset($input['crop_y']) ? (float)$input['crop_y'] : (isset($input['y']) ? (float)$input['y'] : 0.0);

    try {
        $stmt = $pdo->prepare("
            INSERT INTO profile_settings (user_id, crop_zoom, crop_x, crop_y, updated_at)
            VALUES (:user_id, :crop_zoom, :crop_x, :crop_y, NOW())
            ON DUPLICATE KEY UPDATE
                crop_zoom = VALUES(crop_zoom),
                crop_x = VALUES(crop_x),
                crop_y = VALUES(crop_y),
                updated_at = NOW()
        ");
        $stmt->execute([
            'user_id' => $userId,
            'crop_zoom' => $zoom,
            'crop_x' => $x,
            'crop_y' => $y,
        ]);

        response(true, 'Pengaturan crop berhasil disimpan.', [
            'data' => [
                'crop_zoom' => $zoom,
                'crop_x' => $x,
                'crop_y' => $y,
            ]
        ], 200);
    } catch (Exception $e) {
        response(false, 'Gagal menyimpan pengaturan crop profil.', [], 500);
    }
}
