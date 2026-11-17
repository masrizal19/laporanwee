<?php
// fotowe/delete.php - Delete uploaded FOTOWE photo asset (only if unreferenced or owned/admin)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }

    $photoId = isset($input['photo_id']) ? (int)$input['photo_id'] : (isset($input['id']) ? (int)$input['id'] : 0);
    if ($photoId <= 0) {
        response(false, 'Parameter photo_id wajib diisi.', [], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM fotowe_photos WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $photoId]);
    $photo = $stmt->fetch();

    if (!$photo) {
        response(false, 'Foto tidak ditemukan.', [], 404);
    }

    $isAdmin = fotoweIsAdmin($user);
    if (!$isAdmin && (int)$photo['owner_user_id'] !== (int)$user['id']) {
        response(false, 'Akses ditolak. Hanya pemilik foto atau Admin yang dapat menghapus foto ini.', [], 403);
    }

    $refStmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM fotowe_slots WHERE photo_id = :pid");
    $refStmt->execute(['pid' => $photoId]);
    $refCount = (int)($refStmt->fetch()['cnt'] ?? 0);

    if ($refCount > 0) {
        response(true, 'Foto masih digunakan pada artboard lain sehingga tetap dipertahankan.', [
            'deleted' => false,
            'in_use' => true,
        ], 200);
    }

    $uploadRoot = fotoweGetUploadRootDir();
    foreach ([$photo['file_path'], $photo['thumb_path']] as $rel) {
        if (!empty($rel)) {
            $disk = $uploadRoot . str_replace('/uploads/fotowe', '', $rel);
            if (file_exists($disk) && is_file($disk)) {
                @unlink($disk);
            }
        }
    }

    $delStmt = $pdo->prepare("DELETE FROM fotowe_photos WHERE id = :id");
    $delStmt->execute(['id' => $photoId]);

    response(true, 'Berkas foto berhasil dihapus.', [
        'deleted' => true,
        'photo_id' => $photoId,
    ], 200);
} catch (Exception $e) {
    response(false, 'Gagal menghapus foto FOTOWE.', [], 500);
}
