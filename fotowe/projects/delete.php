<?php
// fotowe/projects/delete.php - Delete FOTOWE project (Owner or Admin only) and clean orphaned photos
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

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

    $projectId = trim((string)($input['id'] ?? ($_GET['id'] ?? '')));
    if ($projectId === '') {
        response(false, 'Parameter id project wajib diisi.', [], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM fotowe_projects WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $projectId]);
    $project = $stmt->fetch();

    if (!$project) {
        response(false, 'Project tidak ditemukan atau sudah dihapus.', [], 404);
    }

    $access = fotoweResolveAccess($pdo, $project, $user);
    if (!$access['can_delete']) {
        response(false, 'Akses ditolak. Hanya pemilik project atau Admin yang dapat menghapus project ini.', [], 403);
    }

    // Collect photo IDs used in this project before cascade deletion
    $photoIdStmt = $pdo->prepare("
        SELECT DISTINCT s.photo_id
        FROM fotowe_slots s
        JOIN fotowe_artboards a ON a.id = s.artboard_id
        WHERE a.project_id = :pid AND s.photo_id IS NOT NULL
    ");
    $photoIdStmt->execute(['pid' => $projectId]);
    $candidatePhotoIds = array_map('intval', $photoIdStmt->fetchAll(PDO::FETCH_COLUMN));

    $pdo->beginTransaction();
    $delStmt = $pdo->prepare("DELETE FROM fotowe_projects WHERE id = :id");
    $delStmt->execute(['id' => $projectId]);
    $pdo->commit();

    // Remove project cover thumbnail from disk if stored locally
    $uploadRoot = fotoweGetUploadRootDir();
    if (!empty($project['thumbnail_url'])) {
        $coverPath = parse_url($project['thumbnail_url'], PHP_URL_PATH);
        if ($coverPath && strpos($coverPath, '/uploads/fotowe/covers/') !== false) {
            $coverDisk = $uploadRoot . '/covers/' . basename($coverPath);
            if (file_exists($coverDisk) && is_file($coverDisk)) {
                @unlink($coverDisk);
            }
        }
    }

    // Clean up photos no longer referenced by any slot in any remaining project
    foreach ($candidatePhotoIds as $pid) {
        if ($pid <= 0) continue;
        $chkStmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM fotowe_slots WHERE photo_id = :pid");
        $chkStmt->execute(['pid' => $pid]);
        if ((int)($chkStmt->fetch()['cnt'] ?? 0) === 0) {
            $pRowStmt = $pdo->prepare("SELECT id, file_path, thumb_path FROM fotowe_photos WHERE id = :pid LIMIT 1");
            $pRowStmt->execute(['pid' => $pid]);
            $pRow = $pRowStmt->fetch();
            if ($pRow) {
                foreach ([$pRow['file_path'], $pRow['thumb_path']] as $rel) {
                    if (!empty($rel)) {
                        $disk = $uploadRoot . str_replace('/uploads/fotowe', '', $rel);
                        if (file_exists($disk) && is_file($disk)) {
                            @unlink($disk);
                        }
                    }
                }
                $pdo->prepare("DELETE FROM fotowe_photos WHERE id = :pid")->execute(['pid' => $pid]);
            }
        }
    }

    response(true, 'Project berhasil dihapus dari server.', [
        'deleted_id' => $projectId,
    ], 200);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Gagal menghapus project FOTOWE.', [], 500);
}
