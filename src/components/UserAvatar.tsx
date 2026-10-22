import React, { useState } from 'react';
import { getAbsoluteAvatarUrl } from '../utils/api';

export interface UserAvatarProps {
  item?: {
    name?: string;
    full_name?: string;
    avatar_url?: string | null;
    img?: string | null;
  } | null;
  name?: string;
  avatar_url?: string | null;
  size?: number | string;
  fontSize?: number | string;
  className?: string;
  style?: React.CSSProperties;
  backgroundColor?: string;
  color?: string;
  onClick?: () => void;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  item,
  name: propName,
  avatar_url: propAvatarUrl,
  size = '38px',
  fontSize,
  className = 'avatar',
  style = {},
  backgroundColor,
  color = '#ffffff',
  onClick,
  title,
}) => {
  const [imageError, setImageError] = useState(false);

  const rawName = propName || item?.full_name || item?.name || 'Pengguna';
  const rawAvatar = propAvatarUrl !== undefined ? propAvatarUrl : (item?.avatar_url || item?.img || null);
  const resolvedAvatarUrl = rawAvatar ? getAbsoluteAvatarUrl(rawAvatar, rawName) : null;
  const initial = (rawName || 'U').trim().charAt(0).toUpperCase();

  const formattedSize = typeof size === 'number' ? `${size}px` : size;
  const parsedSizeNum = typeof size === 'number' ? size : parseInt(size, 10) || 38;
  const computedFontSize = fontSize || `${Math.max(10, Math.round(parsedSizeNum * 0.38))}px`;

  const hasAvatar = Boolean(resolvedAvatarUrl) && !imageError;

  return (
    <div
      className={className}
      onClick={onClick}
      title={title || rawName}
      style={{
        width: formattedSize,
        height: formattedSize,
        borderRadius: '50%',
        overflow: 'hidden',
        background: backgroundColor || 'var(--primary-color, #4A55FF)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
    >
      {hasAvatar && (
        <img
          src={resolvedAvatarUrl!}
          alt={rawName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
            setImageError(true);
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fallback = parent.querySelector('.avatar-initial') as HTMLElement | null;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }
          }}
        />
      )}
      <span
        className="avatar-initial"
        style={{
          display: hasAvatar ? 'none' : 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          fontSize: computedFontSize,
          fontWeight: 700,
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  );
};
