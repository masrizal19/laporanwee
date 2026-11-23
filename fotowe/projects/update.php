<?php
// fotowe/projects/update.php - Update FOTOWE project, artboards, slots, cover, and permissions with RBAC
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

try {
    fotoweEnsureSchema($pdo);
    $user = fotoweGetAuthenticatedUser($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        response(false, 'Payload JSON tidak valid.', [], 400);
    }

    $projectId = trim((string)($input['id'] ?? ''));
    if ($projectId === '') {
        response(false, 'Parameter id project wajib diisi.', [], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM fotowe_projects WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $projectId]);
    $project = $stmt->fetch();

    if (!$project) {
        response(false, 'Project tidak ditemukan.', [], 404);
    }

    $access = fotoweResolveAccess($pdo, $project, $user);
    if (!$access['can_edit']) {
        response(false, 'Akses ditolak. Anda hanya memiliki izin melihat project ini.', [], 403);
    }

    $name = isset($input['name']) && trim((string)$input['name']) !== ''
        ? mb_substr(trim((string)$input['name']), 0, 120)
        : $project['name'];
    $dpi = isset($input['dpi']) ? max(72, min(1200, (int)$input['dpi'])) : (int)$project['dpi'];
    $rawColor = strtolower((string)($input['color'] ?? ($input['color_mode'] ?? $project['color_mode'])));
    $colorMode = $rawColor === 'gray' ? 'gray' : 'rgb';
    $activeAb = isset($input['active']) ? max(0, (int)$input['active']) : (int)$project['active_artboard'];
    $visibility = isset($input['visibility'])
        ? ($input['visibility'] === 'private' ? 'private' : 'workspace')
        : $project['visibility'];

    $oldThumbUrl = $project['thumbnail_url'];
    $thumbUrl = isset($input['thumbnail_url']) ? $input['thumbnail_url'] : $oldThumbUrl;
    $thumbDataInput = !empty($input['thumbnail_data'])
        ? $input['thumbnail_data']
        : (!empty($input['thumbnail']) ? $input['thumbnail'] : null);
    if (!empty($thumbDataInput)) {
        $savedCover = fotoweSaveBase64Cover($thumbDataInput, $projectId);
        if ($savedCover) {
            $thumbUrl = $savedCover;
        }
    }

    $artboardsInput = isset($input['artboards']) && is_array($input['artboards'])
        ? $input['artboards']
        : (isset($input['pages']) && is_array($input['pages']) ? $input['pages'] : null);

    $pdo->beginTransaction();

    $updProj = $pdo->prepare("
        UPDATE fotowe_projects
        SET name = :name,
            dpi = :dpi,
            color_mode = :color_mode,
            active_artboard = :active_artboard,
            thumbnail_url = :thumbnail_url,
            visibility = :visibility,
            version = version + 1,
            updated_at = NOW()
        WHERE id = :id
    ");
    $updProj->execute([
        'name' => $name,
        'dpi' => $dpi,
        'color_mode' => $colorMode,
        'active_artboard' => $activeAb,
        'thumbnail_url' => $thumbUrl,
        'visibility' => $visibility,
        'id' => $projectId,
    ]);

    if (is_array($artboardsInput)) {
        // Delete old artboards for this project (cascades fotowe_slots cleanly)
        $delAbs = $pdo->prepare("DELETE FROM fotowe_artboards WHERE project_id = :pid");
        $delAbs->execute(['pid' => $projectId]);

        $allowedTemplates = ['2R', '3R', '4R', '5R', '6R', '8R', 'A4'];
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

        foreach ($artboardsInput as $ord => $ab) {
            if (!is_array($ab)) continue;
            $rawAbId = !empty($ab['id']) ? (string)$ab['id'] : ('ab_' . $ord . '_' . bin2hex(random_bytes(4)));
            // Preserve prefixed ID if already scoped, otherwise namespace by projectId
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
    }

    // Only Owner or Admin can modify collaborator permissions
    if (
        (isset($input['permissions']) && is_array($input['permissions'])) ||
        (isset($input['shared_editors']) && is_array($input['shared_editors']))
    ) {
        if (!$access['can_manage_permissions']) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            response(false, 'Hanya pemilik project atau Admin yang dapat mengubah izin kolaborator.', [], 403);
        }

        $delPerm = $pdo->prepare("DELETE FROM fotowe_permissions WHERE project_id = :pid");
        $delPerm->execute(['pid' => $projectId]);

        $insPerm = $pdo->prepare("
            INSERT INTO fotowe_permissions (project_id, user_id, user_email, permission, granted_by)
            VALUES (:pid, :uid, :email, :perm, :by)
            ON DUPLICATE KEY UPDATE permission = VALUES(permission), user_id = VALUES(user_id)
        ");
        $ownerEmailLower = strtolower(trim((string)$project['owner_email']));
        $normalizedPermissions = [];

        if (isset($input['permissions']) && is_array($input['permissions'])) {
            foreach ($input['permissions'] as $pr) {
                if (!is_array($pr) || empty($pr['user_email'])) continue;
                $pEmail = strtolower(trim((string)$pr['user_email']));
                if ($pEmail === '' || $pEmail === $ownerEmailLower) continue;
                $permVal = (isset($pr['permission']) && $pr['permission'] === 'viewer') ? 'viewer' : 'editor';
                $normalizedPermissions[$pEmail] = [
                    'user_id' => !empty($pr['user_id']) ? (int)$pr['user_id'] : null,
                    'user_email' => $pEmail,
                    'permission' => $permVal,
                ];
            }
        }

        if (isset($input['shared_editors']) && is_array($input['shared_editors'])) {
            foreach ($input['shared_editors'] as $ed) {
                if (is_numeric($ed)) {
                    $uStmt = $pdo->prepare("SELECT id, email FROM users WHERE id = :id LIMIT 1");
                    $uStmt->execute(['id' => (int)$ed]);
                    $uRow = $uStmt->fetch();
                    if ($uRow && !empty($uRow['email'])) {
                        $pEmail = strtolower(trim((string)$uRow['email']));
                        if ($pEmail !== '' && $pEmail !== $ownerEmailLower) {
                            $normalizedPermissions[$pEmail] = [
                                'user_id' => (int)$uRow['id'],
                                'user_email' => $pEmail,
                                'permission' => 'editor',
                            ];
                        }
                    }
                } elseif (is_string($ed) && trim($ed) !== '') {
                    $pEmail = strtolower(trim($ed));
                    if ($pEmail !== $ownerEmailLower && !isset($normalizedPermissions[$pEmail])) {
                        $uStmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
                        $uStmt->execute(['email' => $pEmail]);
                        $uRow = $uStmt->fetch();
                        $normalizedPermissions[$pEmail] = [
                            'user_id' => $uRow ? (int)$uRow['id'] : null,
                            'user_email' => $pEmail,
                            'permission' => 'editor',
                        ];
                    }
                }
            }
        }

        foreach ($normalizedPermissions as $pr) {
            $insPerm->execute([
                'pid' => $projectId,
                'uid' => $pr['user_id'],
                'email' => mb_substr($pr['user_email'], 0, 191),
                'perm' => $pr['permission'],
                'by' => (int)$user['id'],
            ]);
        }
    }

    $pdo->commit();

    // Remove replaced cover file if old cover differs
    if ($oldThumbUrl && $thumbUrl && $oldThumbUrl !== $thumbUrl) {
        $oldPathPart = parse_url($oldThumbUrl, PHP_URL_PATH);
        if ($oldPathPart && strpos($oldPathPart, '/uploads/fotowe/covers/') !== false) {
            $oldDisk = fotoweGetUploadRootDir() . '/covers/' . basename($oldPathPart);
            if (file_exists($oldDisk) && is_file($oldDisk)) {
                @unlink($oldDisk);
            }
        }
    }

    response(true, 'Perubahan project berhasil disinkronkan ke server.', [
        'data' => [
            'id' => $projectId,
            'name' => $name,
            'dpi' => $dpi,
            'color' => $colorMode,
            'active' => $activeAb,
            'thumbnail_url' => $thumbUrl,
            'version' => (int)$project['version'] + 1,
            'saved' => time() * 1000,
        ]
    ], 200);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    response(false, 'Gagal memperbarui project FOTOWE di server.', [], 500);
}
