import React, { useEffect, useState } from 'react';
import { Report, Task, TeamMember } from '../types';
import { getStoredUser } from '../utils/api';

export interface TaskAvatarProps {
  task: Partial<Task> & Record<string, any>;
  members?: TeamMember[];
  membersLookup?: Map<string, TeamMember>;
  matchedReport?: Report;
  className?: string;
}

const API_ORIGIN = 'https://api-laporanwe.mkverse.my.id';

const isImageUrlLike = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('uploads/')
  );
};

export const normalizeTaskAvatarUrl = (rawAvatar?: string | null): string => {
  if (!rawAvatar || typeof rawAvatar !== 'string') return '';
  const cleaned = rawAvatar.trim();
  if (
    !cleaned ||
    cleaned === 'null' ||
    cleaned === 'undefined' ||
    cleaned.toLowerCase().includes('placeholder')
  ) {
    return '';
  }

  if (cleaned.startsWith('http://api-laporanwe.mkverse.my.id')) {
    return cleaned.replace('http://', 'https://');
  }

  if (
    cleaned.startsWith('http://') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('data:') ||
    cleaned.startsWith('blob:')
  ) {
    return cleaned;
  }

  return `${API_ORIGIN}/${cleaned.replace(/^\/+/, '')}`;
};

export const buildMembersLookup = (members: TeamMember[] = []): Map<string, TeamMember> => {
  const map = new Map<string, TeamMember>();
  for (const m of members) {
    if (m.id) map.set(`id:${String(m.id).trim().toLowerCase()}`, m);
    if (m.user_id) map.set(`id:${String(m.user_id).trim().toLowerCase()}`, m);
    if (m.email) {
      const emailLower = m.email.trim().toLowerCase();
      map.set(emailLower, m);
      const prefix = emailLower.split('@')[0];
      if (prefix && !map.has(prefix)) {
        map.set(prefix, m);
      }
    }
    if (m.name) map.set(m.name.trim().toLowerCase(), m);
    if (m.full_name) map.set(m.full_name.trim().toLowerCase(), m);
  }
  return map;
};

const findMatchedMember = (
  task: Partial<Task> & Record<string, any>,
  members?: TeamMember[],
  membersLookup?: Map<string, TeamMember>,
  matchedReport?: Report
): TeamMember | undefined => {
  const lookup = membersLookup || (members && members.length > 0 ? buildMembersLookup(members) : undefined);
  if (!lookup || lookup.size === 0) return undefined;

  const idCandidates = [
    task.assignee_id,
    task.user_id,
    task.user?.id,
    matchedReport?.user_id,
  ];
  for (const idVal of idCandidates) {
    if (idVal !== undefined && idVal !== null && String(idVal).trim() !== '') {
      const found = lookup.get(`id:${String(idVal).trim().toLowerCase()}`);
      if (found) return found;
    }
  }

  const textCandidates = [
    task.assignee_email,
    task.user?.email,
    matchedReport?.user_email,
    task.assignee_name,
    task.user_name,
    task.user?.full_name,
    task.user?.name,
    task.assignee,
    matchedReport?.user_name,
    matchedReport?.person,
  ];

  for (const raw of textCandidates) {
    if (!raw || typeof raw !== 'string') continue;
    const key = raw.trim().toLowerCase();
    if (!key || isImageUrlLike(key)) continue;
    const found = lookup.get(key);
    if (found) return found;
  }

  // Fallback partial match on full_name / name if member list is available
  if (members && members.length > 0) {
    for (const raw of textCandidates) {
      if (!raw || typeof raw !== 'string') continue;
      const key = raw.trim().toLowerCase();
      if (key.length < 2 || isImageUrlLike(key)) continue;
      const partial = members.find(
        (m) =>
          (m.full_name && m.full_name.toLowerCase() === key) ||
          (m.name && m.name.toLowerCase() === key) ||
          (m.email && m.email.toLowerCase() === key)
      );
      if (partial) return partial;
    }
  }

  return undefined;
};

export const resolveTaskUserAvatar = (
  task: Partial<Task> & Record<string, any>,
  members?: TeamMember[],
  membersLookup?: Map<string, TeamMember>,
  matchedReport?: Report
): { avatarUrl: string; userName: string } => {
  const matchedMember = findMatchedMember(task, members, membersLookup, matchedReport);

  const directRawAvatar =
    task.assignee_avatar ||
    task.user_avatar ||
    task.avatar_url ||
    task.avatar ||
    task.foto_profil ||
    task.user?.avatar_url ||
    task.user?.avatar ||
    matchedReport?.user_avatar ||
    matchedReport?.avatar_url ||
    matchedReport?.avatar ||
    matchedReport?.foto_profil ||
    (isImageUrlLike(task.assignee) ? task.assignee : '') ||
    '';

  let resolvedAvatarUrl = normalizeTaskAvatarUrl(directRawAvatar);

  // Fallback to user profile photo from database members list (/team/list.php + /profile/avatar/list.php)
  if (!resolvedAvatarUrl && matchedMember) {
    resolvedAvatarUrl = normalizeTaskAvatarUrl(matchedMember.avatar_url || matchedMember.img || '');
  }

  // Fallback to currently logged-in user's cached profile avatar if task belongs to current user
  if (!resolvedAvatarUrl) {
    const currentUser = getStoredUser();
    if (currentUser && currentUser.avatar_url) {
      const curEmail = (currentUser.email || '').trim().toLowerCase();
      const curName = (currentUser.name || currentUser.full_name || '').trim().toLowerCase();
      const curId = currentUser.id !== undefined ? String(currentUser.id).trim() : '';
      const tEmail = (task.assignee_email || task.user?.email || matchedReport?.user_email || '').trim().toLowerCase();
      const tName = (task.assignee_name || task.user_name || task.assignee || task.user?.name || '').trim().toLowerCase();
      const tId = String(task.assignee_id ?? task.user_id ?? task.user?.id ?? '').trim();

      if (
        (curId && tId && curId === tId) ||
        (curEmail && tEmail && curEmail === tEmail) ||
        (curName && tName && curName === tName)
      ) {
        resolvedAvatarUrl = normalizeTaskAvatarUrl(currentUser.avatar_url);
      }
    }
  }

  const safeAssigneeName =
    task.assignee && !isImageUrlLike(task.assignee) ? String(task.assignee).trim() : '';

  const userName = (
    task.assignee_name ||
    task.user_name ||
    task.user?.full_name ||
    task.user?.name ||
    matchedMember?.full_name ||
    matchedMember?.name ||
    safeAssigneeName ||
    matchedReport?.user_name ||
    matchedReport?.person ||
    (task.assignee_email ? String(task.assignee_email).split('@')[0] : '') ||
    'User'
  ).trim() || 'User';

  return {
    avatarUrl: resolvedAvatarUrl,
    userName,
  };
};

export const TaskAvatar: React.FC<TaskAvatarProps> = ({
  task,
  members,
  membersLookup,
  matchedReport,
  className,
}) => {
  const { avatarUrl, userName } = resolveTaskUserAvatar(
    task,
    members,
    membersLookup,
    matchedReport
  );
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={userName}
        title={userName}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className={
          className ||
          'w-6 h-6 rounded-full object-cover border border-black/10 shrink-0'
        }
      />
    );
  }

  return (
    <span
      title={userName}
      aria-label={userName}
      className={
        className
          ? `${className} bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0`
          : 'w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0'
      }
    >
      {userName.charAt(0).toUpperCase()}
    </span>
  );
};

export default TaskAvatar;
