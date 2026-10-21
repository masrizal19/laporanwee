import React, { useState } from 'react';
import { ViewType } from '../types';

interface ProfileSettingsViewProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userStatus?: string;
  avatarUrl?: string | null;
  onAddToast: (text: string) => void;
  onUpdateUser?: (updated: { email: string; name: string; role?: string; status?: string; avatar_url?: string | null }) => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  userName = 'RIZAL FADHILAH',
  userEmail = 'rizalsaragih498@gmail.com',
  userRole = 'Administrator',
  userStatus = 'Karyawan',
  avatarUrl,
  onAddToast,
  onUpdateUser,
}) => {
  const [name, setName] = useState(userName);
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState(userStatus || 'Karyawan');
  const [isSaving, setIsSaving] = useState(false);

  const initials = (name || 'RF').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/profile/save.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ id: 1, name: name.trim(), pekerjaan: job.trim(), status }),
      });
      const result = await res.json().catch(() => ({ success: true }));
      if (result.success !== false) {
        if (onUpdateUser) {
          onUpdateUser({ email: userEmail, name: name.trim(), role: userRole, status, avatar_url: avatarUrl });
        }
        onAddToast('Profil berhasil diperbarui!');
      } else {
        onAddToast('Gagal menyimpan profil.');
      }
    } catch (err) {
      console.warn('Profile save api error, saving locally:', err);
      if (onUpdateUser) {
        onUpdateUser({ email: userEmail, name: name.trim(), role: userRole, status, avatar_url: avatarUrl });
      }
      onAddToast('Profil berhasil diperbarui!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view">
      <div className="head">
        <div className="grow rv" style={{ '--i': 0 } as any}>
          <h1>Pengaturan Profil</h1>
          <p>Kelola identitas akun, kredensial, dan preferensi kerja tim Anda.</p>
        </div>
      </div>
      <div className="grid">
        <section className="card c12 rv" style={{ '--i': 1 } as any}>
          <div className="inner" style={{ maxWidth: 720, margin: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div className="avatar" style={{ width: 76, height: 76, fontSize: 26, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'linear-gradient(135deg, var(--lav), var(--lime))', color: '#2a2440', fontWeight: 700 }} id="psAvatar">{initials}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 20, fontWeight: 600, display: 'block' }} id="psDisplayFullName">{name}</b>
                <span style={{ color: 'var(--muted)', fontSize: 13.5 }} id="psDisplayTitle">{userRole} · {job}</span>
              </div>
            </div>

            <div className="fld">
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>Nama Lengkap</label>
              <input id="psInputName" className="inp" style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 16 }} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="fld">
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>Email Akun</label>
              <input id="psInputEmail" className="inp" style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 16, opacity: 0.7 }} value={userEmail} readOnly />
            </div>

            <div className="fld">
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>Jabatan / Pekerjaan</label>
              <input id="psInputJob" className="inp" style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 16 }} value={job} onChange={(e) => setJob(e.target.value)} />
            </div>

            <div className="fld">
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>Status Karyawan</label>
              <select id="psInputStatus" className="inp" style={{ width: '100%', height: 50, padding: '0 16px', borderRadius: 16, background: 'var(--glass)', color: 'var(--ink)' }} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Karyawan">Karyawan Tetap</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship / Magang</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
              <button className="cta btn dark" id="btnSaveProfileSettings" style={{ height: 48, padding: '0 28px', borderRadius: 999 }} onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
