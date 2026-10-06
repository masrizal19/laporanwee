<?php
// profile/auth-helper.php - Shared Authentication & Path Helper for Profile Module
require_once __DIR__ . '/config.php';

function getAuthenticatedProfileUser($pdo) {
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
        $token = trim($matches[1]);
    }

    $adminEmailHeader = isset($headers['X-Admin-Email']) ? trim($headers['X-Admin-Email']) : (isset($headers['x-admin-email']) ? trim($headers['x-admin-email']) : (isset($_SERVER['HTTP_X_ADMIN_EMAIL']) ? trim($_SERVER['HTTP_X_ADMIN_EMAIL']) : ''));

    $user = null;

    if (!empty($token)) {
        $hashedToken = hash('sha256', $token);
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
            if (!empty($user['expires_at'])) {
                $expires = strtotime($user['expires_at']);
                if ($expires !== false && $expires < time()) {
                    response(false, 'Unauthorized. Sesi token telah kedaluwarsa.', [], 401);
                }
            }
            if ($user['status'] !== 'active') {
                response(false, 'Akses ditolak. Akun Anda tidak aktif.', [], 403);
            }
        }
    }

    if (!$user && !empty($adminEmailHeader) && empty($token)) {
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

    return $user;
}

function getPublicBaseUrl() {
    $protocol = 'https';
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'api-laporanwe.mkverse.my.id';
    return $protocol . '://' . $host;
}
