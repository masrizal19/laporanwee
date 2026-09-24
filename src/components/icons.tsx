import React from 'react';

export const Icon: React.FC<{ name: string; className?: string; style?: React.CSSProperties }> = ({
  name,
  className,
  style,
}) => {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case 'folder':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case 'bars':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M4 20V10M12 20V4M20 20v-7" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M4 12l6 6L20 6" />
        </svg>
      );
    case 'checksq':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
          <circle cx="17" cy="8" r="2.6" />
          <path d="M16 14.3c2.6.5 4.5 2.6 4.5 5.7" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'chevdown':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.6" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M16 10l6-3v10l-6-3z" />
        </svg>
      );
    case 'palette':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.3c0-1 .8-1.7 1.8-1.7h1.4A4.3 4.3 0 0 0 21 12.5C21 7.3 17 3 12 3z" />
          <circle cx="7.5" cy="10.5" r="1" />
          <circle cx="10" cy="7" r="1" />
          <circle cx="15" cy="7.5" r="1" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M8 6L2 12l6 6M16 6l6 6-6 6" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5l-7 4H4a1 1 0 0 0-1 1z" />
          <path d="M15 9a3 3 0 0 1 0 6" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M10 18h4" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case 'flag':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M5 21V4" />
          <path d="M5 4h13l-3 4.5L18 13H5" />
        </svg>
      );
    case 'target':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'arrowR':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'chevL':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case 'chevRt':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'laptop':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="4" y="4" width="16" height="11" rx="1.5" />
          <path d="M2 19h20" />
        </svg>
      );
    case 'doc':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M15 2v5h5" />
        </svg>
      );
    case 'image':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.7" />
          <path d="M21 16l-5.5-5.5L5 21" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case 'rocket':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M14 3c3 0 6 3 6 6-3 1-5 3-7 6l-5-5c3-2 5-4 6-7z" />
          <path d="M9 15l-4 1 1-4M9 15l3 3M15 9l3 3" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M4 20V10M12 20V4M20 20v-7" />
        </svg>
      );
    case 'pencil':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case 'send':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    default:
      return null;
  }
};

