import React from 'react';

export const Icon: React.FC<{
  name: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}> = ({ name, className, style, size }) => {
  const defaultSize = 20;
  const computedWidth = size || (typeof style?.width === 'number' ? style.width : defaultSize);
  const computedHeight = size || (typeof style?.height === 'number' ? style.height : computedWidth);

  const finalStyle: React.CSSProperties = {
    flexShrink: 0,
    width: computedWidth,
    height: computedHeight,
    ...style,
  };

  const renderStroke = (content: React.ReactNode, strokeW = 2) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeW}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={computedWidth}
      height={computedHeight}
      className={className}
      style={finalStyle}
    >
      {content}
    </svg>
  );

  const renderFilled = (content: React.ReactNode) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width={computedWidth}
      height={computedHeight}
      className={className}
      style={finalStyle}
    >
      {content}
    </svg>
  );

  switch (name) {
    case 'home':
      return renderStroke(
        <>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </>
      );
    case 'folder':
      return renderStroke(
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      );
    case 'bars':
      return renderStroke(
        <path d="M4 20V10M12 20V4M20 20v-7" />
      );
    case 'check':
      return renderStroke(
        <path d="M4 12l6 6L20 6" />,
        2.2
      );
    case 'checksq':
      return renderStroke(
        <>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12l3 3 5-6" />
        </>,
        2
      );
    case 'users':
      return renderStroke(
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
          <circle cx="17" cy="8" r="2.6" />
          <path d="M16 14.3c2.6.5 4.5 2.6 4.5 5.7" />
        </>
      );
    case 'calendar':
      return renderStroke(
        <>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </>
      );
    case 'bell':
      return renderStroke(
        <>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      );
    case 'chevdown':
      return renderStroke(
        <path d="M6 9l6 6 6-6" />,
        2.2
      );
    case 'camera':
      return renderStroke(
        <>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.6" />
        </>,
        1.9
      );
    case 'video':
      return renderStroke(
        <>
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M16 10l6-3v10l-6-3z" />
        </>,
        1.9
      );
    case 'palette':
      return renderStroke(
        <>
          <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.3c0-1 .8-1.7 1.8-1.7h1.4A4.3 4.3 0 0 0 21 12.5C21 7.3 17 3 12 3z" />
          <circle cx="7.5" cy="10.5" r="1" />
          <circle cx="10" cy="7" r="1" />
          <circle cx="15" cy="7.5" r="1" />
        </>,
        1.9
      );
    case 'code':
      return renderStroke(
        <path d="M8 6L2 12l6 6M16 6l6 6-6 6" />,
        1.9
      );
    case 'megaphone':
      return renderStroke(
        <>
          <path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5l-7 4H4a1 1 0 0 0-1 1z" />
          <path d="M15 9a3 3 0 0 1 0 6" />
        </>,
        1.9
      );
    case 'phone':
      return renderStroke(
        <>
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M10 18h4" />
        </>,
        1.9
      );
    case 'clock':
      return renderStroke(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </>,
        2
      );
    case 'flag':
      return renderStroke(
        <>
          <path d="M5 21V4" />
          <path d="M5 4h13l-3 4.5L18 13H5" />
        </>,
        2
      );
    case 'target':
      return renderStroke(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </>,
        1.9
      );
    case 'arrowR':
      return renderStroke(
        <path d="M5 12h14M13 6l6 6-6 6" />,
        2.2
      );
    case 'plus':
      return renderStroke(
        <path d="M12 5v14M5 12h14" />,
        2.2
      );
    case 'search':
      return renderStroke(
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </>,
        2
      );
    case 'chevL':
    case 'chevron-left':
    case 'ChevronLeft':
      return renderStroke(
        <path d="M15 18l-6-6 6-6" />,
        2.2
      );
    case 'chevR':
    case 'chevRt':
    case 'chevron-right':
    case 'ChevronRight':
      return renderStroke(
        <path d="M9 18l6-6-6-6" />,
        2.2
      );
    case 'dots':
      return renderFilled(
        <>
          <circle cx="12" cy="6" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="18" r="1.8" />
        </>
      );
    case 'x':
      return renderStroke(
        <path d="M18 6L6 18M6 6l12 12" />,
        2.2
      );
    case 'spark':
    case 'sparkles':
      return renderFilled(
        <path d="M12 2l2.4 6.8L21 11.2l-5.4 4.5 1.7 6.9-5.3-3.6-5.3 3.6 1.7-6.9L3 11.2l6.6-2.4z" />
      );
    case 'doc':
      return renderStroke(
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </>,
        1.9
      );
    case 'image':
      return renderStroke(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </>,
        1.9
      );
    case 'play':
      return renderFilled(
        <path d="M8 5v14l11-7z" />
      );
    case 'rocket':
      return renderStroke(
        <>
          <path d="M14 3c3 0 6 3 6 6-3 1-5 3-7 6l-5-5c3-2 5-4 6-7z" />
          <path d="M9 15l-4 1 1-4M9 15l3 3M15 9l3 3" />
        </>,
        1.9
      );
    case 'chart':
      return renderStroke(
        <path d="M4 20V10M12 20V4M20 20v-7" />,
        1.9
      );
    case 'pencil':
      return renderStroke(
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </>,
        1.9
      );
    case 'send':
      return renderStroke(
        <>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4z" />
        </>,
        2
      );
    case 'sliders':
    case 'settings':
      return renderStroke(
        <>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </>,
        2
      );
    case 'refresh':
      return renderStroke(
        <>
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </>,
        2
      );
    case 'upload':
      return renderStroke(
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </>,
        2
      );
    case 'trash':
    case 'delete':
      return renderStroke(
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </>,
        1.9
      );
    case 'share':
      return renderStroke(
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </>,
        2
      );
    case 'instagram':
      return renderStroke(
        <>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
        </>,
        2
      );
    case 'tiktok':
      return renderStroke(
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />,
        2
      );
    case 'youtube':
      return renderStroke(
        <>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none" />
        </>,
        2
      );
    case 'facebook':
      return renderStroke(
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
        2
      );
    case 'twitter':
    case 'x':
      return renderStroke(
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />,
        2
      );
    case 'globe':
      return renderStroke(
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </>,
        2
      );
    case 'trending-up':
      return renderStroke(
        <>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </>,
        2.2
      );
    case 'trending-down':
      return renderStroke(
        <>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </>,
        2.2
      );
    case 'external':
    case 'external-link':
      return renderStroke(
        <>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </>,
        2
      );
    default:
      return null;
  }
};
