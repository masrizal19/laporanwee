<?php
// profile.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET' && $method !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

// Extract Authorization Bearer Token
$headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
$authHeader = '';
if (isset($headers['Authorization'])) {
    $authHeader = $headers['Authorization'];
} elseif (isset($headers['authorization'])) {
    $authHeader = $headers['authorization'];
} elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

$token = '';
if (preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
}

$adminEmailHeader = isset($headers['X-Admin-Email']) ? trim($headers['X-Admin-Email']) : (isset($headers['x-admin-email']) ? trim($headers['x-admin-email']) : (isset($_SERVER['HTTP_X_ADMIN_EMAIL']) ? trim($_SERVER['HTTP_X_ADMIN_EMAIL']) : ''));

$user = null;

try {
    if (!empty($token)) {
        // Calculate SHA-256 hash of the token
        $hashedToken = hash('sha256', $token);
        
        // Match token in auth_tokens table supporting both hashed and unhashed token keys
        $stmt = $pdo->prepare("
            SELECT u.*, t.expires_at FROM users u
            JOIN auth_tokens t ON u.id = t.user_id
            WHERE (t.token_hash = :token OR t.token_hash = :hashed_token) LIMIT 1
        ");
        $stmt->execute([
            'token' => $token,
            'hashed_token' => $hashedToken
        ]);
        $user = $stmt->fetch();

        if ($user) {
            // Validate token expiration
            if (!empty($user['expires_at'])) {
                $expires = strtotime($user['expires_at']);
                if ($expires !== false && $expires < time()) {
                    response(false, 'Unauthorized. Sesi token telah kedaluwarsa.', [], 401);
                }
            }
            // Validate active status
            if ($user['status'] !== 'active') {
                response(false, 'Akses ditolak. Akun Anda tidak aktif.', [], 403);
            }
        }
    }

    if (!$user && !empty($adminEmailHeader) && empty($token)) {
        // Fallback match by X-Admin-Email only if no Bearer token was provided
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $adminEmailHeader]);
        $user = $stmt->fetch();
        
        if ($user && $user['status'] !== 'active') {
            response(false, 'Akses ditolak. Akun Anda tidak aktif.', [], 403);
        }
    }

    if (!$user) {
        response(false, 'Unauthorized. Token tidak valid atau sesi telah berakhir.', [], 401);
    }

    if ($method === 'GET') {
        response(true, 'Berhasil mengambil profil', [
            'data' => [
                'id' => (int)$user['id'],
                'full_name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role'] ?? 'Anggota Tim Kreatif',
                'status' => $user['status'],
                'avatar_url' => $user['avatar_url'] ?? null,
                'updated_at' => $user['updated_at'] ?? null
            ]
        ], 200);
    }

    if ($method === 'POST') {
        // Check content type or multipart form data
        $fullName = isset($_POST['full_name']) ? trim($_POST['full_name']) : (isset($_POST['name']) ? trim($_POST['name']) : $user['full_name']);
        $avatarUrl = $user['avatar_url'] ?? null;

        // Handle file upload if present
        if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['avatar'];
            
            // Validate size (max 10MB)
            if ($file['size'] > 10 * 1024 * 1024) {
                response(false, 'Ukuran file foto profil melebihi batas maksimal 10 MB.', [], 400);
            }

            // Validate extension and MIME
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
            if (!in_array($ext, $allowedExts)) {
                response(false, 'Format file foto tidak didukung. Gunakan JPG, PNG, atau WEBP.', [], 400);
            }

            // Real MIME type verification via getimagesize
            $imageInfo = @getimagesize($file['tmp_name']);
            if ($imageInfo === false) {
                response(false, 'File yang diunggah bukan merupakan gambar valid.', [], 400);
            }

            $uploadDir = 'uploads/profile/';
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $randomFileName = 'profile_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
            $uploadPath = $uploadDir . $randomFileName;

            if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
                // Construct public URL, default to https if using official production/preview domains or proxied ssl
                $protocol = 'http';
                if (
                    (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === 1)) ||
                    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
                ) {
                    $protocol = 'https';
                }
                $host = $_SERVER['HTTP_HOST'];
                if (strpos($host, 'mkverse.my.id') !== false || strpos($host, 'run.app') !== false) {
                    $protocol = 'https';
                }
                $avatarUrl = $protocol . '://' . $host . '/' . $uploadPath;
            } else {
                response(false, 'Gagal mengunggah file foto profil ke server.', [], 500);
            }
        }

        // Update database user
        $updateStmt = $pdo->prepare("
            UPDATE users 
            SET full_name = :full_name, avatar_url = :avatar_url, updated_at = NOW() 
            WHERE id = :id
        ");
        $updateStmt->execute([
            'full_name' => $fullName,
            'avatar_url' => $avatarUrl,
            'id' => $user['id']
        ]);

        // Fetch updated user
        $fetchStmt = $pdo->prepare("SELECT * FROM users WHERE id = :id LIMIT 1");
        $fetchStmt->execute(['id' => $user['id']]);
        $updatedUser = $fetchStmt->fetch();

        response(true, 'Profil berhasil diperbarui.', [
            'data' => [
                'id' => (int)$updatedUser['id'],
                'full_name' => $updatedUser['full_name'],
                'email' => $updatedUser['email'],
                'role' => $updatedUser['role'] ?? 'Anggota Tim Kreatif',
                'status' => $updatedUser['status'],
                'avatar_url' => $updatedUser['avatar_url'] ?? null,
                'updated_at' => $updatedUser['updated_at'] ?? null
            ]
        ], 200);
    }

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem. Silakan hubungi administrator.', [], 500);
}
?>
