<?php
// profile/delete.php - Remove Profile Avatar Photo
require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];
$oldAvatarUrl = $user['avatar_url'];

try {
    $pdo->beginTransaction();

    $updateStmt = $pdo->prepare("
        UPDATE users 
        SET avatar_url = NULL,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute(['id' => $userId]);

    try {
        $delSettingsStmt = $pdo->prepare("DELETE FROM profile_settings WHERE user_id = :id");
        $delSettingsStmt->execute(['id' => $userId]);
    } catch (Exception $e) {
        // Non-fatal
    }

    $pdo->commit();

    if ($oldAvatarUrl) {
        $oldFile = basename(parse_url($oldAvatarUrl, PHP_URL_PATH));
        $oldPath = __DIR__ . '/../../uploads/profile/' . $oldFile;
        if (file_exists($oldPath) && is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    response(true, 'Foto profil berhasil dihapus.', [
        'data' => [
            'id' => $userId,
            'avatar_url' => null,
        ]
    ], 200);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Terjadi kesalahan sistem saat menghapus foto profil.', [], 500);
}
