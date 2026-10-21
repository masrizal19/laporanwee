// Render Tampilan Pengaturan Profil
function renderProfileSettingsView() {
  return `
  <div class="head">
    <div class="grow rv" style="--i:0">
      <h1>Pengaturan Profil</h1>
      <p>Kelola identitas akun, kredensial, dan preferensi kerja tim Anda.</p>
    </div>
  </div>
  <div class="grid">
    <section class="card c12 rv" style="--i:1">
      <div class="inner" style="max-width: 720px; margin: auto; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--line);">
          <div class="avatar" style="width: 76px; height: 76px; font-size: 26px; flex-shrink: 0;" id="psAvatar">RI</div>
          <div style="flex: 1; min-width: 0;">
            <b style="font-size: 20px; font-weight: 600; display: block;" id="psDisplayFullName">RIZAL FADHILAH</b>
            <span style="color: var(--muted); font-size: 13.5px;" id="psDisplayTitle">Administrator · VIDEO EDITOR</span>
          </div>
        </div>

        <div class="fld">
          <label style="display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 6px;">Nama Lengkap</label>
          <input id="psInputName" class="inp" style="width: 100%; height: 50px; padding: 0 16px; border-radius: 16px;" value="RIZAL FADHILAH">
        </div>

        <div class="fld">
          <label style="display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 6px;">Email Akun</label>
          <input id="psInputEmail" class="inp" style="width: 100%; height: 50px; padding: 0 16px; border-radius: 16px;" value="rizalsaragih498@gmail.com" readonly style="opacity: 0.7;">
        </div>

        <div class="fld">
          <label style="display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 6px;">Jabatan / Pekerjaan</label>
          <input id="psInputJob" class="inp" style="width: 100%; height: 50px; padding: 0 16px; border-radius: 16px;" value="VIDEO EDITOR">
        </div>

        <div class="fld">
          <label style="display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 6px;">Status Karyawan</label>
          <select id="psInputStatus" class="inp" style="width: 100%; height: 50px; padding: 0 16px; border-radius: 16px;">
            <option value="Karyawan" selected>Karyawan Tetap</option>
            <option value="Freelance">Freelance</option>
            <option value="Internship">Internship / Magang</option>
          </select>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button class="cta" id="btnSaveProfileSettings" style="height: 48px; padding: 0 28px;">Simpan Perubahan</button>
        </div>
      </div>
    </section>
  </div>
  `;
}

// Handler Simpan Profil
async function handleSaveProfileSettings() {
  const btn = document.getElementById('btnSaveProfileSettings');
  const name = document.getElementById('psInputName').value.trim();
  const job = document.getElementById('psInputJob').value.trim();
  const status = document.getElementById('psInputStatus').value;

  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    const res = await fetch('[https://api-laporanwe.mkverse.my.id/api/profile/save.php](https://api-laporanwe.mkverse.my.id/api/profile/save.php)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ id: 1, name: name, pekerjaan: job, status: status })
    });
    const result = await res.json();
    if (result.success) {
      document.getElementById('psDisplayFullName').textContent = name;
      document.getElementById('psDisplayTitle').textContent = `Administrator · ${job}`;
      alert('Profil berhasil diperbarui!');
    }
  } catch (err) {
    console.error('Gagal menyimpan profil:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Perubahan'; }
  }
}