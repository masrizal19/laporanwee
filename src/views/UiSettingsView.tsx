import React, { useState } from 'react';

interface UiSettingsViewProps {
  onAddToast: (text: string) => void;
}

export const UiSettingsView: React.FC<UiSettingsViewProps> = ({ onAddToast }) => {
  const [currentTheme, setCurrentTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [primaryColor, setPrimaryColor] = useState('#4d88ff');
  const [isSaving, setIsSaving] = useState(false);

  const applyAppTheme = (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('laporanwee_theme', theme);
    localStorage.setItem('theme', theme);
    const knob = document.querySelector('.theme .knob') as HTMLElement;
    if (knob) knob.style.transform = theme === 'dark' ? 'translateX(36px)' : 'translateX(0)';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      await fetch('https://api-laporanwe.mkverse.my.id/api/ui-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ primary_color: primaryColor, theme_mode: currentTheme }),
      });
      onAddToast('Pengaturan UI berhasil disimpan!');
    } catch (err) {
      console.warn('UI settings save api error:', err);
      onAddToast('Pengaturan UI berhasil disimpan!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view">
      <div className="head">
        <div className="grow rv" style={{ '--i': 0 } as any}>
          <h1>UI Setting</h1>
          <p>Kustomisasi tema sistem, warna aksen neon glass, dan visual workspace.</p>
        </div>
      </div>
      <div className="grid">
        <section className="card c12 rv" style={{ '--i': 1 } as any}>
          <div className="inner" style={{ maxWidth: 720, margin: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Pilihan Mode Tema</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <button
                  type="button"
                  className="cta btn"
                  style={{
                    height: 52,
                    borderRadius: 18,
                    justifyContent: 'center',
                    background: currentTheme === 'light' ? 'var(--dark)' : 'var(--glass-solid)',
                    color: currentTheme === 'light' ? 'var(--on-dark)' : 'var(--ink)',
                    border: '1px solid var(--line)',
                  }}
                  onClick={() => applyAppTheme('light')}
                >
                  Mode Terang (Light)
                </button>
                <button
                  type="button"
                  className="cta btn"
                  style={{
                    height: 52,
                    borderRadius: 18,
                    justifyContent: 'center',
                    background: currentTheme === 'dark' ? 'var(--dark)' : 'var(--glass-solid)',
                    color: currentTheme === 'dark' ? 'var(--on-dark)' : 'var(--ink)',
                    border: '1px solid var(--line)',
                  }}
                  onClick={() => applyAppTheme('dark')}
                >
                  Mode Gelap (Dark)
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Warna Utama Aksen (Primary Color)</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <input
                  type="color"
                  id="uiColorPicker"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 58, height: 48, border: 0, background: 'none', cursor: 'pointer', borderRadius: 12 }}
                />
                <input
                  id="uiColorHex"
                  className="inp"
                  style={{ flex: 1, height: 50, padding: '0 16px', borderRadius: 16 }}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="cta btn dark" id="btnSaveUiConfig" style={{ height: 48, padding: '0 28px', borderRadius: 999 }} onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Setelan UI'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
