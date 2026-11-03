import React, { useState } from 'react';
import { TeamMember, ViewType } from '../types';
import { getAbsoluteAvatarUrl } from '../utils/api';

export interface TeamAttendanceWidgetProps {
  members?: TeamMember[];
  onSelectUserProfile?: (userId: string | number) => void;
  onNavigate?: (view: ViewType) => void;
  className?: string;
  defaultMinimized?: boolean;
}

export const TeamAttendanceWidget: React.FC<TeamAttendanceWidgetProps> = ({
  members = [],
  onSelectUserProfile,
  onNavigate,
  className = '',
  defaultMinimized = false,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(defaultMinimized);

  const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  const workingMembers = safeMembers.filter((m) => m && (m.is_online || m.status === 'working'));
  const offlineMembers = safeMembers.filter((m) => m && (!m.is_online && m.status !== 'working'));

  const onlineCount = workingMembers.length;
  const offlineCount = offlineMembers.length;

  const handleMemberClick = (member: TeamMember) => {
    const targetId = member.user_id || member.id;
    if (onSelectUserProfile) {
      onSelectUserProfile(targetId);
    } else if (onNavigate) {
      onNavigate('user-profile');
    }
  };

  const renderMemberCard = (member: TeamMember, isOnline: boolean) => {
    const memberName = member.full_name || member.name || 'Anggota Tim';
    const memberJob = member.profile_title || (member as any).job_title || 'Belum diatur';
    const memberStatus = member.profile_location || (member as any).status_type || 'Karyawan';
    const rawAvatar = member.avatar_url || member.img || null;
    const avatarUrl = rawAvatar ? getAbsoluteAvatarUrl(rawAvatar, memberName) : null;
    const initials = (memberName.trim().charAt(0) || 'U').toUpperCase();

    return (
      <div
        key={member.id}
        onClick={() => handleMemberClick(member)}
        className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all cursor-pointer group select-none"
        title={`Lihat profil ${memberName}`}
      >
        {/* Avatar Mini */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200 border border-black/5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={memberName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          {/* Status Dot */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
              isOnline ? 'bg-emerald-500' : 'bg-gray-400'
            }`}
          />
        </div>

        {/* Info Teks Ramping */}
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-gray-800 dark:text-gray-100 truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {memberName}
          </p>
          <p className="text-[10.5px] font-medium text-gray-500 dark:text-gray-400 truncate uppercase mt-0.5">
            {memberJob}
          </p>
          <span className="text-[9.5px] text-gray-400 dark:text-gray-500 block truncate">
            {memberStatus}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`card summary-card transition-all duration-300 ${className}`}
      style={{
        background: 'var(--glass, rgba(255, 255, 255, 0.65))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--line, rgba(31, 29, 43, 0.08))',
        borderRadius: '24px',
        padding: '20px 22px',
      }}
    >
      {/* 1. Header Card + Minimize Button */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3
            style={{
              fontSize: '17px',
              fontWeight: 800,
              margin: 0,
              color: 'var(--ink, #1f1d2b)',
              letterSpacing: '-0.01em',
            }}
            className="truncate"
          >
            Status Kehadiran Tim
          </h3>

          {/* Quick Summary Badge when Minimized */}
          {isMinimized && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex-shrink-0 animate-fadeIn">
              🟢 {onlineCount} Online · ⚪ {offlineCount} Offline
            </span>
          )}
        </div>

        {/* Minimize / Expand Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMinimized((prev) => !prev)}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-all flex-shrink-0 cursor-pointer"
          title={isMinimized ? 'Perluas Status' : 'Kecilkan Status'}
          aria-label={isMinimized ? 'Perluas Status' : 'Kecilkan Status'}
        >
          <svg
            className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 ${
              isMinimized ? 'rotate-180' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>

      {/* 2. Collapsible Body Container */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isMinimized
            ? 'max-h-0 opacity-0 pointer-events-none mt-0'
            : 'max-h-[600px] opacity-100 mt-4'
        }`}
      >
        <div
          className="max-h-[380px] overflow-y-auto pr-1 space-y-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Section: Sedang Bekerja Online */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs animate-pulse flex-shrink-0" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--ink, #1f1d2b)',
                  textTransform: 'uppercase',
                }}
              >
                Sedang Bekerja Online ({onlineCount})
              </span>
            </div>

            {workingMembers.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--line, rgba(0, 0, 0, 0.05))',
                  fontSize: '12px',
                  color: 'var(--muted, #7d7a8c)',
                  textAlign: 'center',
                }}
              >
                Tidak ada anggota yang sedang online saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {workingMembers.map((m) => renderMemberCard(m, true))}
              </div>
            )}
          </div>

          {/* Section: Offline */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shadow-xs flex-shrink-0" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--muted, #7d7a8c)',
                  textTransform: 'uppercase',
                }}
              >
                Offline ({offlineCount})
              </span>
            </div>

            {offlineMembers.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--line, rgba(0, 0, 0, 0.05))',
                  fontSize: '12px',
                  color: 'var(--muted, #7d7a8c)',
                  textAlign: 'center',
                }}
              >
                Semua anggota sedang online.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {offlineMembers.map((m) => renderMemberCard(m, false))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamAttendanceWidget;
