import React, { useState } from 'react';
import { CalendarEvent, TeamMember } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';

interface CalendarViewProps {
  events: CalendarEvent[];
  members: TeamMember[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onAddToast: (text: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  members,
  onAddEvent,
  onAddToast,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed: 9 = October
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-10-14');

  // Modal State for New Event
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('2026-10-15');
  const [newTime, setNewTime] = useState('14:00');
  const [newCat, setNewCat] = useState('cat-meeting');

  // Modal State for viewing Day events
  const [viewingDayEvents, setViewingDayEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Generate calendar days for currentMonth of currentYear
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  // Convert Sunday (0) to 7, so Monday is 1
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarCells: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const m = currentMonth === 0 ? 12 : currentMonth;
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    calendarCells.push({
      dayNum,
      dateStr,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNum: d,
      dateStr,
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete 35 or 42 grid
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let nextD = 1; nextD <= remaining; nextD++) {
    const m = currentMonth === 11 ? 1 : currentMonth + 2;
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(nextD).padStart(2, '0')}`;
    calendarCells.push({
      dayNum: nextD,
      dateStr,
      isCurrentMonth: false,
    });
  }

  const handleCellClick = (cellDate: string) => {
    setSelectedDate(cellDate);
    const dayEvs = events.filter((e) => e.date === cellDate);
    setViewingDayEvents({ date: cellDate, events: dayEvs });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddEvent({
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      cat: newCat,
    });

    onAddToast(`Agenda "${newTitle}" berhasil dijadwalkan!`);
    setIsAddOpen(false);
    setNewTitle('');
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Jadwal &amp; Kalender Kerja</h1>
          <p className="sub">
            Sinkronisasi sesi photoshoot, presentasi klien, dan deadline sprint proyek.
          </p>
        </div>
        <button
          className="btn btn-dark"
          onClick={() => {
            setNewDate(selectedDate || '2026-10-15');
            setIsAddOpen(true);
          }}
        >
          <Icon name="plus" />
          <span>Tambah Agenda Baru</span>
        </button>
      </div>

      <div className="cal-layout">
        {/* Left Calendar Table */}
        <div className="card cal-card">
          <div className="cal-head">
            <div className="cal-nav">
              <button
                className="circle-btn"
                onClick={handlePrevMonth}
                aria-label="Bulan sebelumnya"
              >
                <Icon name="chevL" />
              </button>
              <h2 className="cal-title">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <button
                className="circle-btn"
                onClick={handleNextMonth}
                aria-label="Bulan berikutnya"
              >
                <Icon name="chevRt" />
              </button>
            </div>

            <div className="view-toggle">
              <button
                className={viewMode === 'month' ? 'active' : ''}
                onClick={() => setViewMode('month')}
              >
                Bulan
              </button>
              <button
                className={viewMode === 'week' ? 'active' : ''}
                onClick={() => setViewMode('week')}
              >
                Minggu
              </button>
              <button
                className={viewMode === 'day' ? 'active' : ''}
                onClick={() => setViewMode('day')}
              >
                Hari
              </button>
            </div>
          </div>

          <table className="cal-table">
            <thead>
              <tr>
                <th>Sen</th>
                <th>Sel</th>
                <th>Rab</th>
                <th>Kam</th>
                <th>Jum</th>
                <th>Sab</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(calendarCells.length / 7) }).map(
                (_, rowIdx) => (
                  <tr key={rowIdx}>
                    {calendarCells
                      .slice(rowIdx * 7, rowIdx * 7 + 7)
                      .map((cell) => {
                        const isToday = cell.dateStr === '2026-10-14';
                        const isSelected = cell.dateStr === selectedDate;
                        const cellEvents = events.filter(
                          (e) => e.date === cell.dateStr
                        );

                        return (
                          <td
                            key={cell.dateStr}
                            className={`cal-cell ${
                              !cell.isCurrentMonth ? 'muted' : ''
                            } ${isToday ? 'today' : ''} ${
                              isSelected ? 'selected' : ''
                            }`}
                            onClick={() => handleCellClick(cell.dateStr)}
                          >
                            <span className="daynum">{cell.dayNum}</span>
                            {cellEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className={`ev-chip ${ev.cat}`}
                                title={`${ev.time} - ${ev.title}`}
                              >
                                <span className="dt">{ev.time}</span>
                                <span>{ev.title}</span>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                  </tr>
                )
              )}
            </tbody>
          </table>

          {/* Legend */}
          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--lime)' }} />
              <span>Fotografi</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--lavender)' }} />
              <span>Videografi</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--violet)' }} />
              <span>Desain &amp; UI</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--peach)' }} />
              <span>Meeting Klien</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#ffd3d3' }} />
              <span>Deadline</span>
            </div>
          </div>
        </div>

        {/* Right Upcoming & Shift Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Agenda Terdekat
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Jadwal penting yang perlu dipersiapkan
            </p>

            <div className="upcoming-list">
              {events.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  className="upc-row"
                  onClick={() => {
                    setSelectedDate(ev.date);
                    onAddToast(`Agenda: ${ev.title} (${ev.time})`);
                  }}
                >
                  <div
                    className="upc-badge"
                    style={{
                      background:
                        ev.date.includes('14')
                          ? 'var(--lime)'
                          : ev.date.includes('15') || ev.date.includes('16')
                          ? 'var(--lavender)'
                          : 'var(--peach)',
                    }}
                  >
                    {ev.date.includes('14') ? 'Hari Ini' : ev.date.slice(5)}
                  </div>
                  <div className="upc-mid">
                    <b>{ev.title}</b>
                    <span>Pukul {ev.time} WIB</span>
                  </div>
                  <Icon name="arrowR" />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '13px' }}>Tim Bertugas Hari Ini</b>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>6 Orang</span>
              </div>
              <div className="team-strip">
                {members.map((m) => (
                  <div key={m.id} className="team-mini">
                    <img src={m.img} alt={m.name} />
                    <b>{m.name.split(' ')[0]}</b>
                    <span>{m.role.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tambah Agenda Baru */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Jadwalkan Agenda Baru"
      >
        <form onSubmit={handleCreateEvent}>
          <div className="field">
            <label htmlFor="agenda-title-input">Nama Agenda / Kegiatan *</label>
            <input
              id="agenda-title-input"
              type="text"
              placeholder="Misal: Review Teaser Video dengan Klien"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-2col">
            <div className="field">
              <label htmlFor="agenda-date-input">Tanggal</label>
              <input
                id="agenda-date-input"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="agenda-time-input">Jam Mulai</label>
              <input
                id="agenda-time-input"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="agenda-category-select">Jenis Kegiatan</label>
            <select
              id="agenda-category-select"
              className="input"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            >
              <option value="cat-photography">📸 Photoshoot / Studio</option>
              <option value="cat-video">🎬 Video Production / Review</option>
              <option value="cat-design">🎨 Design Sprint / Mockup</option>
              <option value="cat-meeting">💼 Meeting / Client Sync</option>
              <option value="cat-deadline">🚨 Tenggat Waktu (Deadline)</option>
            </select>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAddOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-dark">
              Simpan Jadwal
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Lihat Agenda Hari Tertentu */}
      {viewingDayEvents && (
        <Modal
          isOpen={true}
          onClose={() => setViewingDayEvents(null)}
          title={`Agenda Tanggal ${viewingDayEvents.date}`}
        >
          <div>
            {viewingDayEvents.events.length === 0 ? (
              <p style={{ color: 'var(--muted)', margin: '14px 0' }}>
                Tidak ada agenda yang dijadwalkan pada tanggal ini.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
                {viewingDayEvents.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="report-row"
                    style={{ margin: 0 }}
                  >
                    <div className="ric">
                      <Icon name="clock" />
                    </div>
                    <div className="rmid">
                      <b>{ev.title}</b>
                      <span>Pukul {ev.time} WIB</span>
                    </div>
                    <span className={`rstat ${ev.cat.replace('cat-', '')}`}>
                      {ev.cat.replace('cat-', '')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setViewingDayEvents(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => {
                  setNewDate(viewingDayEvents.date);
                  setViewingDayEvents(null);
                  setIsAddOpen(true);
                }}
              >
                + Tambah Agenda Tanggal Ini
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
