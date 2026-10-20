import React from 'react';

export const ICONS = {
  home: (
    <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  task: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  chart: (
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  ),
  plus: (
    <path d="M12 5v14M5 12h14" />
  ),
  check: (
    <path d="m5 12 4.5 4.5L19 7" />
  ),
  logo: (
    <>
      <path d="M5 13c3-6 11-6 14 0" />
      <path d="M8 17c2-3 6-3 8 0" />
    </>
  ),
  logout: (
    <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: (
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 8 8 6 8-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  arrowRight: (
    <path d="M5 12h14M13 6l6 6-6 6" />
  ),
  pen: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  close: (
    <path d="M6 6l12 12M18 6 6 18" />
  ),
  rotate: (
    <>
      <path d="M4 9a8 8 0 1 1-1 5" />
      <path d="M4 4v5h5" />
    </>
  ),
  flip: (
    <>
      <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
  upload: (
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  ),
};

export interface IconProps {
  name: keyof typeof ICONS;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LwIcon: React.FC<IconProps> = ({
  name,
  size = 20,
  strokeWidth = 1.8,
  className = '',
  style = {},
}) => {
  const content = ICONS[name];
  if (!content) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      style={style}
    >
      {content}
    </svg>
  );
};
