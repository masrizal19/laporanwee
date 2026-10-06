<?php
// profile/get.php - Fetch Profile & Crop Settings Endpoint
require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];

$cropSettings = [
    'crop_zoom' => 1.0,
    'crop_x' => 0.0,
    'crop_y' => 0.0,
];

try {
    $settingsStmt = $pdo->prepare("SELECT crop_zoom, crop_x, crop_y FROM profile_settings WHERE user_id = :id LIMIT 1");
    $settingsStmt->execute(['id' => $userId]);
    $savedSettings = $settingsStmt->fetch();

    if ($savedSettings) {
        $cropSettings = [
            'crop_zoom' => (float)$savedSettings['crop_zoom'],
            'crop_x' => (float)$savedSettings['crop_x'],
            'crop_y' => (float)$savedSettings['crop_y'],
        ];
    }
} catch (Exception $e) {
    // Non-fatal if table does not exist yet
}

response(true, 'Berhasil mengambil data profil.', [
    'data' => [
        'id' => (int)$user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'] ?? 'Anggota Tim Kreatif',
        'status' => $user['status'] ?? 'active',
        'avatar_url' => $user['avatar_url'] ?? null,
        'updated_at' => $user['updated_at'] ?? null,
        'crop_settings' => $cropSettings,
    ]
], 200);
