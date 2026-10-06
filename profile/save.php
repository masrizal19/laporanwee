<?php
// profile/save.php - Save Profile & Cropped Avatar Endpoint
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

$fullName = isset($input['full_name']) ? trim($input['full_name']) : (isset($input['name']) ? trim($input['name']) : $user['full_name']);
$cropFileName = isset($input['crop_file']) ? trim($input['crop_file']) : '';
$cropUrl = isset($input['crop_url']) ? trim($input['crop_url']) : '';
$zoom = isset($input['zoom']) ? (float)$input['zoom'] : (isset($input['crop_zoom']) ? (float)$input['crop_zoom'] : 1.0);
$x = isset($input['x']) ? (float)$input['x'] : (isset($input['crop_x']) ? (float)$input['crop_x'] : 0.0);
$y = isset($input['y']) ? (float)$input['y'] : (isset($input['crop_y']) ? (float)$input['crop_y'] : 0.0);

$targetAvatarUrl = $user['avatar_url'];
$oldAvatarUrl = $user['avatar_url'];
$tempCropFileToDelete = null;

try {
    // 1. Process crop file if provided
    $candidateFile = '';
    if (!empty($cropFileName)) {
        $baseName = basename($cropFileName);
        $possiblePaths = [
            __DIR__ . '/../../uploads/profile/crops/' . $baseName,
            __DIR__ . '/../uploads/profile/crops/' . $baseName,
            __DIR__ . '/../../uploads/profile/' . $baseName,
            __DIR__ . '/../uploads/profile/' . $baseName,
            'uploads/profile/crops/' . $baseName,
            'uploads/profile/' . $baseName,
        ];
        foreach ($possiblePaths as $p) {
            if (file_exists($p) && is_file($p)) {
                $candidateFile = $p;
                break;
            }
        }
    } elseif (!empty($cropUrl)) {
        $urlPath = parse_url($cropUrl, PHP_URL_PATH);
        if ($urlPath) {
            $baseName = basename($urlPath);
            $possiblePaths = [
                __DIR__ . '/../../uploads/profile/crops/' . $baseName,
                __DIR__ . '/../uploads/profile/crops/' . $baseName,
                __DIR__ . '/../../uploads/profile/' . $baseName,
                __DIR__ . '/../uploads/profile/' . $baseName,
                'uploads/profile/crops/' . $baseName,
                'uploads/profile/' . $baseName,
            ];
            foreach ($possiblePaths as $p) {
                if (file_exists($p) && is_file($p)) {
                    $candidateFile = $p;
                    break;
                }
            }
        }
    }

    // If a direct avatar file was uploaded in the save request
    if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
        $candidateFile = $_FILES['avatar']['tmp_name'];
    } elseif (isset($_FILES['crop_file']) && $_FILES['crop_file']['error'] === UPLOAD_ERR_OK) {
        $candidateFile = $_FILES['crop_file']['tmp_name'];
    }

    if (!empty($candidateFile) && file_exists($candidateFile)) {
        // Validate MIME type & image integrity
        $imageInfo = @getimagesize($candidateFile);
        if ($imageInfo === false) {
            response(false, 'File hasil crop tidak valid atau rusak.', [], 400);
        }

        $destDir = __DIR__ . '/../../uploads/profile/';
        if (!file_exists($destDir)) {
            mkdir($destDir, 0755, true);
        }

        $finalFileName = 'avatar_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.jpg';
        $finalDestPath = $destDir . $finalFileName;

        // Convert / save as optimized JPEG
        $srcImage = null;
        switch ($imageInfo[2]) {
            case IMAGETYPE_JPEG:
                $srcImage = @imagecreatefromjpeg($candidateFile);
                break;
            case IMAGETYPE_PNG:
                $srcImage = @imagecreatefrompng($candidateFile);
                break;
            case IMAGETYPE_WEBP:
                $srcImage = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($candidateFile) : null;
                break;
        }

        if ($srcImage) {
            $w = imagesx($srcImage);
            $h = imagesy($srcImage);
            $canvas = imagecreatetruecolor($w, $h);
            $white = imagecolorallocate($canvas, 255, 255, 255);
            imagefilledrectangle($canvas, 0, 0, $w, $h, $white);
            imagecopy($canvas, $srcImage, 0, 0, 0, 0, $w, $h);
            imagejpeg($canvas, $finalDestPath, 92);
            imagedestroy($canvas);
            imagedestroy($srcImage);
        } else {
            copy($candidateFile, $finalDestPath);
        }

        $targetAvatarUrl = getPublicBaseUrl() . '/uploads/profile/' . $finalFileName;
        $tempCropFileToDelete = $candidateFile;
    }

    // 2. Begin Database Transaction
    $pdo->beginTransaction();

    // Ensure profile_settings table exists
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS profile_settings (
                user_id INT NOT NULL PRIMARY KEY,
                crop_zoom DECIMAL(5,2) DEFAULT 1.00,
                crop_x DECIMAL(8,2) DEFAULT 0.00,
                crop_y DECIMAL(8,2) DEFAULT 0.00,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    } catch (Exception $e) {
        // Table creation failure is non-fatal if table already exists
    }

    // Update users table
    $updateStmt = $pdo->prepare("
        UPDATE users 
        SET full_name = :full_name,
            avatar_url = :avatar_url,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updateStmt->execute([
        'full_name' => $fullName,
        'avatar_url' => $targetAvatarUrl,
        'id' => $userId
    ]);

    // Upsert profile_settings
    try {
        $settingsStmt = $pdo->prepare("
            INSERT INTO profile_settings (user_id, crop_zoom, crop_x, crop_y, updated_at)
            VALUES (:user_id, :crop_zoom, :crop_x, :crop_y, NOW())
            ON DUPLICATE KEY UPDATE
                crop_zoom = VALUES(crop_zoom),
                crop_x = VALUES(crop_x),
                crop_y = VALUES(crop_y),
                updated_at = NOW()
        ");
        $settingsStmt->execute([
            'user_id' => $userId,
            'crop_zoom' => $zoom,
            'crop_x' => $x,
            'crop_y' => $y
        ]);
    } catch (Exception $e) {
        // Settings upsert error is non-fatal to allow user update to succeed
    }

    // Fetch refreshed record
    $selectStmt = $pdo->prepare("SELECT id, full_name, email, role, status, avatar_url, updated_at FROM users WHERE id = :id LIMIT 1");
    $selectStmt->execute(['id' => $userId]);
    $freshUser = $selectStmt->fetch();

    $pdo->commit();

    // 3. Post-commit File Cleanup
    if ($tempCropFileToDelete && file_exists($tempCropFileToDelete) && strpos($tempCropFileToDelete, 'crops') !== false) {
        @unlink($tempCropFileToDelete);
    }
    if ($oldAvatarUrl && $oldAvatarUrl !== $targetAvatarUrl) {
        $oldFile = basename(parse_url($oldAvatarUrl, PHP_URL_PATH));
        $oldPath = __DIR__ . '/../../uploads/profile/' . $oldFile;
        if (file_exists($oldPath) && is_file($oldPath)) {
            @unlink($oldPath);
        }
    }

    response(true, 'Profil berhasil disimpan.', [
        'data' => [
            'id' => (int)$freshUser['id'],
            'full_name' => $freshUser['full_name'],
            'email' => $freshUser['email'],
            'role' => $freshUser['role'] ?? 'Anggota Tim Kreatif',
            'status' => $freshUser['status'] ?? 'active',
            'avatar_url' => $freshUser['avatar_url'],
            'updated_at' => $freshUser['updated_at'],
            'crop_settings' => [
                'zoom' => $zoom,
                'x' => $x,
                'y' => $y
            ]
        ]
    ], 200);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Terjadi kesalahan sistem saat menyimpan profil. Silakan hubungi administrator.', [], 500);
}
