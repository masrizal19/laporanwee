<?php
// login.php
require_once 'config.php';

// Ensure the request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan. Gunakan POST.', [], 405);
}

// Parse JSON input
$input = json_decode(file_get_contents('php://input'), true);

$email = isset($input['email']) ? trim($input['email']) : '';
$password = isset($input['password']) ? trim($input['password']) : '';

if (empty($email) || empty($password)) {
    response(false, 'Email dan password wajib diisi.', [], 400);
}

try {
    // Query to find user using PDO prepared statement matching actual table columns
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        response(false, 'Email atau password tidak sesuai.', [], 401);
    }

    // Verify password hash (not plaintext)
    if (!password_verify($password, $user['password_hash'])) {
        response(false, 'Email atau password tidak sesuai.', [], 401);
    }

    // Check account status is active
    if ($user['status'] !== 'active') {
        response(false, 'Akun Anda tidak aktif. Silakan hubungi admin.', [], 403);
    }

    // Generate a simple secure token for the session
    $token = bin2hex(random_bytes(32));

    // Prepare clean user response payload as requested
    $userPayload = [
        'id' => (int)$user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $user['status']
    ];

    response(true, 'Login berhasil.', [
        'token' => $token,
        'user' => $userPayload
    ], 200);

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem: ' . $e->getMessage(), [], 500);
}
