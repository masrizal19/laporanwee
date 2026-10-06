<?php
// realtime/poll.php - Global Realtime Polling Endpoint
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
        $stmt = $pdo->prepare("
            SELECT u.* FROM users u
            JOIN auth_tokens t ON u.id = t.user_id
            WHERE t.token_hash = :token LIMIT 1
        ");
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch();
    }

    if (!$user && !empty($adminEmailHeader)) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $adminEmailHeader]);
        $user = $stmt->fetch();
    }

    if (!$user) {
        response(false, 'Unauthorized. Token tidak valid atau sesi telah berakhir.', [], 401);
    }

    $since = isset($_GET['since']) ? trim($_GET['since']) : '';
    $serverTime = gmdate('Y-m-d\TH:i:s\Z');

    if (!empty($since)) {
        // Query global changes across ALL users since last sync timestamp
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
            WHERE updated_at > :since1 OR created_at > :since2
            ORDER BY updated_at DESC, created_at DESC
        ");
        $stmt->execute(['since1' => $since, 'since2' => $since]);
        $changedReports = $stmt->fetchAll();

        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM daily_reports");
        $countRow = $countStmt->fetch();
        $totalCount = (int)($countRow ? $countRow['total'] : 0);

        response(true, 'Sinkronisasi realtime berhasil.', [
            'changed' => count($changedReports) > 0,
            'reports' => $changedReports,
            'data' => $changedReports,
            'count' => $totalCount,
            'total_count' => $totalCount,
            'server_time' => $serverTime,
            'last_sync' => $serverTime
        ], 200);
    } else {
        // No since parameter provided: return latest server timestamp and count
        $stmt = $pdo->query("SELECT MAX(GREATEST(COALESCE(updated_at, created_at), COALESCE(created_at, updated_at))) as latest FROM daily_reports");
        $latestRow = $stmt->fetch();
        $latest = $latestRow && $latestRow['latest'] ? $latestRow['latest'] : $serverTime;

        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM daily_reports");
        $countRow = $countStmt->fetch();
        $totalCount = (int)($countRow ? $countRow['total'] : 0);

        response(true, 'Status realtime siap.', [
            'changed' => false,
            'reports' => [],
            'data' => [],
            'count' => $totalCount,
            'total_count' => $totalCount,
            'server_time' => $latest,
            'last_sync' => $latest
        ], 200);
    }

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem. Silakan hubungi administrator.', [], 500);
}
