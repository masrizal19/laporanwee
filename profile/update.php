<?php
// profile/update.php - Update User Profile Name & Info
require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];

// Parse input from POST or JSON
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

$fullName = isset($input['full_name']) ? trim($input['full_name']) : (isset($input['name']) ? trim($input['name']) : '');

if (empty($fullName)) {
    response(false, 'Nama lengkap tidak boleh kosong.', [], 400);
}

try {
    $updateStmt = $pdo->prepare("
        UPDATE users 
        SET full_name = :full_name,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute([
        'full_name' => $fullName,
        'id' => $userId
    ]);

    $selectStmt = $pdo->prepare("SELECT id, full_name, email, role, status, avatar_url, updated_at FROM users WHERE id = :id LIMIT 1");
    $selectStmt->execute(['id' => $userId]);
    $freshUser = $selectStmt->fetch();

    response(true, 'Profil berhasil diperbarui.', [
        'data' => [
            'id' => (int)$freshUser['id'],
            'full_name' => $freshUser['full_name'],
            'email' => $freshUser['email'],
            'role' => $freshUser['role'] ?? 'Anggota Tim Kreatif',
            'status' => $freshUser['status'] ?? 'active',
            'avatar_url' => $freshUser['avatar_url'],
            'updated_at' => $freshUser['updated_at'],
        ]
    ], 200);
} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem saat memperbarui profil.', [], 500);
}
