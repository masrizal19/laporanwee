<?php
// reports/list.php - Global Daily Reports Endpoint
require_once __DIR__ . '/../config.php';

// Method check
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    response(false, 'Metode request tidak diizinkan. Gunakan GET.', [], 405);
}

// 1. Mandatory Authentication Check
$headers = apache_request_headers();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '');

$token = '';
if (preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
    $token = $matches[1];
}

$adminEmailHeader = isset($headers['X-Admin-Email']) ? trim($headers['X-Admin-Email']) : (isset($_SERVER['HTTP_X_ADMIN_EMAIL']) ? trim($_SERVER['HTTP_X_ADMIN_EMAIL']) : '');

$user = null;

try {
    if (!empty($token)) {
        // Check token in auth_tokens table
        $stmt = $pdo->prepare("
            SELECT u.* FROM users u
            JOIN auth_tokens t ON u.id = t.user_id
            WHERE t.token_hash = :token LIMIT 1
        ");
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch();
    }

    if (!$user && !empty($adminEmailHeader)) {
        // Fallback match by X-Admin-Email header
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $adminEmailHeader]);
        $user = $stmt->fetch();
    }

    if (!$user) {
        response(false, 'Unauthorized. Token tidak valid atau sesi telah berakhir.', [], 401);
    }

    // 2. Fetch specific report detail if ID is specified
    if (isset($_GET['id']) && trim($_GET['id']) !== '') {
        $id = trim($_GET['id']);
        $stmt = $pdo->prepare("
            SELECT
                id,
                title,
                description,
                work_category,
                user_email,
                user_name,
                project_name,
                report_date,
                duration,
                obstacles,
                next_plan,
                progress,
                status,
                cover_url,
                created_by,
                created_at,
                updated_at
            FROM daily_reports
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $id]);
        $report = $stmt->fetch();

        if (!$report) {
            response(false, 'Laporan tidak ditemukan.', [], 404);
        }

        response(true, 'Berhasil mengambil detail laporan.', [
            'data' => $report
        ], 200);
    }

    // 3. Fetch GLOBAL reports list for any authenticated user
    // NO user_email or created_by filter here - reports are GLOBAL for all logged-in users
    $stmt = $pdo->query("
        SELECT
            id,
            title,
            description,
            work_category,
            user_email,
            user_name,
            project_name,
            report_date,
            duration,
            obstacles,
            next_plan,
            progress,
            status,
            cover_url,
            created_by,
            created_at,
            updated_at
        FROM daily_reports
        ORDER BY report_date DESC, created_at DESC, id DESC
    ");
    $reports = $stmt->fetchAll();

    response(true, 'Berhasil mengambil seluruh laporan harian global.', [
        'data' => $reports,
        'reports' => $reports,
        'count' => count($reports)
    ], 200);

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem: ' . $e->getMessage(), [], 500);
}
