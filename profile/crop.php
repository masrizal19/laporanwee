<?php
// profile/crop.php - Server-Side Profile Photo Cropper
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

$zoom = isset($input['zoom']) ? (float)$input['zoom'] : 1.0;
$x = isset($input['x']) ? (float)$input['x'] : 0.0;
$y = isset($input['y']) ? (float)$input['y'] : 0.0;
$avatarInput = isset($input['avatar']) ? trim($input['avatar']) : '';

$sourceFilePath = '';

if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
    $sourceFilePath = $_FILES['avatar']['tmp_name'];
} elseif (!empty($avatarInput)) {
    $baseName = basename(parse_url($avatarInput, PHP_URL_PATH));
    $possiblePaths = [
        __DIR__ . '/../../uploads/profile/' . $baseName,
        __DIR__ . '/../uploads/profile/' . $baseName,
        __DIR__ . '/../../uploads/profile/crops/' . $baseName,
        __DIR__ . '/../uploads/profile/crops/' . $baseName,
        'uploads/profile/' . $baseName,
        'uploads/' . $baseName,
    ];
    foreach ($possiblePaths as $p) {
        if (file_exists($p) && is_file($p)) {
            $sourceFilePath = $p;
            break;
        }
    }
}

if (empty($sourceFilePath) || !file_exists($sourceFilePath)) {
    response(false, 'Sumber foto untuk crop tidak ditemukan.', [], 400);
}

$imageInfo = @getimagesize($sourceFilePath);
if ($imageInfo === false) {
    response(false, 'File sumber bukan gambar yang valid.', [], 400);
}

$origW = $imageInfo[0];
$origH = $imageInfo[1];
$mimeType = $imageInfo['mime'];

$srcImage = null;
switch ($imageInfo[2]) {
    case IMAGETYPE_JPEG:
        $srcImage = @imagecreatefromjpeg($sourceFilePath);
        break;
    case IMAGETYPE_PNG:
        $srcImage = @imagecreatefrompng($sourceFilePath);
        break;
    case IMAGETYPE_WEBP:
        $srcImage = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourceFilePath) : null;
        break;
}

if (!$srcImage) {
    response(false, 'Format gambar tidak didukung untuk pemrosesan crop.', [], 400);
}

$outputSize = 400;

// Golden Reference math ported to GD server resampler
$baseScale = max($outputSize / $origW, $outputSize / $origH);
$effectiveScale = $baseScale * max(1.0, min(4.0, $zoom));

$cropWindowSrcW = $outputSize / $effectiveScale;
$cropWindowSrcH = $outputSize / $effectiveScale;

$centerSrcX = ($origW / 2.0) - ($x / $effectiveScale);
$centerSrcY = ($origH / 2.0) - ($y / $effectiveScale);

$srcX = (int)round($centerSrcX - ($cropWindowSrcW / 2.0));
$srcY = (int)round($centerSrcY - ($cropWindowSrcH / 2.0));

// Clamping to original image boundaries
$srcX = max(0, min($origW - (int)$cropWindowSrcW, $srcX));
$srcY = max(0, min($origH - (int)$cropWindowSrcH, $srcY));
$cropSrcW = (int)min($origW - $srcX, round($cropWindowSrcW));
$cropSrcH = (int)min($origH - $srcY, round($cropWindowSrcH));

$dstImage = imagecreatetruecolor($outputSize, $outputSize);
$white = imagecolorallocate($dstImage, 255, 255, 255);
imagefilledrectangle($dstImage, 0, 0, $outputSize, $outputSize, $white);

imagecopyresampled(
    $dstImage,
    $srcImage,
    0,
    0,
    $srcX,
    $srcY,
    $outputSize,
    $outputSize,
    $cropSrcW,
    $cropSrcH
);

$cropsDir = __DIR__ . '/../../uploads/profile/crops/';
if (!file_exists($cropsDir)) {
    mkdir($cropsDir, 0755, true);
}

$cropFileName = 'crop_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.jpg';
$cropDestPath = $cropsDir . $cropFileName;

imagejpeg($dstImage, $cropDestPath, 92);

imagedestroy($dstImage);
imagedestroy($srcImage);

$publicCropUrl = getPublicBaseUrl() . '/uploads/profile/crops/' . $cropFileName;

response(true, 'Crop berhasil diproses.', [
    'data' => [
        'crop_url' => $publicCropUrl,
        'file_url' => $publicCropUrl,
        'file_name' => $cropFileName,
        'width' => $outputSize,
        'height' => $outputSize,
        'zoom' => $zoom,
        'x' => $x,
        'y' => $y,
    ]
], 200);
