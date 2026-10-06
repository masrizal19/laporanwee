<?php
// profile/replace.php - Replace Profile Photo Directly
require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];
$oldAvatarUrl = $user['avatar_url'];

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    response(false, 'Tidak ada file foto yang diunggah.', [], 400);
}

$file = $_FILES['avatar'];

// Max 10MB
if ($file['size'] > 10 * 1024 * 1024) {
    response(false, 'Ukuran file foto melebihi batas maksimal 10 MB.', [], 400);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
if (!in_array($ext, $allowedExts)) {
    response(false, 'Format file foto tidak didukung. Gunakan JPG, PNG, atau WEBP.', [], 400);
}

$imageInfo = @getimagesize($file['tmp_name']);
if ($imageInfo === false) {
    response(false, 'File yang diunggah bukan gambar yang valid.', [], 400);
}

$uploadDir = __DIR__ . '/../../uploads/profile/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$fileName = 'avatar_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.jpg';
$destPath = $uploadDir . $fileName;

// Convert to standard JPEG
$srcImage = null;
switch ($imageInfo[2]) {
    case IMAGETYPE_JPEG:
        $srcImage = @imagecreatefromjpeg($file['tmp_name']);
        break;
    case IMAGETYPE_PNG:
        $srcImage = @imagecreatefrompng($file['tmp_name']);
        break;
    case IMAGETYPE_WEBP:
        $srcImage = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file['tmp_name']) : null;
        break;
}

if ($srcImage) {
    $w = imagesx($srcImage);
    $h = imagesy($srcImage);
    $canvas = imagecreatetruecolor($w, $h);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefilledrectangle($canvas, 0, 0, $w, $h, $white);
    imagecopy($canvas, $srcImage, 0, 0, 0, 0, $w, $h);
    imagejpeg($canvas, $destPath, 92);
    imagedestroy($canvas);
    imagedestroy($srcImage);
} else {
    move_uploaded_file($file['tmp_name'], $destPath);
}

$newAvatarUrl = getPublicBaseUrl() . '/uploads/profile/' . $fileName;

try {
    $updateStmt = $pdo->prepare("
        UPDATE users 
        SET avatar_url = :avatar_url,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute([
        'avatar_url' => $newAvatarUrl,
        'id' => $userId
    ]);

    if ($oldAvatarUrl && $oldAvatarUrl !== $newAvatarUrl) {
        $oldFile = basename(parse_url($oldAvatarUrl, PHP_URL_PATH));
        $oldPath = $uploadDir . $oldFile;
        if (file_exists($oldPath) && is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    response(true, 'Foto profil berhasil diganti.', [
        'data' => [
            'id' => $userId,
            'avatar_url' => $newAvatarUrl,
        ]
    ], 200);
} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem saat memperbarui foto profil.', [], 500);
}
