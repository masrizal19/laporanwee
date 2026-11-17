<?php
// fotowe/file.php - CORS-enabled photo streaming endpoint so HTML5 Canvas stays untainted across origins
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    response(false, 'Metode request tidak diizinkan. Gunakan GET.', [], 405);
}

$photoId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$isThumb = isset($_GET['thumb']) && ($_GET['thumb'] === '1' || $_GET['thumb'] === 'true');

if ($photoId <= 0) {
    response(false, 'Parameter id foto tidak valid.', [], 400);
}

try {
    fotoweEnsureSchema($pdo);
    $stmt = $pdo->prepare("SELECT * FROM fotowe_photos WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $photoId]);
    $photo = $stmt->fetch();

    if (!$photo) {
        response(false, 'Foto tidak ditemukan.', [], 404);
    }

    $uploadRoot = fotoweGetUploadRootDir();
    $relPath = ($isThumb && !empty($photo['thumb_path'])) ? $photo['thumb_path'] : $photo['file_path'];
    $diskPath = $uploadRoot . str_replace('/uploads/fotowe', '', $relPath);

    if (!file_exists($diskPath) || !is_file($diskPath)) {
        // Fallback to original if thumb missing
        $diskPath = $uploadRoot . str_replace('/uploads/fotowe', '', $photo['file_path']);
        if (!file_exists($diskPath) || !is_file($diskPath)) {
            response(false, 'Berkas foto tidak ditemukan di disk.', [], 404);
        }
    }

    $etag = '"' . md5($photo['photo_key'] . ($isThumb ? '-t' : '-o')) . '"';
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header_remove('Cache-Control');
    header_remove('Pragma');
    header("Cache-Control: public, max-age=31536000, immutable");
    header("ETag: " . $etag);

    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
        http_response_code(304);
        exit();
    }

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    $mime = ($isThumb && !empty($photo['thumb_path'])) ? 'image/jpeg' : ($photo['mime_type'] ?: 'image/jpeg');
    header("Content-Type: " . $mime);
    header("Content-Length: " . filesize($diskPath));
    readfile($diskPath);
    exit();
} catch (Exception $e) {
    response(false, 'Gagal mengambil berkas foto.', [], 500);
}
