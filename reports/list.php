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
                r.id,
                r.title,
                r.description,
                r.work_category,
                r.user_email,
                r.user_name,
                r.project_name,
                r.report_date,
                r.duration,
                r.obstacles,
                r.next_plan,
                r.progress,
                r.status,
                r.cover_url,
                r.created_by,
                r.created_at,
                r.updated_at,
                (
                    SELECT f.file_url 
                    FROM daily_report_files f 
                    WHERE f.report_id = r.id 
                      AND f.file_category = 'proof' 
                      AND (f.mime_type LIKE 'image/%' OR f.file_url LIKE '%.jpg' OR f.file_url LIKE '%.jpeg' OR f.file_url LIKE '%.png' OR f.file_url LIKE '%.webp' OR f.file_url LIKE '%.gif')
                    ORDER BY f.id ASC 
                    LIMIT 1
                ) AS proof_cover_url
            FROM daily_reports r
            WHERE r.id = :id
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
            r.id,
            r.title,
            r.description,
            r.work_category,
            r.user_email,
            r.user_name,
            r.project_name,
            r.report_date,
            r.duration,
            r.obstacles,
            r.next_plan,
            r.progress,
            r.status,
            r.cover_url,
            r.created_by,
            r.created_at,
            r.updated_at,
            (
                SELECT f.file_url 
                FROM daily_report_files f 
                WHERE f.report_id = r.id 
                  AND f.file_category = 'proof' 
                  AND (f.mime_type LIKE 'image/%' OR f.file_url LIKE '%.jpg' OR f.file_url LIKE '%.jpeg' OR f.file_url LIKE '%.png' OR f.file_url LIKE '%.webp' OR f.file_url LIKE '%.gif')
                ORDER BY f.id ASC 
                LIMIT 1
            ) AS proof_cover_url
        FROM daily_reports r
        ORDER BY r.report_date DESC, r.created_at DESC, r.id DESC
    ");
    $reports = $stmt->fetchAll();

    response(true, 'Berhasil mengambil seluruh laporan harian global.', [
        'data' => $reports,
        'reports' => $reports,
        'count' => count($reports)
    ], 200);

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem. Silakan hubungi administrator.', [], 500);
}
