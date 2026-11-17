<?php
// fotowe/projects/detail.php - Fetch full FOTOWE project with artboards, slots, photo URLs, and permissions
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    response(false, 'Metode request tidak diizinkan. Gunakan GET.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $projectId = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

    if ($projectId === '') {
        response(false, 'Parameter id project wajib diisi.', [], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM fotowe_projects WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $projectId]);
    $project = $stmt->fetch();

    if (!$project) {
        response(false, 'Project tidak ditemukan atau sudah dihapus.', [], 404);
    }

    $access = fotoweResolveAccess($pdo, $project, $user);
    if (!$access['can_view']) {
        response(false, 'Akses ditolak. Anda tidak memiliki izin untuk membuka project ini.', [], 403);
    }

    // Fetch artboards ordered
    $abStmt = $pdo->prepare("
        SELECT * FROM fotowe_artboards
        WHERE project_id = :pid
        ORDER BY sort_order ASC, id ASC
    ");
    $abStmt->execute(['pid' => $projectId]);
    $abRows = $abStmt->fetchAll();

    // Fetch all slots across project artboards in one query
    $slotStmt = $pdo->prepare("
        SELECT s.*, p.file_url AS joined_file_url, p.thumb_url AS joined_thumb_url, p.file_size AS joined_file_size
        FROM fotowe_slots s
        JOIN fotowe_artboards a ON a.id = s.artboard_id
        LEFT JOIN fotowe_photos p ON p.id = s.photo_id
        WHERE a.project_id = :pid
        ORDER BY s.artboard_id ASC, s.slot_index ASC
    ");
    $slotStmt->execute(['pid' => $projectId]);
    $slotRows = $slotStmt->fetchAll();

    $apiBase = fotoweGetApiBaseUrl();
    $slotsByAb = [];
    foreach ($slotRows as $sr) {
        $abId = $sr['artboard_id'];
        if (!isset($slotsByAb[$abId])) {
            $slotsByAb[$abId] = [];
        }
        $idx = (int)$sr['slot_index'];
        $photoId = $sr['photo_id'] ? (int)$sr['photo_id'] : null;
        $photoUrl = $sr['joined_file_url'] ?: $sr['photo_url'];
        $thumbUrl = $sr['joined_thumb_url'] ?: ($sr['thumb_url'] ?: $photoUrl);
        $corsUrl = $photoId ? ($apiBase . '/file.php?id=' . $photoId) : $photoUrl;

        $slotsByAb[$abId][$idx] = [
            'slot_index' => $idx,
            'photo_id' => $photoId,
            'photo_url' => $photoUrl,
            'cors_url' => $corsUrl,
            'thumb_url' => $thumbUrl,
            'name' => $sr['photo_name'] ?: 'foto.jpg',
            'file_size' => (int)($sr['joined_file_size'] ?: $sr['file_size']),
            'z' => (float)$sr['zoom'],
            'ox' => (float)$sr['offset_x'],
            'oy' => (float)$sr['offset_y'],
            'status' => $sr['status'] === 'filled' ? 'filled' : 'empty',
        ];
    }

    $artboards = [];
    foreach ($abRows as $abRow) {
        $abId = $abRow['id'];
        $slotMap = isset($slotsByAb[$abId]) ? $slotsByAb[$abId] : [];
        $maxIndex = empty($slotMap) ? -1 : max(array_keys($slotMap));
        $orderedSlots = [];
        for ($i = 0; $i <= $maxIndex; $i++) {
            if (isset($slotMap[$i])) {
                $orderedSlots[] = $slotMap[$i];
            } else {
                $orderedSlots[] = [
                    'slot_index' => $i,
                    'photo_id' => null,
                    'photo_url' => null,
                    'cors_url' => null,
                    'thumb_url' => null,
                    'name' => '',
                    'file_size' => 0,
                    'z' => 1,
                    'ox' => 0,
                    'oy' => 0,
                    'status' => 'empty',
                ];
            }
        }

        $artboards[] = [
            'id' => $abId,
            'name' => $abRow['name'],
            't' => $abRow['template_code'] ?: '4R',
            's' => (int)$abRow['photo_size_index'],
            'a' => (int)$abRow['active_slot'],
            'thumbnail_url' => $abRow['thumbnail_url'] ?: null,
            'slots' => $orderedSlots,
        ];
    }

    // Fetch permissions list (emails/roles)
    $permStmt = $pdo->prepare("
        SELECT fp.id, fp.user_id, fp.user_email, fp.permission, u.full_name
        FROM fotowe_permissions fp
        LEFT JOIN users u ON (fp.user_id = u.id OR LOWER(fp.user_email) = LOWER(u.email))
        WHERE fp.project_id = :pid
        ORDER BY fp.id ASC
    ");
    $permStmt->execute(['pid' => $projectId]);
    $permRows = $permStmt->fetchAll();

    $permissions = [];
    foreach ($permRows as $pr) {
        $permissions[] = [
            'user_id' => $pr['user_id'] ? (int)$pr['user_id'] : null,
            'user_email' => $pr['user_email'],
            'full_name' => $pr['full_name'] ?: $pr['user_email'],
            'permission' => $pr['permission'] === 'viewer' ? 'viewer' : 'editor',
        ];
    }

    $detail = [
        'id' => $project['id'],
        'name' => $project['name'],
        'dpi' => (int)$project['dpi'],
        'color' => $project['color_mode'] === 'gray' ? 'gray' : 'rgb',
        'active' => (int)$project['active_artboard'],
        'thumbnail_url' => $project['thumbnail_url'] ?: null,
        'visibility' => $project['visibility'] ?: 'workspace',
        'version' => (int)$project['version'],
        'owner_user_id' => (int)$project['owner_user_id'],
        'owner_name' => $project['owner_name'] ?: $project['owner_email'],
        'owner_email' => $project['owner_email'],
        'is_owner' => $access['is_owner'],
        'is_admin' => $access['is_admin'],
        'can_edit' => $access['can_edit'],
        'can_delete' => $access['can_delete'],
        'can_manage_permissions' => $access['can_manage_permissions'],
        'access_role' => $access['access_role'],
        'saved' => strtotime($project['updated_at']) ? strtotime($project['updated_at']) * 1000 : time() * 1000,
        'updated_at' => $project['updated_at'],
        'artboards' => $artboards,
        'permissions' => $permissions,
    ];

    response(true, 'Berhasil mengambil detail project.', [
        'data' => $detail,
    ], 200);
} catch (Exception $e) {
    response(false, 'Gagal mengambil detail project FOTOWE.', [], 500);
}
