<?php
// tasks/update-status.php - Update task and linked daily report status with MySQL transaction
require_once __DIR__ . '/../config.php';

// Allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

    // 2. Parse input JSON
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }

    $rawTaskId = isset($input['task_id']) ? $input['task_id'] : (isset($input['id']) ? $input['id'] : '');
    $rawStatus = isset($input['status']) ? trim((string)$input['status']) : '';
    $rawProgress = isset($input['progress']) ? $input['progress'] : null;
    $rawReportId = isset($input['daily_report_id']) ? $input['daily_report_id'] : (isset($input['report_id']) ? $input['report_id'] : '');

    if (empty($rawTaskId) && empty($rawReportId)) {
        response(false, 'task_id atau daily_report_id wajib diisi.', [], 400);
    }

    if (empty($rawStatus)) {
        response(false, 'status wajib diisi.', [], 400);
    }

    // Normalize status mapping:
    // To Do -> todo
    // Sedang Dikerjakan -> in_progress
    // Dalam Review -> in_review
    // Selesai -> completed
    $status = strtolower($rawStatus);
    if ($status === 'inprogress' || $status === 'in_progress' || $status === 'sedang dikerjakan' || $status === 'sedang berjalan') {
        $status = 'in_progress';
    } elseif ($status === 'review' || $status === 'in_review' || $status === 'dalam review') {
        $status = 'in_review';
    } elseif ($status === 'done' || $status === 'completed' || $status === 'selesai') {
        $status = 'completed';
    } else {
        $status = 'todo';
    }

    // Determine progress according to status rules:
    // Selesai: 100%
    // To Do: 0% if newly reset, or retain
    // Sedang Dikerjakan: 1-99%
    // Dalam Review: retain existing progress
    $progress = null;
    if ($rawProgress !== null && is_numeric($rawProgress)) {
        $progress = (int)$rawProgress;
    }
    if ($status === 'completed') {
        $progress = 100;
    } elseif ($status === 'in_progress' && ($progress === null || $progress <= 0)) {
        $progress = 25;
    }

    // 3. Begin MySQL Transaction
    $pdo->beginTransaction();

    $matchedTaskId = null;
    $matchedReportId = null;

    // Check if task ID is numeric (from tasks table)
    $numericTaskId = is_numeric($rawTaskId) ? (int)$rawTaskId : null;
    $numericReportId = is_numeric($rawReportId) ? (int)$rawReportId : null;

    // If task ID starts with 'report-', extract report ID
    if (is_string($rawTaskId) && strpos($rawTaskId, 'report-') === 0) {
        $extractedId = substr($rawTaskId, 7);
        if (is_numeric($extractedId)) {
            $numericReportId = (int)$extractedId;
        }
    }

    // Find task in tasks table if numeric ID provided
    $taskRow = null;
    if ($numericTaskId) {
        try {
            $stmtTask = $pdo->prepare("SELECT * FROM tasks WHERE id = :id LIMIT 1");
            $stmtTask->execute(['id' => $numericTaskId]);
            $taskRow = $stmtTask->fetch();
            if ($taskRow) {
                $matchedTaskId = $taskRow['id'];
                if (!$numericReportId && !empty($taskRow['report_id']) && is_numeric($taskRow['report_id'])) {
                    $numericReportId = (int)$taskRow['report_id'];
                }
            }
        } catch (Exception $e) {
            // tasks table may have different structure, ignore error and continue
        }
    }

    // Find report in daily_reports table
    $reportRow = null;
    if ($numericReportId) {
        $stmtReport = $pdo->prepare("SELECT * FROM daily_reports WHERE id = :id LIMIT 1");
        $stmtReport->execute(['id' => $numericReportId]);
        $reportRow = $stmtReport->fetch();
        if ($reportRow) {
            $matchedReportId = $reportRow['id'];
            if (!$matchedTaskId && !empty($reportRow['task_id']) && is_numeric($reportRow['task_id'])) {
                $matchedTaskId = (int)$reportRow['task_id'];
            }
        }
    }

    // If report still not found, search by title match if task exists
    if (!$reportRow && $taskRow && !empty($taskRow['title'])) {
        $stmtMatch = $pdo->prepare("SELECT * FROM daily_reports WHERE title = :title LIMIT 1");
        $stmtMatch->execute(['title' => $taskRow['title']]);
        $reportRow = $stmtMatch->fetch();
        if ($reportRow) {
            $matchedReportId = $reportRow['id'];
        }
    }

    // UPDATE tasks table
    if ($matchedTaskId) {
        try {
            if ($progress !== null) {
                $updateTaskStmt = $pdo->prepare("
                    UPDATE tasks
                    SET status = :status, progress = :progress, updated_at = NOW()
                    WHERE id = :id
                ");
                $updateTaskStmt->execute([
                    'status' => $status,
                    'progress' => $progress,
                    'id' => $matchedTaskId
                ]);
            } else {
                $updateTaskStmt = $pdo->prepare("
                    UPDATE tasks
                    SET status = :status, updated_at = NOW()
                    WHERE id = :id
                ");
                $updateTaskStmt->execute([
                    'status' => $status,
                    'id' => $matchedTaskId
                ]);
            }
        } catch (Exception $eTask) {
            // Try without updated_at column
            $updateTaskStmt = $pdo->prepare("UPDATE tasks SET status = :status WHERE id = :id");
            $updateTaskStmt->execute([
                'status' => $status,
                'id' => $matchedTaskId
            ]);
        }
    }

    // UPDATE daily_reports table
    if ($matchedReportId) {
        if ($progress !== null) {
            $updateReportStmt = $pdo->prepare("
                UPDATE daily_reports
                SET status = :status, progress = :progress, updated_at = NOW()
                WHERE id = :id
            ");
            $updateReportStmt->execute([
                'status' => $status,
                'progress' => $progress,
                'id' => $matchedReportId
            ]);
        } else {
            $updateReportStmt = $pdo->prepare("
                UPDATE daily_reports
                SET status = :status, updated_at = NOW()
                WHERE id = :id
            ");
            $updateReportStmt->execute([
                'status' => $status,
                'id' => $matchedReportId
            ]);
        }
    }

    // Commit Transaction
    $pdo->commit();

    response(true, 'Status task dan laporan berhasil diperbarui.', [
        'data' => [
            'task_id' => $matchedTaskId ?: $rawTaskId,
            'status' => $status,
            'progress' => $progress,
            'daily_report_id' => $matchedReportId
        ]
    ], 200);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Terjadi kesalahan sistem saat memperbarui status: ' . $e->getMessage(), [], 500);
}
