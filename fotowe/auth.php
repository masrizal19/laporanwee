<?php
// fotowe/auth.php - LaporanWe Session Verification & Workspace RBAC Helpers

function fotoweGetAuthenticatedUser(PDO $pdo) {
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
    } elseif (isset($_GET['token']) && is_string($_GET['token'])) {
        $token = trim($_GET['token']);
    }

    if ($token === '') {
        response(false, 'Unauthorized. Token autentikasi LaporanWe diperlukan.', [], 401);
    }

    $hashedToken = hash('sha256', $token);
    $stmt = $pdo->prepare("
        SELECT u.*, t.expires_at
        FROM users u
        JOIN auth_tokens t ON u.id = t.user_id
        WHERE (t.token_hash = :token OR t.token_hash = :hashed_token)
        LIMIT 1
    ");
    $stmt->execute([
        'token' => $token,
        'hashed_token' => $hashedToken,
    ]);
    $user = $stmt->fetch();

    if (!$user) {
        response(false, 'Unauthorized. Token tidak valid atau sesi telah berakhir.', [], 401);
    }

    if (!empty($user['expires_at'])) {
        $expires = strtotime($user['expires_at']);
        if ($expires !== false && $expires < time()) {
            response(false, 'Unauthorized. Sesi token telah kedaluwarsa.', [], 401);
        }
    }

    if (isset($user['status']) && strtolower((string)$user['status']) !== 'active') {
        response(false, 'Akses ditolak. Akun LaporanWe Anda tidak aktif.', [], 403);
    }

    return $user;
}

function fotoweIsAdmin(array $user) {
    $role = strtolower(trim((string)($user['role'] ?? '')));
    if (in_array($role, ['admin', 'superadmin', 'administrator', 'owner', 'manager', 'admin_team'], true)) {
        return true;
    }
    return strpos($role, 'admin') !== false || strpos($role, 'owner') !== false;
}

function fotoweResolveAccess(PDO $pdo, array $project, array $user) {
    $userId = (int)$user['id'];
    $userEmail = strtolower(trim((string)($user['email'] ?? '')));
    $ownerId = (int)($project['owner_user_id'] ?? 0);
    $ownerEmail = strtolower(trim((string)($project['owner_email'] ?? '')));

    $isAdmin = fotoweIsAdmin($user);
    $isOwner = ($ownerId > 0 && $ownerId === $userId) || ($ownerEmail !== '' && $ownerEmail === $userEmail);

    $grantedPerm = null;
    if (!$isOwner && !$isAdmin) {
        $permStmt = $pdo->prepare("
            SELECT permission
            FROM fotowe_permissions
            WHERE project_id = :pid
              AND (
                (:uid > 0 AND user_id = :uid2)
                OR (:email <> '' AND LOWER(user_email) = :email2)
              )
            LIMIT 1
        ");
        $permStmt->execute([
            'pid' => $project['id'],
            'uid' => $userId,
            'uid2' => $userId,
            'email' => $userEmail,
            'email2' => $userEmail,
        ]);
        $row = $permStmt->fetch();
        if ($row) {
            $grantedPerm = strtolower((string)$row['permission']);
        }
    }

    $visibility = strtolower((string)($project['visibility'] ?? 'workspace'));
    $canView = $isAdmin || $isOwner || $visibility === 'workspace' || $grantedPerm !== null;
    $canEdit = $isAdmin || $isOwner || $grantedPerm === 'editor';
    $canDelete = $isAdmin || $isOwner;
    $canManagePermissions = $isAdmin || $isOwner;

    $accessRole = 'viewer';
    if ($isAdmin) {
        $accessRole = 'admin';
    } elseif ($isOwner) {
        $accessRole = 'owner';
    } elseif ($grantedPerm === 'editor') {
        $accessRole = 'editor';
    }

    return [
        'is_admin' => $isAdmin,
        'is_owner' => $isOwner,
        'can_view' => $canView,
        'can_edit' => $canEdit,
        'can_delete' => $canDelete,
        'can_manage_permissions' => $canManagePermissions,
        'access_role' => $accessRole,
    ];
}
