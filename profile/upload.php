<?php
// profile/upload.php - Upload Profile Avatar Photo
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

require_once __DIR__ . '/auth-helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

$user = getAuthenticatedProfileUser($pdo);
$userId = (int)$user['id'];
if (isset($_POST['id']) && (int)$_POST['id'] > 0) {
    $userId = (int)$_POST['id'];
}

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
    $ext = 'jpg';
}

$imageInfo = @getimagesize($file['tmp_name']);
if ($imageInfo === false) {
    response(false, 'File yang diunggah bukan gambar yang valid.', [], 400);
}

$uploadDir = __DIR__ . '/../../uploads/profile/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Format penamaan unik: avatar_{user_id}_{timestamp}_{rand}.{ext}
$timestamp = time();
$randomNumber = rand(1000, 9999);
$fileName = 'avatar_' . $userId . '_' . $timestamp . '_' . $randomNumber . '.' . $ext;
$destPath = $uploadDir . $fileName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    response(false, 'Gagal menyimpan file foto yang diunggah.', [], 500);
}

$publicUrl = getPublicBaseUrl() . '/uploads/profile/' . $fileName;

// Update data pengguna pada database (kolom avatar_url)
try {
    $updateStmt = $pdo->prepare("
        UPDATE users 
        SET avatar_url = :avatar_url,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute([
        'avatar_url' => $publicUrl,
        'id' => $userId
    ]);
} catch (Exception $e) {
    // Non-fatal if table schema varies
}

response(true, 'Foto profil berhasil diunggah.', [
    'avatar_url' => $publicUrl,
    'data' => [
        'avatar_url' => $publicUrl,
        'file_url' => $publicUrl,
        'file_name' => $fileName,
        'width' => $imageInfo[0],
        'height' => $imageInfo[1],
    ]
], 200);
