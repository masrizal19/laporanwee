import React, { useState, useEffect } from 'react';
import { ViewType, PublicProfile } from '../types';
import { profileAvatarService, getAbsoluteAvatarUrl } from '../utils/api';
import '../profile-edit.css';

interface UserProfileViewProps {
  userId: string | number;
  onNavigate: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  userId,
  onNavigate,
  onAddToast,
}) => {
  const [profile, setProfile] = useState<PublicProfile | null>(() => {
    return profileAvatarService.getCached(userId) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!profile);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const data = await profileAvatarService.getUserProfile(userId);
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
  }, [userId, onAddToast]);

  const fullName = profile?.full_name || profile?.name || 'Anggota Tim';
  const profileTitle = profile?.profile_title || 'Belum diatur';
  const profileLocation = profile?.profile_location || 'Belum dipilih';
  const avatarUrl = profile?.avatar_url || null;
  const email = profile?.email || '';

  const getInitialsAvatar = () => {
    const initials = (fullName || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="%23222222"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="bold" fill="%23ffffff">${initials}</text></svg>`;
  };

  return (
    <div className="profile-page-root">
      {/* Top Bar Header */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('team')}
            aria-label="Kembali ke Tim"
            title="Kembali ke Tim"
          >
            ←
          </button>
          <span className="profile-brand-title">Profil Anggota Tim</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="profile-shell-main">
        <h1 className="profile-main-title">Profil Pengguna</h1>

        {isLoading && !profile ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Memuat profil pengguna...</div>
          </div>
        ) : (
          <>
            {/* Hero Section: Photo and Intro */}
            <section className="profile-hero-section">
              <div className="profile-hero-copy">
                <div className="profile-hero-kicker">PUBLIC PROFILE</div>
                <h2>{fullName}</h2>
                <p>
                  Identitas resmi anggota tim di LaporanWee Studio Creative.
                </p>
              </div>

              <div className="profile-avatar-stage">
                <div className="profile-avatar-wrap-box">
                  <img
                    id="userAvatar"
                    src={!imageError && avatarUrl ? getAbsoluteAvatarUrl(avatarUrl, fullName) : getInitialsAvatar()}
                    alt={fullName}
                    className="profile-avatar-element"
                    onError={() => {
                      setImageError(true);
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Rows Information List */}
            <section className="profile-rows-list">
              {/* Row 1: Name */}
              <div className="profile-detail-row" id="userNameRow">
                <div className="profile-row-label-text">NAME</div>
                <div className="profile-row-value-text" id="userName">
                  {fullName}
                </div>
              </div>

              {/* Row 2: Email */}
              {email ? (
                <div className="profile-detail-row" id="userEmailRow">
                  <div className="profile-row-label-text">EMAIL</div>
                  <div className="profile-row-value-text is-muted" id="userEmail">
                    {email}
                  </div>
                </div>
              ) : null}

              {/* Row 3: PEKERJAAN */}
              <div className="profile-detail-row" id="userJobRow">
                <div className="profile-row-label-text">PEKERJAAN</div>
                <div className="profile-row-value-text" id="userProfileTitle">
                  {profileTitle}
                </div>
              </div>

              {/* Row 4: STATUS */}
              <div className="profile-detail-row" id="userStatusRow">
                <div className="profile-row-label-text">STATUS</div>
                <div className="profile-row-value-text" id="userProfileStatus">
                  {profileLocation}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
