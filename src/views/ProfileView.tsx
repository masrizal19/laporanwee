import React, { useState } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';

interface ProfileViewProps {
  projects: Project[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  projects,
  reports,
  onNavigate,
  onSelectProject,
  onSelectReport,
  onAddToast,
}) => {
  const [name, setName] = useState('Rangga Arya');
  const [role, setRole] = useState('Lead Product Designer & UI Specialist');
  const [email, setEmail] = useState('rangga@wee.agency');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const myReports = reports.filter((r) => r.person.includes('Rangga'));

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditOpen(false);
    onAddToast('Profil berhasil diperbarui!');
  };

  return (
    <div className="view">
      {/* Profile Hero Card */}
      <div className="card profile-hero" style={{ marginBottom: '22px' }}>
        <div className="profile-avatar-lg">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
            alt={name}
          />
        </div>

        <div className="profile-name">
          <h2>{name}</h2>
          <p>{role} &bull; {email}</p>
          <button className="edit-link" onClick={() => setIsEditOpen(true)}>
            <Icon name="pencil" />
            <span>Edit Profil</span>
          </button>
        </div>

        <div className="profile-mini-stats">
          <div className="stat-chip c-mint">
            <div className="ic">
              <Icon name="doc" />
            </div>
            <div>
              <div className="num">28</div>
              <div className="lbl">Laporan Terkirim</div>
            </div>
          </div>
          <div className="stat-chip c-lav">
            <div className="ic">
              <Icon name="checksq" />
            </div>
            <div>
              <div className="num">14</div>
              <div className="lbl">Proyek Selesai</div>
            </div>
          </div>
          <div className="stat-chip c-pink">
            <div className="ic">
              <Icon name="target" />
            </div>
            <div>
              <div className="num">98.4%</div>
              <div className="lbl">Tepat Waktu</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Left: Active work & reports */}
        <div>
          <div>
            <h3 className="section-title">Proyek Yang Saya Tangani</h3>
            <p className="section-sub">Tugas desain &amp; prototyping aktif saat ini</p>

            <div className="card-grid-2">
              {projects.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  className="work-card"
                  onClick={() => {
                    onSelectProject(p.id);
                    onNavigate('project-detail');
                  }}
                >
                  <div className="cat">
                    <Icon name={p.cat} />
                    <span>{p.catLabel}</span>
                  </div>
                  <h4>{p.name}</h4>
                  <div className="wc-footer">
                    <div className="mini-track">
                      <div className="mini-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="pct">{p.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                Riwayat Laporan Saya
              </h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate('create-report')}
              >
                + Buat Baru
              </button>
            </div>

            {myReports.map((r) => (
              <div
                key={r.id}
                className="report-row"
                onClick={() => {
                  onSelectReport(r.id);
                  onNavigate('report-detail');
                }}
              >
                <div className="ric">
                  <Icon name="doc" />
                </div>
                <div className="rmid">
                  <b>{r.task}</b>
                  <span>{r.project} &bull; {r.date}</span>
                </div>
                <span className={`rstat ${r.status.replace(/\s+/g, '')}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Productivity & Mini calendar */}
        <div className="right-col">
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Produktivitas Mingguan
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Persentase deliverable 5 hari kerja
            </p>

            <div className="mini-week">
              <div className="mw-row">
                <div className="mw-day">Sen</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '85%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">85%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Sel</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '92%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">92%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Rab</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '96%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">96%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Kam</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '70%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">70%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Jum</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '80%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">80%</div>
              </div>
            </div>

            <div className="tip-box">
              <Icon name="target" />
              <span>Hebat! Konsistensi kamu berada di level Top 5% tim Wee.</span>
            </div>
          </div>

          <div className="card summary-card">
            <div className="mini-cal-head">
              <b style={{ fontSize: '14px' }}>Oktober 2026</b>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('calendar')}
              >
                Buka Kalender &rarr;
              </button>
            </div>
            <table className="mini-cal-table">
              <thead>
                <tr>
                  <th>S</th>
                  <th>S</th>
                  <th>R</th>
                  <th>K</th>
                  <th>J</th>
                  <th>S</th>
                  <th>M</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="muted2">28</td>
                  <td className="muted2">29</td>
                  <td className="muted2">30</td>
                  <td>1</td>
                  <td>2</td>
                  <td>3</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>6<div className="evdot" /></td>
                  <td>7</td>
                  <td>8</td>
                  <td>9</td>
                  <td>10<div className="evdot" /></td>
                  <td>11</td>
                </tr>
                <tr>
                  <td>12</td>
                  <td>13</td>
                  <td className="today">14<div className="evdot" /></td>
                  <td>15</td>
                  <td>16<div className="evdot" /></td>
                  <td>17</td>
                  <td>18</td>
                </tr>
                <tr>
                  <td>19</td>
                  <td>20</td>
                  <td>21<div className="evdot" /></td>
                  <td>22</td>
                  <td>23</td>
                  <td>24</td>
                  <td>25</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Ubah Profil Pengguna"
      >
        <form onSubmit={handleSaveProfile}>
          <div className="field">
            <label htmlFor="user-name-input">Nama Lengkap</label>
            <input
              id="user-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-role-input">Jabatan &amp; Peran</label>
            <input
              id="user-role-input"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-email-input">Alamat Email Perusahaan</label>
            <input
              id="user-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsEditOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-dark">
              Simpan Profil
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
