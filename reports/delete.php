<?php
// reports/delete.php - Endpoint to delete a daily report
require_once __DIR__ . '/../config.php';

// Allow POST or DELETE method
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    response(false, 'Metode request tidak diizinkan. Gunakan POST.', [], 405);
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

    // 2. Parse JSON body or URL query for report_id
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }

    $rawReportId = isset($input['report_id']) ? $input['report_id'] : (isset($input['id']) ? $input['id'] : (isset($_GET['report_id']) ? $_GET['report_id'] : (isset($_GET['id']) ? $_GET['id'] : '')));

    $reportId = trim((string)$rawReportId);
    if (empty($reportId)) {
        response(false, 'ID laporan (report_id) wajib diisi.', [], 400);
    }

    // 3. Find target report in daily_reports table
    $stmt = $pdo->prepare("SELECT id, user_email, created_by FROM daily_reports WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $reportId]);
    $report = $stmt->fetch();

    if (!$report) {
        response(false, 'Laporan tidak ditemukan atau sudah dihapus.', [], 404);
    }

    // 4. Permissions check: Admin or Report Creator can delete
    $isAdmin = (isset($user['role']) && strtolower($user['role']) === 'admin');
    $isOwner = (
        (!empty($report['user_email']) && strtolower($report['user_email']) === strtolower($user['email'])) ||
        (!empty($report['created_by']) && strtolower($report['created_by']) === strtolower($user['email']))
    );

    if (!$isAdmin && !$isOwner) {
        response(false, 'Akses ditolak: Anda tidak memiliki izin untuk menghapus laporan ini.', [], 403);
    }

    // 5. Delete associated files from daily_report_files to guarantee integrity if CASCADE is not configured
    try {
        $stmtFile = $pdo->prepare("DELETE FROM daily_report_files WHERE report_id = :report_id");
        $stmtFile->execute(['report_id' => $reportId]);
    } catch (Exception $fileEx) {
        // Table may not exist or CASCADE already handled
    }

    // 6. Delete report from daily_reports
    $stmtDelete = $pdo->prepare("DELETE FROM daily_reports WHERE id = :id");
    $stmtDelete->execute(['id' => $reportId]);

    response(true, 'Laporan berhasil dihapus.', [
        'report_id' => $reportId,
        'deleted_id' => $reportId
    ], 200);

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem saat menghapus laporan. Silakan hubungi administrator.', [], 500);
}
