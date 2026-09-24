import React, { useState } from 'react';
import { Report, ViewType } from '../types';
import { Icon } from '../components/icons';

interface ReportDetailViewProps {
  report: Report;
  onNavigate: (view: ViewType) => void;
  onUpdateStatus: (reportId: string, newStatus: Report['status']) => void;
  onAddToast: (text: string) => void;
}

interface Comment {
  id: string;
  name: string;
  avatar: string;
  time: string;
  text: string;
}

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  report,
  onNavigate,
  onUpdateStatus,
  onAddToast,
}) => {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 'c1',
      name: 'Rizky Pratama (Lead)',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      time: '1 jam lalu',
      text: 'Struktur layout dan spacing di Figma sudah rapi banget! Pastikan icon set konsisten dengan style 2px stroke ya.',
    },
    {
      id: 'c2',
      name: 'Dimas Wicaksono',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
      time: '30 menit lalu',
      text: 'Tokens warna sudah aku import ke Tailwind CSS config. Ready untuk proses slicing.',
    },
  ]);

  const [newComment, setNewComment] = useState('');

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentItem: Comment = {
      id: `c_${Date.now()}`,
      name: 'Rangga Arya (Anda)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      time: 'Baru saja',
      text: newComment.trim(),
    };

    setComments([...comments, commentItem]);
    setNewComment('');
    onAddToast('Komentar berhasil ditambahkan!');
  };

  const handleApprove = () => {
    onUpdateStatus(report.id, 'Completed');
    onAddToast(`Laporan "${report.task}" telah disetujui (Completed)!`);
  };

  const handleRequestRevision = () => {
    onUpdateStatus(report.id, 'In Review');
    onAddToast(`Revisi telah diminta untuk laporan "${report.task}".`);
  };

  return (
    <div className="view">
      {/* Top Bar */}
      <div className="rd-top">
        <button className="back-btn" onClick={() => onNavigate('reports')}>
          <Icon name="chevL" />
          <span>Kembali ke Daftar Laporan</span>
        </button>

        <div className="rd-chip">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt={report.person}
          />
          <div>
            <b>{report.person}</b>
            <span>Pelapor Kerja</span>
          </div>
        </div>

        <div className="rd-chip">
          <Icon name="calendar" />
          <div>
            <b>{report.date}</b>
            <span>Tanggal Pengerjaan</span>
          </div>
        </div>

        <div className="rd-chip status">
          <Icon name="clock" />
          <div>
            <b>{report.time}</b>
            <span>Durasi Kerja</span>
          </div>
        </div>

        <div
          className="rd-chip"
          style={{
            background:
              report.status === 'Completed'
                ? 'var(--mint)'
                : report.status === 'In Review'
                ? 'var(--peach)'
                : 'var(--lavender)',
          }}
        >
          <Icon name="target" />
          <div>
            <b>{report.status}</b>
            <span>Status Verifikasi</span>
          </div>
        </div>
      </div>

      <div className="rd-layout">
        {/* Main Content */}
        <div className="card rd-main">
          <div className="rd-grid2">
            <div className="rd-box">
              <div className="rl">
                <Icon name="folder" />
                <span>Proyek Terkait</span>
              </div>
              <div className="rv">{report.project}</div>
            </div>

            <div className="rd-box">
              <div className="rl">
                <Icon name="palette" />
                <span>Kategori Kerja</span>
              </div>
              <div className="rv">{report.category}</div>
            </div>
          </div>

          <div style={{ margin: '14px 0 20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px' }}>
              {report.task}
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)', margin: 0 }}>
              {report.desc}
            </p>
          </div>

          {/* Progress Bar */}
          <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>
                Tingkat Penyelesaian Tugas
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--violet)' }}>
                {report.progress}%
              </span>
            </div>
            <div className="progress-track" style={{ maxWidth: '100%', height: '9px' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${report.progress}%`,
                  background: report.progress === 100 ? '#1e6e56' : 'var(--violet)',
                }}
              />
            </div>
          </div>

          {/* Details 2-box */}
          <div className="rd-grid2">
            <div className="rd-box">
              <div className="rl">
                <Icon name="flag" />
                <span>Kendala &amp; Hambatan</span>
              </div>
              <div className="rd-desc">
                {report.challenges || 'Tidak ada kendala yang menghambat.'}
              </div>
            </div>

            <div className="rd-box">
              <div className="rl">
                <Icon name="arrowR" />
                <span>Rencana Kerja Selanjutnya</span>
              </div>
              <div className="rd-desc">
                {report.next || 'Melanjutkan modul berikutnya sesuai sprint.'}
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Lampiran &amp; Berkas Bukti (4)
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Klik berkas untuk melihat preview atau mengunduh aset.
            </p>

            <div className="attach-grid">
              <div
                className="attach-card"
                onClick={() => onAddToast('Membuka file mockup Figma...')}
              >
                <div className="attach-thumb" style={{ background: 'var(--lavender)' }}>
                  <Icon name="palette" />
                </div>
                <div className="attach-meta">
                  <div className="fn">Mockup-v3.fig</div>
                  <div className="fs">14.2 MB &bull; Figma</div>
                </div>
              </div>

              <div
                className="attach-card"
                onClick={() => onAddToast('Mengunduh dokumentasi PDF...')}
              >
                <div className="attach-thumb" style={{ background: 'var(--mint)' }}>
                  <Icon name="doc" />
                </div>
                <div className="attach-meta">
                  <div className="fn">Responsive-Spec.pdf</div>
                  <div className="fs">3.8 MB &bull; PDF</div>
                </div>
              </div>

              <div
                className="attach-card"
                onClick={() => onAddToast('Membuka palet token PNG...')}
              >
                <div className="attach-thumb" style={{ background: 'var(--peach)' }}>
                  <Icon name="image" />
                </div>
                <div className="attach-meta">
                  <div className="fn">Palette-Tokens.png</div>
                  <div className="fs">820 KB &bull; PNG</div>
                </div>
              </div>

              <div
                className="attach-card"
                onClick={() => onAddToast('Mengunduh shotlist video...')}
              >
                <div className="attach-thumb" style={{ background: 'var(--cream)' }}>
                  <Icon name="video" />
                </div>
                <div className="attach-meta">
                  <div className="fn">Shotlist-Take3.mov</div>
                  <div className="fs">42 MB &bull; Video</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions & Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Actions Card */}
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px' }}>
              Verifikasi Laporan
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
              Tinjau capaian kerja ini dan beri tanda persetujuan atau instruksi revisi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-dark"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleApprove}
              >
                <Icon name="check" />
                <span>Setujui Laporan Ini</span>
              </button>

              <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleRequestRevision}
              >
                <Icon name="pencil" />
                <span>Minta Catatan Revisi</span>
              </button>
            </div>
          </div>

          {/* Comments Card */}
          <div className="card comments-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>
              Diskusi Tim ({comments.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {comments.map((c) => (
                <div key={c.id} className="comment-row">
                  <img src={c.avatar} alt={c.name} />
                  <div className="cb">
                    <b>{c.name}</b>
                    <span className="ctime">{c.time}</span>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="comment-input-row">
              <input
                type="text"
                placeholder="Tulis tanggapan atau feedback..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" aria-label="Kirim Komentar">
                <Icon name="send" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
