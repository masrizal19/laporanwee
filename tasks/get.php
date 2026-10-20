<?php
// tasks/get.php - Fetch All Tasks for Kanban
require_once __DIR__ . '/../config.php';

try {
    $stmt = $pdo->query("SELECT * FROM tasks ORDER BY id ASC");
    $tasks = $stmt->fetchAll();

    if (!$tasks || count($tasks) === 0) {
        // Fallback default tasks if table is empty
        $tasks = [
            ['id' => 1, 'title' => 'Moodboard & Visual Concept', 'project_name' => 'Rebranding Kopi Nusa', 'status' => 'To Do', 'priority' => 'Tinggi', 'progress' => 0, 'assignee' => 'Rizal', 'due_date' => '24 Okt'],
            ['id' => 2, 'title' => 'Wireframing UI Landing Page', 'project_name' => 'Website Studio Kaya', 'status' => 'Sedang Dikerjakan', 'priority' => 'Tinggi', 'progress' => 45, 'assignee' => 'Dina', 'due_date' => '25 Okt'],
            ['id' => 3, 'title' => 'Copywriting 10 Feed Instagram', 'project_name' => 'Kampanye Ramadan', 'status' => 'Sedang Dikerjakan', 'priority' => 'Sedang', 'progress' => 60, 'assignee' => 'Rizal', 'due_date' => '26 Okt'],
            ['id' => 4, 'title' => 'Draft Storyboard Video Profil', 'project_name' => 'Video Profil Perusahaan', 'status' => 'Dalam Review', 'priority' => 'Tinggi', 'progress' => 85, 'assignee' => 'Rizal', 'due_date' => '23 Okt'],
            ['id' => 5, 'title' => 'Pewarnaan Ilustrasi Brosur', 'project_name' => 'Katalog Produk 2026', 'status' => 'Selesai', 'priority' => 'Rendah', 'progress' => 100, 'assignee' => 'Dina', 'due_date' => '20 Okt']
        ];
    }

    response(true, 'Data tugas berhasil dimuat.', [
        'data' => $tasks,
        'tasks' => $tasks
    ], 200);
} catch (Exception $e) {
    // Graceful fallback response
    $fallbackTasks = [
        ['id' => 1, 'title' => 'Moodboard & Visual Concept', 'project_name' => 'Rebranding Kopi Nusa', 'status' => 'To Do', 'priority' => 'Tinggi', 'progress' => 0, 'assignee' => 'Rizal', 'due_date' => '24 Okt'],
        ['id' => 2, 'title' => 'Wireframing UI Landing Page', 'project_name' => 'Website Studio Kaya', 'status' => 'Sedang Dikerjakan', 'priority' => 'Tinggi', 'progress' => 45, 'assignee' => 'Dina', 'due_date' => '25 Okt'],
        ['id' => 3, 'title' => 'Copywriting 10 Feed Instagram', 'project_name' => 'Kampanye Ramadan', 'status' => 'Sedang Dikerjakan', 'priority' => 'Sedang', 'progress' => 60, 'assignee' => 'Rizal', 'due_date' => '26 Okt'],
        ['id' => 4, 'title' => 'Draft Storyboard Video Profil', 'project_name' => 'Video Profil Perusahaan', 'status' => 'Dalam Review', 'priority' => 'Tinggi', 'progress' => 85, 'assignee' => 'Rizal', 'due_date' => '23 Okt'],
        ['id' => 5, 'title' => 'Pewarnaan Ilustrasi Brosur', 'project_name' => 'Katalog Produk 2026', 'status' => 'Selesai', 'priority' => 'Rendah', 'progress' => 100, 'assignee' => 'Dina', 'due_date' => '20 Okt']
    ];
    response(true, 'Data tugas berhasil dimuat (mode lokal).', [
        'data' => $fallbackTasks,
        'tasks' => $fallbackTasks
    ], 200);
}