export const Illustration: React.FC<{ kind: string }> = ({ kind }) => {
  switch (kind) {
    case 'camera':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="6" y="20" width="46" height="32" rx="7" fill="#14131a" />
          <rect x="14" y="12" width="18" height="12" rx="4" fill="#14131a" />
          <circle cx="29" cy="36" r="13" fill="#fff" />
          <circle cx="29" cy="36" r="9" fill="#6a54f0" />
          <circle cx="46" cy="26" r="2.4" fill="#e9f95a" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="6" y="16" width="34" height="30" rx="6" fill="#14131a" />
          <path d="M40 26l16-8v28l-16-8z" fill="#14131a" />
          <rect x="14" y="24" width="18" height="14" rx="3" fill="#6a54f0" />
          <path d="M20 27l7 4-7 4z" fill="#fff" />
        </svg>
      );
    case 'palette':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M32 6a26 26 0 1 0 0 52c4.4 0 6-2.8 6-5.6 0-2.2-1.4-4-1.4-6.5 0-2.8 2.2-4.8 5-4.8h4A12 12 0 0 0 58 29C58 16.2 46.6 6 32 6z" fill="#14131a" />
          <circle cx="20" cy="26" r="3.4" fill="#e9f95a" />
          <circle cx="28" cy="16" r="3.4" fill="#6a54f0" />
          <circle cx="42" cy="18" r="3.4" fill="#ffd7e6" />
          <circle cx="45" cy="30" r="3" fill="#bdeee0" />
        </svg>
      );
    case 'laptop':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="8" y="12" width="48" height="30" rx="4" fill="#14131a" />
          <rect x="14" y="18" width="36" height="18" rx="2" fill="#6a54f0" />
          <path d="M20 24l6 4-6 4" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 30h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M2 46h60l-6 8H8z" fill="#14131a" />
        </svg>
      );
    case 'folder':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M8 18a4 4 0 0 1 4-4h12l5 5h23a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="#e9f95a" stroke="#14131a" strokeWidth="2" />
          <rect x="16" y="28" width="32" height="4" rx="2" fill="#14131a" />
          <rect x="16" y="36" width="22" height="4" rx="2" fill="#14131a" />
        </svg>
      );
    case 'doc':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M16 6h22l10 10v42H16z" fill="#fff" stroke="#14131a" strokeWidth="2" />
          <path d="M38 6v10h10" fill="none" stroke="#14131a" strokeWidth="2" />
          <rect x="22" y="28" width="20" height="3.4" rx="1.7" fill="#6a54f0" />
          <rect x="22" y="35" width="20" height="3.4" rx="1.7" fill="#ded6ff" />
          <rect x="22" y="42" width="12" height="3.4" rx="1.7" fill="#ded6ff" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="8" y="12" width="48" height="42" rx="6" fill="#fff" stroke="#14131a" strokeWidth="2" />
          <rect x="8" y="12" width="48" height="14" rx="6" fill="#6a54f0" />
          <rect x="18" y="4" width="4" height="12" rx="2" fill="#ff8fa8" />
          <rect x="42" y="4" width="4" height="12" rx="2" fill="#ff8fa8" />
          <rect x="16" y="34" width="8" height="8" rx="2" fill="#e9f95a" />
          <rect x="28" y="34" width="8" height="8" rx="2" fill="#ded6ff" />
          <rect x="40" y="34" width="8" height="8" rx="2" fill="#ded6ff" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M8 26v12a3 3 0 0 0 3 3h6l20 12V11L17 23h-6a3 3 0 0 0-3 3z" fill="#14131a" />
          <path d="M40 24a9 9 0 0 1 0 16" fill="none" stroke="#14131a" strokeWidth="3" strokeLinecap="round" />
          <rect x="12" y="41" width="7" height="10" rx="2" fill="#ffd7e6" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="18" y="4" width="28" height="56" rx="6" fill="#14131a" />
          <rect x="22" y="12" width="20" height="34" rx="2" fill="#6a54f0" />
          <circle cx="32" cy="52" r="2.4" fill="#fff" />
          <rect x="26" y="18" width="12" height="12" rx="2" fill="#ff5c8a" />
          <circle cx="42" cy="24" r="4" fill="#e9f95a" />
          <circle cx="26" cy="36" r="4" fill="#bdeee0" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 64 64">
          <rect x="8" y="34" width="10" height="24" rx="2" fill="#ded6ff" />
          <rect x="27" y="18" width="10" height="40" rx="2" fill="#e9f95a" />
          <rect x="46" y="26" width="10" height="32" rx="2" fill="#6a54f0" />
        </svg>
      );
    case 'people':
      return (
        <svg viewBox="0 0 64 64">
          <circle cx="24" cy="24" r="10" fill="#fff" />
          <path d="M8 54c0-10 7-16 16-16s16 6 16 16" fill="#fff" />
          <circle cx="44" cy="26" r="8" fill="#e9f95a" />
          <path d="M32 54c0-8 6-13 12-13s12 5 12 13" fill="#e9f95a" />
        </svg>
      );
    case 'clipboard':
    default:
      return (
        <svg viewBox="0 0 64 64">
          <rect x="12" y="8" width="40" height="52" rx="5" fill="#fff" stroke="#14131a" strokeWidth="2" />
          <rect x="22" y="3" width="20" height="10" rx="3" fill="#6a54f0" />
          <path d="M22 26l6 6 12-13" stroke="#e9f95a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="20" y="40" width="24" height="3.5" rx="1.7" fill="#ded6ff" />
          <rect x="20" y="48" width="16" height="3.5" rx="1.7" fill="#ded6ff" />
        </svg>
      );
  }
};
