<?php
// projects/get.php - Fetch All Projects
require_once __DIR__ . '/../config.php';

try {
    $stmt = $pdo->query("SELECT * FROM projects ORDER BY id ASC");
    $projects = $stmt->fetchAll();

    if (!$projects || count($projects) === 0) {
        $projects = [
            ['id' => 1, 'title' => 'Rebranding Kopi Nusa', 'desc' => 'Identitas visual dan kemasan', 'status' => 'On-Track', 'progress' => 78, 'avatars' => ['Ri', 'Di', '+3']],
            ['id' => 2, 'title' => 'Kampanye Ramadan', 'desc' => 'Konten sosial media 30 hari', 'status' => 'On-Track', 'progress' => 62, 'avatars' => ['Ri', 'Di', '+4']],
            ['id' => 3, 'title' => 'Website Studio Kaya', 'desc' => 'Desain dan pengembangan landing page', 'status' => 'Berisiko', 'progress' => 34, 'avatars' => ['Ri', 'Di', '+2']],
            ['id' => 4, 'title' => 'Video Profil Perusahaan', 'desc' => 'Naskah, syuting, dan penyuntingan', 'status' => 'On-Track', 'progress' => 91, 'avatars' => ['Ri', 'Di', '+3']],
            ['id' => 5, 'title' => 'Katalog Produk 2026', 'desc' => 'Layout cetak dan digital', 'status' => 'Berisiko', 'progress' => 48, 'avatars' => ['Ri', 'Di', '+2']],
            ['id' => 6, 'title' => 'Event Launching Q4', 'desc' => 'Dekorasi, rundown, dan publikasi', 'status' => 'On-Track', 'progress' => 55, 'avatars' => ['Ri', 'Di', '+5']]
        ];
    }

    response(true, 'Data proyek berhasil dimuat.', [
        'data' => $projects,
        'projects' => $projects
    ], 200);
} catch (Exception $e) {
    $fallbackProjects = [
        ['id' => 1, 'title' => 'Rebranding Kopi Nusa', 'desc' => 'Identitas visual dan kemasan', 'status' => 'On-Track', 'progress' => 78, 'avatars' => ['Ri', 'Di', '+3']],
        ['id' => 2, 'title' => 'Kampanye Ramadan', 'desc' => 'Konten sosial media 30 hari', 'status' => 'On-Track', 'progress' => 62, 'avatars' => ['Ri', 'Di', '+4']],
        ['id' => 3, 'title' => 'Website Studio Kaya', 'desc' => 'Desain dan pengembangan landing page', 'status' => 'Berisiko', 'progress' => 34, 'avatars' => ['Ri', 'Di', '+2']],
        ['id' => 4, 'title' => 'Video Profil Perusahaan', 'desc' => 'Naskah, syuting, dan penyuntingan', 'status' => 'On-Track', 'progress' => 91, 'avatars' => ['Ri', 'Di', '+3']],
        ['id' => 5, 'title' => 'Katalog Produk 2026', 'desc' => 'Layout cetak dan digital', 'status' => 'Berisiko', 'progress' => 48, 'avatars' => ['Ri', 'Di', '+2']],
        ['id' => 6, 'title' => 'Event Launching Q4', 'desc' => 'Dekorasi, rundown, dan publikasi', 'status' => 'On-Track', 'progress' => 55, 'avatars' => ['Ri', 'Di', '+5']]
    ];
    response(true, 'Data proyek berhasil dimuat (mode lokal).', [
        'data' => $fallbackProjects,
        'projects' => $fallbackProjects
    ], 200);
}
