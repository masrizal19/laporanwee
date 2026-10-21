// Render Tampilan UI Setting
function renderUiSettingsView() {
  const currentTheme = document.documentElement.dataset.theme || 'light';
  return `
  <div class="head">
    <div class="grow rv" style="--i:0">
      <h1>UI Setting</h1>
      <p>Kustomisasi tema sistem, warna aksen neon glass, dan visual workspace.</p>
    </div>
  </div>
  <div class="grid">
    <section class="card c12 rv" style="--i:1">
      <div class="inner" style="max-width: 720px; margin: auto; display: flex; flex-direction: column; gap: 24px;">
        <div>
          <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 10px;">Pilihan Mode Tema</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <button type="button" class="cta" style="height: 52px; border-radius: 18px; justify-content: center; background: ${currentTheme === 'light' ? 'var(--dark)' : 'var(--glass-solid)'}; color: ${currentTheme === 'light' ? 'var(--on-dark)' : 'var(--ink)'}; border: 1px solid var(--line);" onclick="applyAppTheme('light')">
              Mode Terang (Light)
            </button>
            <button type="button" class="cta" style="height: 52px; border-radius: 18px; justify-content: center; background: ${currentTheme === 'dark' ? 'var(--dark)' : 'var(--glass-solid)'}; color: ${currentTheme === 'dark' ? 'var(--on-dark)' : 'var(--ink)'}; border: 1px solid var(--line);" onclick="applyAppTheme('dark')">
              Mode Gelap (Dark)
            </button>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 10px;">Warna Utama Aksen (Primary Color)</label>
          <div style="display: flex; gap: 14px; align-items: center;">
            <input type="color" id="uiColorPicker" value="#4d88ff" style="width: 58px; height: 48px; border: 0; background: none; cursor: pointer; border-radius: 12px;">
            <input id="uiColorHex" class="inp" style="flex: 1; height: 50px; padding: 0 16px; border-radius: 16px;" value="#4d88ff">
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
          <button class="cta" id="btnSaveUiConfig" style="height: 48px; padding: 0 28px;">Simpan Setelan UI</button>
        </div>
      </div>
    </section>
  </div>
  `;
}

// Logika Ganti Tema & Simpan UI Settings
function applyAppTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  const knob = document.querySelector('.theme .knob');
  if (knob) knob.style.transform = theme === 'dark' ? 'translateX(36px)' : 'translateX(0)';
}

async function handleSaveUiConfig() {
  const btn = document.getElementById('btnSaveUiConfig');
  const primaryColor = document.getElementById('uiColorHex').value.trim();
  const theme = document.documentElement.dataset.theme || 'light';

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    await fetch('[https://api-laporanwe.mkverse.my.id/api/ui-settings.php](https://api-laporanwe.mkverse.my.id/api/ui-settings.php)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ primary_color: primaryColor, theme_mode: theme })
    });
    alert('Pengaturan UI berhasil disimpan!');
  } catch (err) {
    console.error('Gagal menyimpan setelan UI:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Setelan UI'; }
  }
}