<?php
// fotowe/projects/create.php - Create FOTOWE project (supports full artboards/slots & IndexedDB migration)
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(false, 'Metode request tidak diizinkan. Gunakan POST.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        response(false, 'Payload JSON tidak valid.', [], 400);
    }

    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        response(false, 'Nama project wajib diisi.', [], 400);
    }
    $name = mb_substr($name, 0, 120);

    $projectId = !empty($input['id']) ? fotoweNormalizeId($input['id'], 'ftw_') : ('ftw_' . bin2hex(random_bytes(8)));
    $dpi = isset($input['dpi']) ? max(72, min(1200, (int)$input['dpi'])) : 300;
    $rawColor = strtolower((string)($input['color'] ?? ($input['color_mode'] ?? 'rgb')));
    $colorMode = $rawColor === 'gray' ? 'gray' : 'rgb';
    $activeAb = isset($input['active']) ? max(0, (int)$input['active']) : 0;
    $visibility = (isset($input['visibility']) && $input['visibility'] === 'private') ? 'private' : 'workspace';
    $artboards = isset($input['artboards']) && is_array($input['artboards']) ? $input['artboards'] : [];
    $permissions = isset($input['permissions']) && is_array($input['permissions']) ? $input['permissions'] : [];

    // Check if ID already exists (idempotent migration guard)
    $existStmt = $pdo->prepare("SELECT * FROM fotowe_projects WHERE id = :id LIMIT 1");
    $existStmt->execute(['id' => $projectId]);
    $existing = $existStmt->fetch();
    if ($existing) {
        $isOwnerOrAdmin = fotoweIsAdmin($user)
            || (int)$existing['owner_user_id'] === (int)$user['id']
            || strtolower((string)$existing['owner_email']) === strtolower((string)$user['email']);
        if (!$isOwnerOrAdmin) {
            // Generate distinct ID so no collision with another user's project
            $projectId = 'ftw_' . bin2hex(random_bytes(8));
        } else {
            response(true, 'Project sudah tersedia di server.', [
                'data' => [
                    'id' => $existing['id'],
                    'name' => $existing['name'],
                    'already_exists' => true,
                    'version' => (int)$existing['version'],
                ]
            ], 200);
        }
    }

    $thumbUrl = !empty($input['thumbnail_url']) ? (string)$input['thumbnail_url'] : null;
    if (!empty($input['thumbnail_data'])) {
        $savedCover = fotoweSaveBase64Cover($input['thumbnail_data'], $projectId);
        if ($savedCover) {
            $thumbUrl = $savedCover;
        }
    }

    $ownerId = (int)$user['id'];
    $ownerName = trim((string)($user['full_name'] ?? ($user['name'] ?? $user['email'])));
    $ownerEmail = trim((string)$user['email']);

    $pdo->beginTransaction();

    $insProj = $pdo->prepare("
        INSERT INTO fotowe_projects
            (id, name, dpi, color_mode, active_artboard, owner_user_id, owner_name, owner_email, thumbnail_url, visibility, version)
        VALUES
            (:id, :name, :dpi, :color_mode, :active_artboard, :owner_user_id, :owner_name, :owner_email, :thumbnail_url, :visibility, 1)
    ");
    $insProj->execute([
        'id' => $projectId,
        'name' => $name,
        'dpi' => $dpi,
        'color_mode' => $colorMode,
        'active_artboard' => $activeAb,
        'owner_user_id' => $ownerId,
        'owner_name' => mb_substr($ownerName, 0, 160),
        'owner_email' => mb_substr($ownerEmail, 0, 191),
        'thumbnail_url' => $thumbUrl,
        'visibility' => $visibility,
    ]);

    $allowedTemplates = ['2R', '3R', '4R', '5R', '6R', '8R', 'A4'];
    if (empty($artboards)) {
        $artboards = [[
            'id' => fotoweNormalizeId('', 'ab_'),
            'name' => 'Artboard 1',
            't' => '4R',
            's' => 1,
            'a' => 0,
            'slots' => [],
        ]];
    }

    $insAb = $pdo->prepare("
        INSERT INTO fotowe_artboards
            (id, project_id, sort_order, name, template_code, photo_size_index, active_slot, thumbnail_url)
        VALUES
            (:id, :project_id, :sort_order, :name, :template_code, :photo_size_index, :active_slot, :thumbnail_url)
    ");
    $insSlot = $pdo->prepare("
        INSERT INTO fotowe_slots
            (artboard_id, slot_index, photo_id, photo_url, thumb_url, photo_name, file_size, zoom, offset_x, offset_y, status)
        VALUES
            (:artboard_id, :slot_index, :photo_id, :photo_url, :thumb_url, :photo_name, :file_size, :zoom, :offset_x, :offset_y, :status)
    ");

    foreach ($artboards as $ord => $ab) {
        if (!is_array($ab)) continue;
        $rawAbId = !empty($ab['id']) ? (string)$ab['id'] : ('ab_' . $ord . '_' . bin2hex(random_bytes(4)));
        if (strpos($rawAbId, $projectId . '_') === 0) {
            $abId = fotoweNormalizeId($rawAbId, 'ab_');
        } else {
            $abId = fotoweNormalizeId($projectId . '_' . $rawAbId, 'ab_');
        }
        $abName = trim((string)($ab['name'] ?? ('Artboard ' . ($ord + 1))));
        $tpl = in_array(($ab['t'] ?? '4R'), $allowedTemplates, true) ? $ab['t'] : '4R';
        $szIdx = isset($ab['s']) ? max(0, min(2, (int)$ab['s'])) : 1;
        $actSlot = isset($ab['a']) ? max(0, (int)$ab['a']) : 0;
        $abThumb = !empty($ab['thumbnail_url']) ? (string)$ab['thumbnail_url'] : null;

        $insAb->execute([
            'id' => $abId,
            'project_id' => $projectId,
            'sort_order' => (int)$ord,
            'name' => mb_substr($abName ?: ('Artboard ' . ($ord + 1)), 0, 120),
            'template_code' => $tpl,
            'photo_size_index' => $szIdx,
            'active_slot' => $actSlot,
            'thumbnail_url' => $abThumb,
        ]);

        $slots = isset($ab['slots']) && is_array($ab['slots']) ? $ab['slots'] : [];
        foreach ($slots as $sIdx => $slot) {
            if (!is_array($slot)) continue;
            $status = (isset($slot['status']) && $slot['status'] === 'filled') ? 'filled' : 'empty';
            $photoId = !empty($slot['photo_id']) ? (int)$slot['photo_id'] : null;
            $photoUrl = !empty($slot['photo_url']) ? (string)$slot['photo_url'] : null;
            if ($status !== 'filled' || (!$photoId && !$photoUrl)) {
                continue;
            }
            $insSlot->execute([
                'artboard_id' => $abId,
                'slot_index' => (int)($slot['slot_index'] ?? $sIdx),
                'photo_id' => $photoId,
                'photo_url' => $photoUrl,
                'thumb_url' => !empty($slot['thumb_url']) ? (string)$slot['thumb_url'] : $photoUrl,
                'photo_name' => mb_substr((string)($slot['name'] ?? 'foto.jpg'), 0, 255),
                'file_size' => max(0, (int)($slot['file_size'] ?? 0)),
                'zoom' => isset($slot['z']) ? (float)$slot['z'] : 1.0,
                'offset_x' => isset($slot['ox']) ? (float)$slot['ox'] : 0.0,
                'offset_y' => isset($slot['oy']) ? (float)$slot['oy'] : 0.0,
                'status' => 'filled',
            ]);
        }
    }

    if (!empty($permissions)) {
        $insPerm = $pdo->prepare("
            INSERT INTO fotowe_permissions (project_id, user_id, user_email, permission, granted_by)
            VALUES (:pid, :uid, :email, :perm, :by)
            ON DUPLICATE KEY UPDATE permission = VALUES(permission), user_id = VALUES(user_id)
        ");
        foreach ($permissions as $pr) {
            if (!is_array($pr) || empty($pr['user_email'])) continue;
            $pEmail = strtolower(trim((string)$pr['user_email']));
            if ($pEmail === '' || $pEmail === strtolower($ownerEmail)) continue;
            $permVal = (isset($pr['permission']) && $pr['permission'] === 'viewer') ? 'viewer' : 'editor';
            $insPerm->execute([
                'pid' => $projectId,
                'uid' => !empty($pr['user_id']) ? (int)$pr['user_id'] : null,
                'email' => mb_substr($pEmail, 0, 191),
                'perm' => $permVal,
                'by' => $ownerId,
            ]);
        }
    }

    $pdo->commit();

    response(true, 'Project FOTOWE berhasil disimpan ke server.', [
        'data' => [
            'id' => $projectId,
            'name' => $name,
            'dpi' => $dpi,
            'color' => $colorMode,
            'active' => $activeAb,
            'thumbnail_url' => $thumbUrl,
            'owner_user_id' => $ownerId,
            'owner_name' => $ownerName,
            'owner_email' => $ownerEmail,
            'is_owner' => true,
            'can_edit' => true,
            'can_delete' => true,
            'can_manage_permissions' => true,
            'access_role' => fotoweIsAdmin($user) ? 'admin' : 'owner',
            'version' => 1,
            'saved' => time() * 1000,
        ]
    ], 201);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Gagal membuat project FOTOWE di database.', [], 500);
}
