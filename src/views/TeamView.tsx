import React, { useState } from 'react';
import { Activity, TeamMember, ViewType } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { api, teamService, getAbsoluteAvatarUrl } from '../utils/api';

interface TeamViewProps {
  activities: Activity[];
  members: TeamMember[];
  isAdmin?: boolean;
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  onSelectUserProfile?: (userId: string | number) => void;
  onDeleteActivity?: (id: string) => void;
  onResetActivities?: () => void;
  onResetPresence?: () => void;
  onRefreshTeam?: () => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  activities = [],
  members = [],
  isAdmin = false,
  onNavigate,
  onAddToast,
  onSelectUserProfile,
  onDeleteActivity,
  onResetActivities,
  onResetPresence,
  onRefreshTeam,
}) => {
  const [filter, setFilter] = useState<'All' | 'Reports' | 'Tasks' | 'Files' | 'Comments'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Admin Delete & Reset modals state
  const [actToDelete, setActToDelete] = useState<Activity | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetPresenceModalOpen, setIsResetPresenceModalOpen] = useState(false);
  const [isResettingPresence, setIsResettingPresence] = useState(false);

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Harap lengkapi semua bidang.');
      return;
    }
    setIsCreating(true);
    setErrorMsg('');

    api.post('/create-user.php', {
      name: fullName.trim(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    })
      .then(() => {
        setIsCreating(false);
        setIsModalOpen(false);
        onAddToast(`Akun anggota tim "${fullName}" berhasil dibuat!`);
        // Reset form
        setFullName('');
        setEmail('');
        setPassword('');
        // Refresh team list from database MySQL
        if (onRefreshTeam) {
          onRefreshTeam();
        }
      })
      .catch((err: any) => {
        setIsCreating(false);
        setErrorMsg(err.message || 'Gagal membuat akun anggota tim.');
      });
  };

  const handleConfirmDeleteActivity = () => {
    if (!actToDelete) return;
    if (onDeleteActivity) {
      onDeleteActivity(actToDelete.id);
    }
    setActToDelete(null);
  };

  const handleConfirmResetActivities = () => {
    if (onResetActivities) {
      onResetActivities();
    }
    setIsResetModalOpen(false);
  };

  const handleConfirmResetPresence = async () => {
    setIsResettingPresence(true);
    try {
      if (onResetPresence) {
        await onResetPresence();
      } else {
        await teamService.resetPresence();
        if (onRefreshTeam) onRefreshTeam();
      }
      onAddToast('Seluruh status kehadiran berhasil direset ke offline.');
    } catch (err) {
      console.error('Reset presence error:', err);
    } finally {
      setIsResettingPresence(false);
      setIsResetPresenceModalOpen(false);
    }
  };

  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeMembers = Array.isArray(members) ? members : [];

  const filteredActivities = safeActivities.filter((a) => {
    if (filter === 'All') return true;
    return a.kind === filter;
  });

  const workingMembers = safeMembers.filter((m) => m && (m.is_online || m.status === 'working'));
  const offlineMembers = safeMembers.filter((m) => m && (!m.is_online && m.status !== 'working'));

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText('https://laporanwee.agency/invite/team-creative-q4');
    onAddToast('Tautan undangan tim berhasil disalin!');
  };

  // Helper to render dynamic member avatar or clean initial badge
  const renderMemberAvatar = (m: { name?: string; img?: string; avatar_url?: string | null }, size: string = '36px', fontSize: string = '13px') => {
    const avatarSrc = m && (m.img || (m.avatar_url ? getAbsoluteAvatarUrl(m.avatar_url, m.name) : undefined));
    if (avatarSrc) {
      return (
        <img
          src={avatarSrc}
          alt={m.name || 'Anggota'}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    const initial = (m?.name || 'U').trim().charAt(0).toUpperCase();
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--primary-color, #4A55FF)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fontSize,
          fontWeight: 700,
          border: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
        title={m?.name || 'Anggota'}
      >
        {initial}
      </div>
    );
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Aktivitas &amp; Tim Wee Studio</h1>
          <p className="sub">
            Pantau update real-time pengerjaan, file yang diunggah, dan ketersediaan rekan tim.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsResetPresenceModalOpen(true)}
              title="Reset status kehadiran semua user ke offline"
              style={{
                borderColor: '#fca5a5',
                color: '#dc2626',
                background: '#fff',
              }}
            >
              <Icon name="refresh" style={{ width: 16, height: 16 }} />
              <span>Reset Kehadiran</span>
            </button>
          )}
          <button className="btn btn-dark" onClick={() => setIsModalOpen(true)}>
            <Icon name="users" />
            <span>Tambah Anggota Baru</span>
          </button>
        </div>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="users" />
          </div>
          <div>
            <div className="num">{workingMembers.length}</div>
            <div className="lbl">Sedang Bekerja Online</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{offlineMembers.length}</div>
            <div className="lbl">Sedang Offline</div>
          </div>
        </div>
        <div className="stat-chip c-white">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{members.length}</div>
            <div className="lbl">Total Tim Terdaftar</div>
          </div>
        </div>
      </div>

      {/* Activity Filter */}
      <div className="toolbar">
        <div className="tab-row">
          <button
            className={filter === 'All' ? 'active' : ''}
            onClick={() => setFilter('All')}
          >
            Semua ({activities.length})
          </button>
          <button
            className={filter === 'Reports' ? 'active' : ''}
            onClick={() => setFilter('Reports')}
          >
            Laporan
          </button>
          <button
            className={filter === 'Tasks' ? 'active' : ''}
            onClick={() => setFilter('Tasks')}
          >
            Tugas
          </button>
          <button
            className={filter === 'Files' ? 'active' : ''}
            onClick={() => setFilter('Files')}
          >
            Berkas
          </button>
          <button
            className={filter === 'Comments' ? 'active' : ''}
            onClick={() => setFilter('Comments')}
          >
            Diskusi
          </button>
        </div>
      </div>

      <div className="activity-layout">
        {/* Left: Feed stream */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Linimasa Aktivitas Terkini
            </h3>
            {isAdmin && activities.length > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setIsResetModalOpen(true)}
                style={{
                  borderColor: '#fca5a5',
                  color: '#dc2626',
                  background: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: '6px',
                }}
                title="Hapus seluruh riwayat aktivitas"
              >
                <Icon name="trash" style={{ width: 13, height: 13 }} />
                <span>Reset History Aktivitas</span>
              </button>
            )}
          </div>

          <div className="activity-list">
            {filteredActivities.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                <Icon name="checksq" style={{ width: 28, height: 28, margin: '0 auto 8px', color: 'var(--line-soft)' }} />
                <b style={{ display: 'block', fontSize: '14.5px', marginBottom: '4px', color: 'inherit' }}>
                  Belum ada riwayat aktivitas
                </b>
                <span style={{ fontSize: '12.5px' }}>
                  Aktivitas pengerjaan tugas, pengiriman laporan, dan kolaborasi tim akan muncul di sini.
                </span>
              </div>
            ) : (
              filteredActivities.map((act) => {
                const member = members.find((m) =>
                  m.name.toLowerCase().includes(act.person.toLowerCase().split(' ')[0])
                );

                return (
                  <div
                    key={act.id}
                    className="act-row"
                    onClick={() => {
                      if (act.kind === 'Reports') onNavigate('reports');
                      else if (act.kind === 'Tasks') onNavigate('tasks');
                      else onAddToast(`Melihat aktivitas ${act.person}`);
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      {renderMemberAvatar(member || { name: act.person }, '40px', '14px')}
                      <div className="act-ic">
                        <Icon name={act.icon} />
                      </div>
                    </div>

                    <div className="act-body" style={{ flex: 1 }}>
                      <div className="act-top">
                        <b>
                          {act.person}{' '}
                          <span style={{ fontWeight: 500, color: 'var(--muted)' }}>
                            {act.action}
                          </span>
                        </b>
                        <span className="act-time">{act.time}</span>
                      </div>
                      {act.quote && <div className="act-quote">{act.quote}</div>}
                      <div className="act-tag">
                        <Icon name="folder" />
                        <span>{act.project}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        title="Hapus aktivitas"
                        aria-label="Hapus aktivitas"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActToDelete(act);
                        }}
                        style={{
                          marginLeft: '10px',
                          flexShrink: 0,
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'rgba(20, 19, 26, 0.04)',
                          border: '1px solid var(--line-soft)',
                          color: 'var(--muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                          e.currentTarget.style.color = '#dc2626';
                          e.currentTarget.style.borderColor = '#fca5a5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(20, 19, 26, 0.04)';
                          e.currentTarget.style.color = 'var(--muted)';
                          e.currentTarget.style.borderColor = 'var(--line-soft)';
                        }}
                      >
                        <Icon name="trash" style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Team Presence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 14px' }}>
              Status Kehadiran Tim
            </h3>

            {/* Working Online */}
            <div className="status-group">
              <div className="status-group-title">
                <span className="dot" style={{ background: '#1e6e56' }} />
                <span>Sedang Bekerja Online ({workingMembers.length})</span>
              </div>
              <div className="member-list">
                {workingMembers.length === 0 ? (
                  <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--muted)' }}>
                    Tidak ada anggota yang sedang online saat ini.
                  </div>
                ) : (
                  workingMembers.map((m) => {
                    const targetId = m.user_id || m.id;
                    const displayName = m.full_name || m.name;
                    return (
                      <div
                        key={m.id}
                        className="member-row"
                        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onClick={() => {
                          if (onSelectUserProfile) {
                            onSelectUserProfile(targetId);
                          } else {
                            onNavigate('user-profile');
                          }
                        }}
                        title={`Lihat profil ${displayName}`}
                      >
                        {renderMemberAvatar(m, '38px', '13px')}
                        <div className="m-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <b style={{ fontSize: '13px', lineHeight: 1.2 }}>{displayName}</b>
                          <span style={{ fontSize: '12px', color: 'var(--text-main, #14131a)', fontWeight: 500 }}>
                            {m.profile_title || 'Belum diatur'}
                          </span>
                          {m.profile_location ? (
                            <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                              {m.profile_location}
                            </span>
                          ) : null}
                          <span style={{ fontSize: '11px', color: '#1e6e56', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1e6e56', display: 'inline-block' }} />
                            Sedang Bekerja Online
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Offline */}
            <div className="status-group">
              <div className="status-group-title">
                <span className="dot" style={{ background: '#9ca3af' }} />
                <span>Offline ({offlineMembers.length})</span>
              </div>
              <div className="member-list">
                {offlineMembers.length === 0 ? (
                  <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--muted)' }}>
                    Semua anggota sedang online.
                  </div>
                ) : (
                  offlineMembers.map((m) => {
                    const targetId = m.user_id || m.id;
                    const displayName = m.full_name || m.name;
                    return (
                      <div
                        key={m.id}
                        className="member-row"
                        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onClick={() => {
                          if (onSelectUserProfile) {
                            onSelectUserProfile(targetId);
                          } else {
                            onNavigate('user-profile');
                          }
                        }}
                        title={`Lihat profil ${displayName}`}
                      >
                        {renderMemberAvatar(m, '38px', '13px')}
                        <div className="m-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <b style={{ fontSize: '13px', lineHeight: 1.2 }}>{displayName}</b>
                          <span style={{ fontSize: '12px', color: 'var(--text-main, #14131a)', fontWeight: 500 }}>
                            {m.profile_title || 'Belum diatur'}
                          </span>
                          {m.profile_location ? (
                            <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                              {m.profile_location}
                            </span>
                          ) : null}
                          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} />
                            Offline
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="promo-card">
            <div>
              <h3>Ruang Kreatif Terpusat</h3>
              <p>Bagikan tautan undangan ini ke desainer, fotografer, atau editor baru.</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCopyInvite}
              >
                <span>Salin Tautan Undangan</span>
                <Icon name="arrowR" style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="promo-badge-tag">
              <Icon name="users" style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tambah Anggota Tim */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setErrorMsg('');
        }}
        title="Daftarkan Anggota Tim Baru"
      >
        <form onSubmit={handleCreateUserSubmit}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '14px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div className="field">
            <label htmlFor="user-fullname">Nama Lengkap Anggota *</label>
            <input
              id="user-fullname"
              type="text"
              placeholder="Contoh: Rangga Arya"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-email">Alamat E-Mail *</label>
            <input
              id="user-email"
              type="email"
              placeholder="nama@laporanwee.agency"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-password">Kata Sandi Akun *</label>
            <input
              id="user-password"
              type="password"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-dark"
              disabled={isCreating}
            >
              {isCreating ? 'Mendaftarkan...' : 'Buat Akun Anggota'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Konfirmasi Hapus Single Activity */}
      {actToDelete && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => setActToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Hapus Riwayat Aktivitas?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Aktivitas <strong>"{actToDelete.person} {actToDelete.action}"</strong> akan dihapus dari linimasa. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setActToDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmDeleteActivity}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} />
                <span>Hapus Aktivitas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Kehadiran */}
      {isResetPresenceModalOpen && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isResettingPresence && setIsResetPresenceModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="refresh" style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Reset Seluruh Kehadiran Tim?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Tindakan ini akan mengembalikan status seluruh anggota tim menjadi <b>Offline</b>. Akun pengguna dan data proyek tidak akan terhapus.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsResetPresenceModalOpen(false)}
                disabled={isResettingPresence}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmResetPresence}
                disabled={isResettingPresence}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isResettingPresence ? (
                  <>
                    <Icon name="loader" style={{ width: 14, height: 14 }} className="spin" />
                    <span>Mereset...</span>
                  </>
                ) : (
                  <>
                    <Icon name="refresh" style={{ width: 15, height: 15 }} />
                    <span>Ya, Reset Kehadiran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Reset Seluruh History Aktivitas */}
      {isResetModalOpen && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => setIsResetModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Hapus Seluruh Riwayat Aktivitas?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Seluruh linimasa riwayat aktivitas tim akan dikosongkan. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsResetModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmResetActivities}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} />
                <span>Reset History</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
