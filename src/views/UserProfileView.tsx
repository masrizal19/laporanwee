import React, { useState, useEffect } from 'react';
import { ViewType, PublicProfile } from '../types';
import { profileAvatarService, getAbsoluteAvatarUrl, teamService } from '../utils/api';
import '../profile-edit.css';

interface UserProfileViewProps {
  userId?: string | number;
  onNavigate: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

const JOB_OPTIONS = [
  'EDITOR',
  'VIDEO EDITOR',
  'Desainer Grafis',
  'Art Director',
  'Copywriter',
  'Social Media',
];

const STATUS_OPTIONS = ['Karyawan', 'Anak Magang', 'Anak PKL'];

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  userId,
  onNavigate,
  onAddToast,
}) => {
  // Resolve effective target ID from prop or URL parameter
  const queryId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('id') ||
        new URLSearchParams(window.location.search).get('userId') ||
        ''
      : '';
  const effectiveUserId =
    userId !== undefined && userId !== null && String(userId).trim() !== ''
      ? String(userId).trim()
      : queryId;

  const [profile, setProfile] = useState<PublicProfile | null>(() => {
    return effectiveUserId ? profileAvatarService.getCached(effectiveUserId) || null : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!profile);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      if (!effectiveUserId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let data = await profileAvatarService.getUserProfile(effectiveUserId, true);

        // Fallback: search in team members if direct profile returns null
        if (!data) {
          const teamData = await teamService.fetchTeamMembers();
          const found = teamData.members.find(
            (m) =>
              String(m.id).trim() === effectiveUserId ||
              String(m.user_id).trim() === effectiveUserId
          );
          if (found) {
            data = {
              id: found.id,
              user_id: found.id,
              name: found.full_name || found.name || 'Anggota Tim',
              full_name: found.full_name || found.name || 'Anggota Tim',
              email: found.email || '',
              role: found.role || 'Anggota Tim',
              avatar_url: found.avatar_url || found.img || null,
              profile_title: found.profile_title || 'VIDEO EDITOR',
              profile_location: found.profile_location || 'Karyawan',
            };
          }
        }

        if (isMounted) {
          if (data) {
            setProfile(data);
          } else if (onAddToast) {
            onAddToast('Data profil anggota tidak ditemukan.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[UserProfileView] Error fetching user profile:', err);
          if (onAddToast) onAddToast(err?.message || 'Gagal memuat profil anggota tim.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [effectiveUserId, onAddToast]);

  const fullName = profile?.full_name || profile?.name || 'Anggota Tim';
  const profileTitle = profile?.profile_title || 'VIDEO EDITOR';
  const profileLocation = profile?.profile_location || 'Karyawan';
  const avatarUrl = profile?.avatar_url || null;
  const email = profile?.email || '';
  const role = profile?.role || 'Anggota Tim';

  // Helper for generating neat 1-2 letter initials
  const getInitials = (nameStr: string): string => {
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleBackToTeam = () => {
    if (onNavigate) {
      onNavigate('team');
    } else if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '85vh',
        padding: '24px 16px 60px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Breadcrumb Navigation */}
      <div
        style={{
          width: 'min(680px, 94%)',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={handleBackToTeam}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--muted, #7d7a8c)',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 0',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink, #1f1d2b)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted, #7d7a8c)')}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Kembali ke Tim</span>
        </button>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted, #8b8898)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Public Profile
        </span>
      </div>

      {/* Main Glassmorphism Card Container */}
      <div
        style={{
          width: 'min(680px, 94%)',
          margin: '0 auto',
          background: 'var(--glass-solid, rgba(255, 255, 255, 0.95))',
          backdropFilter: 'blur(22px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
          borderRadius: '32px',
          border: '1px solid var(--line, rgba(31, 29, 43, 0.09))',
          boxShadow: '0 24px 60px -20px rgba(60, 50, 110, 0.15)',
          padding: '28px 32px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {isLoading && !profile ? (
          <div
            style={{
              padding: '80px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                border: '3px solid rgba(212, 238, 107, 0.3)',
                borderTopColor: '#d4ee6b',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--muted, #7d7a8c)' }}>
              Memuat profil anggota tim...
            </span>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* 1. TOP HEADER WIDGET */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '18px 20px',
                marginBottom: '26px',
                background: 'var(--glass, rgba(245, 245, 250, 0.8))',
                borderRadius: '24px',
                border: '1px solid var(--line, rgba(31, 29, 43, 0.08))',
                boxShadow: '0 4px 18px -6px rgba(0, 0, 0, 0.04)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {/* Circular Avatar */}
                <div
                  style={{
                    position: 'relative',
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    boxShadow:
                      '0 0 0 4px rgba(255, 255, 255, 0.9), 0 8px 20px -6px rgba(60, 50, 110, 0.25)',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #cfc6f4 0%, #d4ee6b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!imageError && avatarUrl ? (
                    <img
                      src={getAbsoluteAvatarUrl(avatarUrl, fullName)}
                      alt={fullName}
                      onError={() => setImageError(true)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: '#23212e',
                        letterSpacing: '0.04em',
                        userSelect: 'none',
                      }}
                    >
                      {getInitials(fullName)}
                    </span>
                  )}
                </div>

                {/* Center Text */}
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: '19px',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--ink, #1f1d2b)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {fullName}
                  </h2>
                  <p
                    style={{
                      fontSize: '13.5px',
                      color: 'var(--muted, #7d7a8c)',
                      margin: '4px 0 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {email ? `${email} • ` : ''}
                    <span style={{ fontWeight: 600, color: 'var(--ink, #1f1d2b)' }}>
                      {profileTitle.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              {/* Right Side: Role Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: 'rgba(212, 238, 107, 0.25)',
                    border: '1px solid rgba(212, 238, 107, 0.6)',
                    color: '#23212e',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#4a9d6b',
                      display: 'inline-block',
                    }}
                  />
                  {role && role.toLowerCase() !== 'user' ? role : 'Anggota Tim'}
                </span>
              </div>
            </div>

            {/* 2. SECTION INFORMASI HEADER */}
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  fontWeight: 700,
                  color: 'var(--muted, #8b8898)',
                  textTransform: 'uppercase',
                }}
              >
                INFORMASI
              </div>
              <h3
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  marginTop: '4px',
                  marginBottom: '4px',
                  color: 'var(--ink, #1f1d2b)',
                  letterSpacing: '-0.01em',
                }}
              >
                Informasi Profil
              </h3>
              <p
                style={{
                  fontSize: '13.5px',
                  color: '#7d7a8c',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Identitas resmi anggota tim di LaporanWee Studio Creative.
              </p>
            </div>

            {/* 3. READ-ONLY DISPLAY CARDS */}
            <div style={{ marginBottom: '22px' }}>
              {/* Field 1: Nama Lengkap */}
              <div
                style={{
                  height: '62px',
                  borderRadius: '18px',
                  border: '1.5px solid rgba(31, 29, 43, 0.08)',
                  background: 'var(--glass, rgba(255, 255, 255, 0.7))',
                  padding: '10px 18px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px -4px rgba(0, 0, 0, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--muted, #8b8898)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: 1.2,
                  }}
                >
                  Nama Lengkap
                </span>
                <span
                  style={{
                    fontSize: '15.5px',
                    fontWeight: 700,
                    color: 'var(--ink, #1f1d2b)',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {fullName}
                </span>
              </div>

              {/* Field 2: Email */}
              <div
                style={{
                  height: '62px',
                  borderRadius: '18px',
                  border: '1.5px solid rgba(31, 29, 43, 0.08)',
                  background: 'var(--glass, rgba(255, 255, 255, 0.7))',
                  padding: '10px 18px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px -4px rgba(0, 0, 0, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--muted, #8b8898)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: 1.2,
                  }}
                >
                  Email
                </span>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: email ? 'var(--ink, #1f1d2b)' : 'var(--muted, #8b8898)',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {email || 'Belum ada email'}
                </span>
              </div>

              {/* Field 3: Pekerjaan */}
              <div
                style={{
                  height: '62px',
                  borderRadius: '18px',
                  border: '1.5px solid rgba(31, 29, 43, 0.08)',
                  background: 'var(--glass, rgba(255, 255, 255, 0.7))',
                  padding: '10px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px -4px rgba(0, 0, 0, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--muted, #8b8898)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: 1.2,
                  }}
                >
                  Pekerjaan
                </span>
                <span
                  style={{
                    fontSize: '15.5px',
                    fontWeight: 700,
                    color: 'var(--ink, #1f1d2b)',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {profileTitle}
                </span>
              </div>
            </div>

            {/* 4. PILL TAGS: PILIH PEKERJAAN */}
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--muted, #8b8898)',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                }}
              >
                PILIH PEKERJAAN
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {JOB_OPTIONS.map((j) => {
                  const isSelected =
                    profileTitle.toLowerCase().trim() === j.toLowerCase().trim();
                  return (
                    <div
                      key={j}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '999px',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                        userSelect: 'none',
                        ...(isSelected
                          ? {
                              background: '#d4ee6b',
                              border: '1.5px solid #d4ee6b',
                              color: '#23212e',
                              fontWeight: 700,
                              boxShadow: '0 6px 16px -4px rgba(212, 238, 107, 0.65)',
                            }
                          : {
                              background: 'var(--glass, rgba(255, 255, 255, 0.7))',
                              border: '1.5px solid var(--line, rgba(31, 29, 43, 0.08))',
                              color: 'var(--ink, #1f1d2b)',
                              fontWeight: 500,
                            }),
                      }}
                    >
                      {j}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. PILL TAGS: STATUS TIM */}
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--muted, #8b8898)',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                }}
              >
                STATUS TIM
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {STATUS_OPTIONS.map((s) => {
                  const isSelected =
                    profileLocation.toLowerCase().trim() === s.toLowerCase().trim();
                  return (
                    <div
                      key={s}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '999px',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                        userSelect: 'none',
                        ...(isSelected
                          ? {
                              background: '#d4ee6b',
                              border: '1.5px solid #d4ee6b',
                              color: '#23212e',
                              fontWeight: 700,
                              boxShadow: '0 6px 16px -4px rgba(212, 238, 107, 0.65)',
                            }
                          : {
                              background: 'var(--glass, rgba(255, 255, 255, 0.7))',
                              border: '1.5px solid var(--line, rgba(31, 29, 43, 0.08))',
                              color: 'var(--ink, #1f1d2b)',
                              fontWeight: 500,
                            }),
                      }}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. TOMBOL NAVIGASI: KEMBALI KE TIM */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                borderTop: '1px solid var(--line, rgba(31, 29, 43, 0.08))',
                paddingTop: '24px',
              }}
            >
              <button
                type="button"
                onClick={handleBackToTeam}
                className="btn dark"
                style={{
                  width: 'auto',
                  minWidth: '170px',
                  padding: '0 28px',
                  height: '48px',
                  fontSize: '14px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'var(--dark, #23212e)',
                  color: 'var(--on-dark, #ffffff)',
                  boxShadow: '0 14px 26px -14px rgba(35, 33, 46, 0.7)',
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Kembali ke Tim</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfileView;
