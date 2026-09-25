import React, { useState } from 'react';
import { Activity, TeamMember, ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';
import { Modal } from '../components/Modal';
import { api } from '../utils/api';

interface TeamViewProps {
  activities: Activity[];
  members: TeamMember[];
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  activities,
  members,
  onNavigate,
  onAddToast,
}) => {
  const [filter, setFilter] = useState<'All' | 'Reports' | 'Tasks' | 'Files' | 'Comments'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
      .then((res) => {
        setIsCreating(false);
        setIsModalOpen(false);
        onAddToast(`Akun anggota tim "${fullName}" berhasil dibuat!`);
        // Reset form
        setFullName('');
        setEmail('');
        setPassword('');
      })
      .catch((err: any) => {
        setIsCreating(false);
        setErrorMsg(err.message || 'Gagal membuat akun anggota tim.');
      });
  };

  const filteredActivities = activities.filter((a) => {
    if (filter === 'All') return true;
    return a.kind === filter;
  });

  const workingMembers = members.filter((m) => m.status === 'working');
  const breakMembers = members.filter((m) => m.status === 'break');
  const offlineMembers = members.filter((m) => m.status === 'offline');

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText('https://laporanwee.agency/invite/team-creative-q4');
    onAddToast('Tautan undangan tim berhasil disalin!');
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
        <button className="btn btn-dark" onClick={() => setIsModalOpen(true)}>
          <Icon name="users" />
          <span>Tambah Anggota Baru</span>
        </button>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="users" />
          </div>
          <div>
            <div className="num">{workingMembers.length}</div>
            <div className="lbl">Sedang Bekerja</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{breakMembers.length}</div>
            <div className="lbl">Sedang Istirahat</div>
          </div>
        </div>
        <div className="stat-chip c-white">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{members.length}</div>
            <div className="lbl">Total Tim</div>
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
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px' }}>
            Linimasa Aktivitas Terkini
          </h3>

          <div className="activity-list">
            {filteredActivities.map((act) => {
              const member = members.find((m) => m.name.includes(act.person.split(' ')[0]));
              const avatarUrl =
                member?.img ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

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
                    <img src={avatarUrl} alt={act.person} className="act-avatar" />
                    <div className="act-ic">
                      <Icon name={act.icon} />
                    </div>
                  </div>

                  <div className="act-body">
                    <div className="act-top">
                      <b>
                        {act.person}{' '}
                        <span style={{ fontWeight: 500, color: 'var(--muted)' }}>
                          {act.action}
                        </span>
                      </b>
                      <span className="act-time">{act.time}</span>
                    </div>

                    <div className="act-quote">{act.quote}</div>

                    <div className="act-tag">
                      <Icon name="folder" />
                      <span>{act.project}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Team Presence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 14px' }}>
              Status Kehadiran Tim
            </h3>

            {/* Working */}
            <div className="status-group">
              <div className="status-group-title">
                <span className="dot" style={{ background: '#1e6e56' }} />
                <span>Sedang Bekerja Online ({workingMembers.length})</span>
              </div>
              <div className="status-avatars">
                {workingMembers.map((m) => (
                  <img
                    key={m.id}
                    src={m.img}
                    alt={m.name}
                    title={`${m.name} - ${m.role}`}
                  />
                ))}
              </div>
            </div>

            {/* Break */}
            <div className="status-group">
              <div className="status-group-title">
                <span className="dot" style={{ background: '#d99726' }} />
                <span>Sedang Istirahat ({breakMembers.length})</span>
              </div>
              <div className="status-avatars">
                {breakMembers.map((m) => (
                  <img
                    key={m.id}
                    src={m.img}
                    alt={m.name}
                    title={`${m.name} - ${m.role}`}
                  />
                ))}
              </div>
            </div>

            {/* Offline */}
            <div className="status-group">
              <div className="status-group-title">
                <span className="dot" style={{ background: '#999' }} />
                <span>Offline ({offlineMembers.length})</span>
              </div>
              <div className="status-avatars">
                {offlineMembers.map((m) => (
                  <img
                    key={m.id}
                    src={m.img}
                    alt={m.name}
                    title={`${m.name} - ${m.role}`}
                    style={{ opacity: 0.55 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Invite Card */}
          <div className="promo-card">
            <div>
              <h3>Ruang Kreatif Terpusat</h3>
              <p>Bagikan tautan undangan ini ke desainer, fotografer, atau editor baru.</p>
              <button className="btn btn-sm" onClick={handleCopyInvite}>
                <span>Salin Tautan Undangan</span>
                <Icon name="arrowR" />
              </button>
            </div>
            <div className="promo-illus">
              <Illustration kind="people" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tambah Anggota Baru */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setErrorMsg('');
        }}
        title="Tambah Anggota Tim Baru"
      >
        <form onSubmit={handleCreateUserSubmit}>
          <div className="field">
            <label htmlFor="team-fullname-input">Nama Lengkap</label>
            <input
              id="team-fullname-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Rangga Arya"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="team-email-input">Alamat Email</label>
            <input
              id="team-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Contoh: admin@laporanwee.agency"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="team-password-input">Password Akun</label>
            <input
              id="team-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          {errorMsg && <div className="auth-error" style={{ marginBottom: '15px' }}>{errorMsg}</div>}

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsModalOpen(false);
                setErrorMsg('');
              }}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-dark" disabled={isCreating}>
              {isCreating ? 'Membuat...' : 'Buat Anggota Tim'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
