<?php
// ui-settings.php located in /api/ui/ui-settings.php
require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET' && $method !== 'POST') {
    response(false, 'Metode request tidak diizinkan.', [], 405);
}

try {
    if ($method === 'GET') {
        // Fetch latest UI settings record
        $stmt = $pdo->query("SELECT * FROM ui_settings ORDER BY id DESC LIMIT 1");
        $settings = $stmt->fetch();

        if (!$settings) {
            // Return default structure if table is empty
            $settings = [
                'primary_color' => '#4A55FF',
                'secondary_color' => '#19194D',
                'text_color' => '#19194D',
                'background_color' => '#F5F6FF',
                'font_family' => 'Poppins',
                'heading_font' => 'Poppins',
                'menu_icon_size' => 42,
                'menu_icon_stroke' => 2,
                'signout_icon_size' => 64,
                'logo_url' => null,
                'menu_icon_url' => null,
                'signout_icon_url' => null
            ];
        }

        response(true, 'Berhasil mengambil pengaturan UI', [
            'data' => [
                'id' => (int)($settings['id'] ?? 1),
                'primary_color' => $settings['primary_color'] ?? '#4A55FF',
                'secondary_color' => $settings['secondary_color'] ?? '#19194D',
                'text_color' => $settings['text_color'] ?? '#19194D',
                'background_color' => $settings['background_color'] ?? '#F5F6FF',
                'font_family' => $settings['font_family'] ?? 'Poppins',
                'heading_font' => $settings['heading_font'] ?? 'Poppins',
                'menu_icon_size' => (int)($settings['menu_icon_size'] ?? 42),
                'menu_icon_stroke' => (float)($settings['menu_icon_stroke'] ?? 2),
                'signout_icon_size' => (int)($settings['signout_icon_size'] ?? 64),
                'logo_url' => $settings['logo_url'] ?? null,
                'menu_icon_url' => $settings['menu_icon_url'] ?? null,
                'signout_icon_url' => $settings['signout_icon_url'] ?? null,
                'updated_at' => $settings['updated_at'] ?? null,
            ]
        ], 200);
    }

    if ($method === 'POST') {
        // Parse JSON input
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            response(false, 'Payload JSON tidak valid.', [], 400);
        }

        $primaryColor = $input['primary_color'] ?? '#4A55FF';
        $secondaryColor = $input['secondary_color'] ?? '#19194D';
        $textColor = $input['text_color'] ?? '#19194D';
        $bgColor = $input['background_color'] ?? '#F5F6FF';
        $fontFamily = $input['font_family'] ?? 'Poppins';
        $headingFont = $input['heading_font'] ?? 'Poppins';
        $menuIconSize = (int)($input['menu_icon_size'] ?? 42);
        $menuIconStroke = (float)($input['menu_icon_stroke'] ?? 2);
        $signoutIconSize = (int)($input['signout_icon_size'] ?? 64);
        $logoUrl = isset($input['logo_url']) ? $input['logo_url'] : null;
        $menuIconUrl = isset($input['menu_icon_url']) ? $input['menu_icon_url'] : null;
        $signoutIconUrl = isset($input['signout_icon_url']) ? $input['signout_icon_url'] : null;

        // Check if record exists
        $stmt = $pdo->query("SELECT id FROM ui_settings ORDER BY id DESC LIMIT 1");
        $existing = $stmt->fetch();

        if ($existing) {
            $update = $pdo->prepare("
                UPDATE ui_settings SET
                    primary_color = :primary_color,
                    secondary_color = :secondary_color,
                    text_color = :text_color,
                    background_color = :background_color,
                    font_family = :font_family,
                    heading_font = :heading_font,
                    menu_icon_size = :menu_icon_size,
                    menu_icon_stroke = :menu_icon_stroke,
                    signout_icon_size = :signout_icon_size,
                    logo_url = :logo_url,
                    menu_icon_url = :menu_icon_url,
                    signout_icon_url = :signout_icon_url,
                    updated_at = NOW()
                WHERE id = :id
            ");
            $update->execute([
                'primary_color' => $primaryColor,
                'secondary_color' => $secondaryColor,
                'text_color' => $textColor,
                'background_color' => $bgColor,
                'font_family' => $fontFamily,
                'heading_font' => $headingFont,
                'menu_icon_size' => $menuIconSize,
                'menu_icon_stroke' => $menuIconStroke,
                'signout_icon_size' => $signoutIconSize,
                'logo_url' => $logoUrl,
                'menu_icon_url' => $menuIconUrl,
                'signout_icon_url' => $signoutIconUrl,
                'id' => $existing['id']
            ]);
        } else {
            $insert = $pdo->prepare("
                INSERT INTO ui_settings (
                    primary_color, secondary_color, text_color, background_color,
                    font_family, heading_font, menu_icon_size, menu_icon_stroke,
                    signout_icon_size, logo_url, menu_icon_url, signout_icon_url, created_at, updated_at
                ) VALUES (
                    :primary_color, :secondary_color, :text_color, :background_color,
                    :font_family, :heading_font, :menu_icon_size, :menu_icon_stroke,
                    :signout_icon_size, :logo_url, :menu_icon_url, :signout_icon_url, NOW(), NOW()
                )
            ");
            $insert->execute([
                'primary_color' => $primaryColor,
                'secondary_color' => $secondaryColor,
                'text_color' => $textColor,
                'background_color' => $bgColor,
                'font_family' => $fontFamily,
                'heading_font' => $headingFont,
                'menu_icon_size' => $menuIconSize,
                'menu_icon_stroke' => $menuIconStroke,
                'signout_icon_size' => $signoutIconSize,
                'logo_url' => $logoUrl,
                'menu_icon_url' => $menuIconUrl,
                'signout_icon_url' => $signoutIconUrl
            ]);
        }

        response(true, 'Pengaturan UI berhasil disimpan.', [
            'data' => $input
        ], 200);
    }

} catch (Exception $e) {
    response(false, 'Terjadi kesalahan sistem: ' . $e->getMessage(), [], 500);
}
?>
