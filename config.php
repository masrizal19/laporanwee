<?php
// config.php

// Dynamic CORS handling supporting production and preview origins
$allowed_origins = [
    'https://laporan.mkverse.my.id',
    'https://ais-dev-nhz6tpwkh2bcolye7wptsm-889127144996.asia-east1.run.app',
    'https://ais-pre-nhz6tpwkh2bcolye7wptsm-889127144996.asia-east1.run.app'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins) || preg_match('/\.run\.app$/', $origin) || preg_match('/\.ai\.studio$/', $origin)) {
    header("Access-Control-Allow-Origin: " . $origin);
} else {
    header("Access-Control-Allow-Origin: https://laporan.mkverse.my.id");
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Email");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Vary: Origin");
header("Access-Control-Max-Age: 86400");

// Security Headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
header("Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()");
header("Content-Security-Policy: default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' https: data: blob:; connect-src 'self' https:; font-src 'self' https: data:;");

// Handle preflight OPTIONS request before processing
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Credentials (using standard PDO)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'laporanwee_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // If connection fails, output JSON error using the requested response format (safely hiding raw credentials/errors)
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Gagal terhubung ke database. Silakan coba beberapa saat lagi.'
    ]);
    exit();
}

/**
 * Global response helper
 *
 * @param bool $success
 * @param string $message
 * @param array $data Additional properties to merge into the response
 * @param int $code HTTP response code
 */
function response($success, $message, $data = [], $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit();
}
