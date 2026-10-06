<?php
// profile/upload.php - Upload Raw Photo for Profile
require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];

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

$uploadDir = __DIR__ . '/../../uploads/profile/raw/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$fileName = 'raw_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$destPath = $uploadDir . $fileName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    response(false, 'Gagal menyimpan file foto yang diunggah.', [], 500);
}

$publicUrl = getPublicBaseUrl() . '/uploads/profile/raw/' . $fileName;

response(true, 'Foto berhasil diunggah.', [
    'data' => [
        'file_url' => $publicUrl,
        'file_name' => $fileName,
        'width' => $imageInfo[0],
        'height' => $imageInfo[1],
    ]
], 200);
