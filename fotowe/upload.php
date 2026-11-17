<?php
// fotowe/upload.php - Upload original high-res photo and generate thumbnail on server
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan. Gunakan POST.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $userId = (int)$user['id'];

    $fileKey = null;
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $fileKey = 'photo';
    } elseif (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $fileKey = 'file';
    }

    if ($fileKey === null) {
        response(false, 'Tidak ada file foto valid yang diunggah.', [], 400);
    }

    $file = $_FILES[$fileKey];
    if ((int)$file['size'] <= 0) {
        response(false, 'File foto kosong.', [], 400);
    }
    if ((int)$file['size'] > 25 * 1024 * 1024) {
        response(false, 'Ukuran file foto melebihi batas maksimal 25 MB.', [], 400);
    }

    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) {
        response(false, 'File yang diunggah bukan merupakan gambar yang valid.', [], 400);
    }

    $width = (int)$imageInfo[0];
    $height = (int)$imageInfo[1];
    $mime = !empty($imageInfo['mime']) ? $imageInfo['mime'] : ($file['type'] ?: 'image/jpeg');

    $extMap = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    $ext = isset($extMap[strtolower($mime)]) ? $extMap[strtolower($mime)] : 'jpg';

    $sha256 = @hash_file('sha256', $file['tmp_name']);
    if (!$sha256) {
        $sha256 = bin2hex(random_bytes(16));
    }

    // Deduplicate identical photo bytes already stored on server
    $existingStmt = $pdo->prepare("SELECT * FROM fotowe_photos WHERE photo_key = :pkey LIMIT 1");
    $existingStmt->execute(['pkey' => $sha256]);
    $existing = $existingStmt->fetch();

    $apiBase = fotoweGetApiBaseUrl();
    if ($existing) {
        $corsUrl = $apiBase . '/file.php?id=' . (int)$existing['id'];
        $thumbCorsUrl = !empty($existing['thumb_path']) ? ($corsUrl . '&thumb=1') : $corsUrl;
        response(true, 'Foto berhasil disinkronkan ke server.', [
            'data' => [
                'photo_id' => (int)$existing['id'],
                'photo_key' => $existing['photo_key'],
                'original_name' => $existing['original_name'],
                'file_url' => $existing['file_url'],
                'cors_url' => $corsUrl,
                'thumb_url' => $existing['thumb_url'] ?: $existing['file_url'],
                'thumb_cors_url' => $thumbCorsUrl,
                'mime_type' => $existing['mime_type'],
                'file_size' => (int)$existing['file_size'],
                'width' => (int)$existing['width'],
                'height' => (int)$existing['height'],
            ]
        ], 200);
    }

    $uploadRoot = fotoweEnsureUploadDirs();
    $origFileName = 'fw_' . substr($sha256, 0, 24) . '_' . time() . '.' . $ext;
    $origRelPath = '/uploads/fotowe/originals/' . $origFileName;
    $origDiskPath = $uploadRoot . '/originals/' . $origFileName;

    if (!@move_uploaded_file($file['tmp_name'], $origDiskPath)) {
        response(false, 'Gagal menyimpan file foto ke penyimpanan server.', [], 500);
    }

    $publicBase = fotoweGetPublicBaseUrl();
    $fileUrl = $publicBase . $origRelPath;

    // Generate lightweight thumbnail (max 360px) using GD if available
    $thumbRelPath = null;
    $thumbUrl = $fileUrl;
    if (function_exists('imagecreatefromstring') && function_exists('imagecreatetruecolor')) {
        $rawBytes = @file_get_contents($origDiskPath);
        $srcImg = $rawBytes !== false ? @imagecreatefromstring($rawBytes) : false;
        if ($srcImg !== false && $width > 0 && $height > 0) {
            $maxDim = 360;
            $scale = min(1.0, $maxDim / max($width, $height));
            $tw = max(1, (int)round($width * $scale));
            $th = max(1, (int)round($height * $scale));
            $dstImg = imagecreatetruecolor($tw, $th);
            $white = imagecolorallocate($dstImg, 255, 255, 255);
            imagefill($dstImg, 0, 0, $white);
            imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $tw, $th, $width, $height);
            $thumbName = 'thumb_' . substr($sha256, 0, 24) . '.jpg';
            $thumbDisk = $uploadRoot . '/thumbs/' . $thumbName;
            if (@imagejpeg($dstImg, $thumbDisk, 82)) {
                $thumbRelPath = '/uploads/fotowe/thumbs/' . $thumbName;
                $thumbUrl = $publicBase . $thumbRelPath;
            }
            imagedestroy($dstImg);
            imagedestroy($srcImg);
        }
    }

    $origName = !empty($file['name']) ? basename((string)$file['name']) : ('foto.' . $ext);
    $insertStmt = $pdo->prepare("
        INSERT INTO fotowe_photos
            (photo_key, owner_user_id, original_name, mime_type, file_size, width, height, file_path, file_url, thumb_path, thumb_url)
        VALUES
            (:photo_key, :owner_user_id, :original_name, :mime_type, :file_size, :width, :height, :file_path, :file_url, :thumb_path, :thumb_url)
    ");
    $insertStmt->execute([
        'photo_key' => $sha256,
        'owner_user_id' => $userId,
        'original_name' => substr($origName, 0, 255),
        'mime_type' => $mime,
        'file_size' => (int)$file['size'],
        'width' => $width,
        'height' => $height,
        'file_path' => $origRelPath,
        'file_url' => $fileUrl,
        'thumb_path' => $thumbRelPath,
        'thumb_url' => $thumbUrl,
    ]);

    $photoId = (int)$pdo->lastInsertId();
    $corsUrl = $apiBase . '/file.php?id=' . $photoId;
    $thumbCorsUrl = $thumbRelPath ? ($corsUrl . '&thumb=1') : $corsUrl;

    response(true, 'Foto berhasil diunggah ke server.', [
        'data' => [
            'photo_id' => $photoId,
            'photo_key' => $sha256,
            'original_name' => $origName,
            'file_url' => $fileUrl,
            'cors_url' => $corsUrl,
            'thumb_url' => $thumbUrl,
            'thumb_cors_url' => $thumbCorsUrl,
            'mime_type' => $mime,
            'file_size' => (int)$file['size'],
            'width' => $width,
            'height' => $height,
        ]
    ], 201);
} catch (Exception $e) {
    response(false, 'Gagal mengunggah foto FOTOWE ke server.', [], 500);
}
