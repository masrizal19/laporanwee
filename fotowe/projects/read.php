<?php
// fotowe/projects/read.php - List all FOTOWE Shared Workspace projects
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    response(false, 'Metode request tidak diizinkan. Gunakan GET.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $userId = (int)$user['id'];
    $userEmail = strtolower(trim((string)$user['email']));
    $isAdmin = fotoweIsAdmin($user);

    $sql = "
        SELECT
            p.*,
            COALESCE(ab_agg.artboard_count, 0) AS artboard_count,
            COALESCE(sl_agg.photo_count, 0) AS photo_count,
            perm_me.permission AS my_granted_permission
        FROM fotowe_projects p
        LEFT JOIN (
            SELECT project_id, COUNT(*) AS artboard_count
            FROM fotowe_artboards
            GROUP BY project_id
        ) ab_agg ON ab_agg.project_id = p.id
        LEFT JOIN (
            SELECT a.project_id, COUNT(*) AS photo_count
            FROM fotowe_slots s
            JOIN fotowe_artboards a ON a.id = s.artboard_id
            WHERE s.status = 'filled' AND (s.photo_id IS NOT NULL OR s.photo_url IS NOT NULL)
            GROUP BY a.project_id
        ) sl_agg ON sl_agg.project_id = p.id
        LEFT JOIN fotowe_permissions perm_me
            ON perm_me.project_id = p.id
           AND (
               (:uid > 0 AND perm_me.user_id = :uid2)
               OR (:email <> '' AND LOWER(perm_me.user_email) = :email2)
           )
    ";

    if (!$isAdmin) {
        $sql .= "
            WHERE p.visibility = 'workspace'
               OR p.owner_user_id = :uid3
               OR (:email3 <> '' AND LOWER(p.owner_email) = :email4)
               OR perm_me.id IS NOT NULL
        ";
    }

    $sql .= " ORDER BY p.updated_at DESC, p.created_at DESC ";

    $stmt = $pdo->prepare($sql);
    $params = [
        'uid' => $userId,
        'uid2' => $userId,
        'email' => $userEmail,
        'email2' => $userEmail,
    ];
    if (!$isAdmin) {
        $params['uid3'] = $userId;
        $params['email3'] = $userEmail;
        $params['email4'] = $userEmail;
    }
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $projects = [];
    foreach ($rows as $row) {
        $ownerId = (int)$row['owner_user_id'];
        $ownerEmail = strtolower(trim((string)$row['owner_email']));
        $isOwner = ($ownerId > 0 && $ownerId === $userId) || ($ownerEmail !== '' && $ownerEmail === $userEmail);
        $grantedPerm = $row['my_granted_permission'] ? strtolower((string)$row['my_granted_permission']) : null;

        $canEdit = $isAdmin || $isOwner || $grantedPerm === 'editor';
        $canDelete = $isAdmin || $isOwner;
        $accessRole = $isAdmin ? 'admin' : ($isOwner ? 'owner' : ($grantedPerm === 'editor' ? 'editor' : 'viewer'));

        $projects[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'dpi' => (int)$row['dpi'],
            'color' => $row['color_mode'] === 'gray' ? 'gray' : 'rgb',
            'active' => (int)$row['active_artboard'],
            'n' => max(1, (int)$row['artboard_count']),
            'photos' => (int)$row['photo_count'],
            'thumbnail_url' => $row['thumbnail_url'] ?: null,
            'visibility' => $row['visibility'] ?: 'workspace',
            'version' => (int)$row['version'],
            'owner_user_id' => $ownerId,
            'owner_name' => $row['owner_name'] ?: $row['owner_email'],
            'owner_email' => $row['owner_email'],
            'is_owner' => $isOwner,
            'is_admin' => $isAdmin,
            'can_edit' => $canEdit,
            'can_delete' => $canDelete,
            'can_manage_permissions' => $isAdmin || $isOwner,
            'access_role' => $accessRole,
            'saved' => strtotime($row['updated_at']) ? strtotime($row['updated_at']) * 1000 : time() * 1000,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    response(true, 'Berhasil mengambil daftar project FOTOWE.', [
        'data' => $projects,
        'projects' => $projects,
        'count' => count($projects),
    ], 200);
} catch (Exception $e) {
    response(false, 'Gagal memuat daftar project FOTOWE dari database.', [], 500);
}
