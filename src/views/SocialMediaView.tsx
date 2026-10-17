import React, { useState, useEffect, useMemo } from 'react';
import { ViewType, AuthUser, SocialMediaDataResponse, SocialMediaAccount } from '../types';
import { Icon } from '../components/icons';
import { socialMediaService, formatApiErrorMessage } from '../utils/api';

interface SocialMediaViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  currentUser?: AuthUser | null;
  isAdmin?: boolean;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PLATFORMS = [
  { id: 'Instagram', name: 'Instagram', icon: 'instagram', color: '#E1306C', bg: 'rgba(225, 48, 108, 0.1)' },
  { id: 'TikTok', name: 'TikTok', icon: 'tiktok', color: '#000000', bg: 'rgba(0, 0, 0, 0.08)' },
  { id: 'YouTube', name: 'YouTube', icon: 'youtube', color: '#FF0000', bg: 'rgba(255, 0, 0, 0.1)' },
  { id: 'Facebook', name: 'Facebook', icon: 'facebook', color: '#1877F2', bg: 'rgba(24, 119, 242, 0.1)' },
  { id: 'Twitter/X', name: 'Twitter / X', icon: 'twitter', color: '#0f1419', bg: 'rgba(15, 20, 25, 0.08)' },
  { id: 'Lainnya', name: 'Lainnya / Website', icon: 'globe', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.1)' },
];

export const SocialMediaView: React.FC<SocialMediaViewProps> = ({
  onNavigate,
  onAddToast,
  currentUser,
  isAdmin,
}) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  
  const [data, setData] = useState<SocialMediaDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [accountToUpdate, setAccountToUpdate] = useState<SocialMediaAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<SocialMediaAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form: Tambah Akun
  const [newPlatform, setNewPlatform] = useState('Instagram');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountHandle, setNewAccountHandle] = useState('');
  const [newAccountUrl, setNewAccountUrl] = useState('');

  // Form: Update Metrik
  const [metricStartFollowers, setMetricStartFollowers] = useState<number | string>(0);
  const [metricEndFollowers, setMetricEndFollowers] = useState<number | string>(0);
  const [metricPostsCount, setMetricPostsCount] = useState<number | string>(0);
  const [metricNotes, setMetricNotes] = useState('');

  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await socialMediaService.getData(selectedMonth, selectedYear);
      setData(res);
    } catch (err: any) {
      console.error('[SocialMedia] Fetch error:', err);
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Open Metrics Modal
  const openMetricsModal = (account: SocialMediaAccount) => {
    setAccountToUpdate(account);
    setMetricStartFollowers(account.followers_start !== undefined ? account.followers_start : 0);
    setMetricEndFollowers(account.followers_end !== undefined ? account.followers_end : 0);
    setMetricPostsCount(account.posts_count !== undefined ? account.posts_count : 0);
    setMetricNotes(account.notes || '');
    setIsMetricsModalOpen(true);
  };

  // Submit Tambah Akun
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      onAddToast('Nama akun wajib diisi!');
      return;
    }
    if (!newAccountHandle.trim()) {
      onAddToast('Handle akun (misal @smk_official) wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await socialMediaService.addAccount({
        platform: newPlatform,
        account_name: newAccountName.trim(),
        account_handle: newAccountHandle.trim(),
        account_url: newAccountUrl.trim() || '#',
      });
      onAddToast(res.message || 'Akun sosial media berhasil ditambahkan!');
      setIsAddAccountModalOpen(false);
      setNewAccountName('');
      setNewAccountHandle('');
      setNewAccountUrl('');
      await fetchData();
    } catch (err: any) {
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Simpan Metrik
  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountToUpdate) return;

    const start = Number(metricStartFollowers) || 0;
    const end = Number(metricEndFollowers) || 0;
    const posts = Number(metricPostsCount) || 0;

    setIsSubmitting(true);
    try {
      const res = await socialMediaService.saveMetrics({
        account_id: accountToUpdate.id,
        month: selectedMonth,
        year: selectedYear,
        followers_start: start,
        followers_end: end,
        posts_count: posts,
        notes: metricNotes.trim(),
      });
      onAddToast(res.message || 'Metrik perkembangan berhasil disimpan!');
      setIsMetricsModalOpen(false);
      setAccountToUpdate(null);
      await fetchData();
    } catch (err: any) {
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Hapus Akun
  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await socialMediaService.deleteAccount(accountToDelete.id);
      onAddToast(res.message || 'Akun berhasil dihapus.');
      setAccountToDelete(null);
      await fetchData();
    } catch (err: any) {
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (!data?.accounts) return [];
    return data.accounts.filter((acc) => {
      const matchesPlatform =
        selectedPlatformFilter === 'all' ||
        acc.platform.toLowerCase() === selectedPlatformFilter.toLowerCase();
      const matchesSearch =
        acc.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.account_handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.platform.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesSearch;
    });
  }, [data?.accounts, selectedPlatformFilter, searchQuery]);

  // Calculated Realtime Growth for modal
  const liveDiff = useMemo(() => {
    const s = Number(metricStartFollowers) || 0;
    const e = Number(metricEndFollowers) || 0;
    return e - s;
  }, [metricStartFollowers, metricEndFollowers]);

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return 'instagram';
    if (p.includes('tiktok')) return 'tiktok';
    if (p.includes('youtube')) return 'youtube';
    if (p.includes('facebook')) return 'facebook';
    if (p.includes('twitter') || p.includes('x')) return 'twitter';
    return 'globe';
  };

  const getPlatformColor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('instagram')) return '#E1306C';
    if (p.includes('tiktok')) return '#0f172a';
    if (p.includes('youtube')) return '#dc2626';
    if (p.includes('facebook')) return '#2563eb';
    if (p.includes('twitter') || p.includes('x')) return '#1e293b';
    return '#6366f1';
  };

  return (
    <div className="analytics-view motion-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Top Header & Filters */}
      <div className="view-header" style={{ marginBottom: '24px' }}>
        <div className="header-left">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 text-xs font-semibold rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              Manajemen &amp; Rekapan
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Multi-Account System
            </span>
          </div>
          <h1 className="view-title" style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>
            Sosial Media Sekolah
          </h1>
          <p className="view-subtitle" style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '13.5px' }}>
            Pantau pertumbuhan followers, aktivitas publikasi konten, dan evaluasi performa seluruh channel media sosial.
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <select
            className="filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line-soft)',
              background: 'var(--paper)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            className="filter-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line-soft)',
              background: 'var(--paper)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            className="icon-btn"
            onClick={fetchData}
            title="Muat ulang data"
            style={{
              padding: '8px',
              borderRadius: '10px',
              border: '1px solid var(--line-soft)',
              background: 'var(--paper)',
              cursor: 'pointer',
            }}
          >
            <Icon name="refresh" className={isLoading ? 'spin' : ''} style={{ width: 16, height: 16 }} />
          </button>

          {/* Add Account Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddAccountModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <Icon name="plus" style={{ width: 16, height: 16 }} />
            <span>+ Tambah Akun</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Total Pertumbuhan Followers */}
        <div
          className="stat-card"
          style={{
            background: 'var(--paper)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--line-soft)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pertumbuhan Followers
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: (data?.summary?.total_growth || 0) >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: (data?.summary?.total_growth || 0) >= 0 ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={(data?.summary?.total_growth || 0) >= 0 ? 'trending-up' : 'trending-down'} style={{ width: 18, height: 18 }} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              {(data?.summary?.total_growth || 0) > 0 ? `+${(data?.summary?.total_growth || 0).toLocaleString()}` : (data?.summary?.total_growth || 0).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: (data?.summary?.total_growth || 0) >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: (data?.summary?.total_growth || 0) >= 0 ? '#059669' : '#dc2626',
                  border: (data?.summary?.total_growth || 0) >= 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                }}
              >
                {(data?.summary?.total_growth || 0) >= 0 ? 'Net Positif' : 'Penurunan'}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Konten Terupload */}
        <div
          className="stat-card"
          style={{
            background: 'var(--paper)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--line-soft)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Konten Terupload
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: 'rgba(74, 85, 255, 0.1)',
                color: 'var(--primary-color, #4A55FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="rocket" style={{ width: 18, height: 18 }} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              {(data?.summary?.total_posts || 0).toLocaleString()}
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)', marginLeft: '6px' }}>
                Post
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '6px' }}>
              Total postingan gabungan seluruh channel
            </div>
          </div>
        </div>

        {/* Card 3: Akun Aktif Terkelola */}
        <div
          className="stat-card"
          style={{
            background: 'var(--paper)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--line-soft)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Akun Terdaftar
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.1)',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="share" style={{ width: 18, height: 18 }} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              {data?.accounts?.length || 0}
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)', marginLeft: '6px' }}>
                Akun
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '6px' }}>
              Mendukung multi-akun per platform
            </div>
          </div>
        </div>

        {/* Card 4: Periode Monitoring */}
        <div
          className="stat-card"
          style={{
            background: 'var(--paper)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--line-soft)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Status Sinkronisasi
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: 'rgba(14, 165, 233, 0.1)',
                color: '#0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="clock" style={{ width: 18, height: 18 }} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '8px' }}>
              Tersinkronisasi otomatis dengan server MySQL mkverse.my.id
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Platform Breakdown */}
      <div className="mb-8">
        <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '14px', color: 'var(--text)' }}>
          Akumulasi Performa Platform
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.summary?.by_platform ? (
            Object.entries(data.summary.by_platform).map(([platformKey, item]) => {
              const iconName = getPlatformIcon(platformKey);
              const brandColor = getPlatformColor(platformKey);

              return (
                <div
                  key={platformKey}
                  style={{
                    background: 'var(--paper)',
                    borderRadius: '16px',
                    padding: '16px 18px',
                    border: '1px solid var(--line-soft)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '8px',
                          background: `${brandColor}18`,
                          color: brandColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={iconName} style={{ width: 15, height: 15 }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                        {platformKey}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--subtle)',
                        fontWeight: 600,
                        color: 'var(--muted)',
                      }}
                    >
                      {item.accounts_count} Akun
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
                        Total Followers
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                        {(item.end_followers || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
                        Kenaikan Bersih
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: (item.growth || 0) >= 0 ? '#10b981' : '#ef4444',
                          marginTop: '2px',
                        }}
                      >
                        {(item.growth || 0) > 0 ? `+${(item.growth || 0).toLocaleString()}` : (item.growth || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                    Publikasi: <b style={{ color: 'var(--text)' }}>{item.posts_count || 0} post</b> bulan ini
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Memuat data platform...</div>
          )}
        </div>
      </div>

      {/* Multi-Account Management Section */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Daftar Akun Sosial Media Sekolah
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', margin: 0 }}>
              Kelola metrik bulanan per akun dan lihat riwayat perubahan secara detail.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Cari akun..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px',
                  borderRadius: '10px',
                  border: '1px solid var(--line-soft)',
                  background: 'var(--paper)',
                  fontSize: '12.5px',
                  width: '180px',
                }}
              />
              <div style={{ position: 'absolute', left: '9px', top: '8px', color: 'var(--muted)' }}>
                <Icon name="search" style={{ width: 14, height: 14 }} />
              </div>
            </div>

            {/* Platform Filter Tabs */}
            <select
              value={selectedPlatformFilter}
              onChange={(e) => setSelectedPlatformFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                border: '1px solid var(--line-soft)',
                background: 'var(--paper)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">Semua Platform</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
              <option value="Facebook">Facebook</option>
              <option value="Twitter/X">Twitter / X</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
        </div>

        {/* Account Cards Grid */}
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
            <Icon name="loader" className="spin" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Memuat daftar akun sosial media...</div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--paper)',
              borderRadius: '24px',
              border: '2px dashed var(--line-soft)',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '16px',
                background: 'rgba(74, 85, 255, 0.08)',
                color: 'var(--primary-color, #4A55FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Icon name="share" style={{ width: 24, height: 24 }} />
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>
              Belum Ada Akun Sosial Media
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
              Tambahkan akun media sosial sekolah (seperti Instagram Resmi, TikTok OSIS, Channel YouTube Humas, dll) untuk mulai melacak performanya.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddAccountModalOpen(true)}
              style={{ padding: '9px 20px', borderRadius: '12px', fontSize: '13.5px', fontWeight: 700 }}
            >
              + Tambah Akun Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAccounts.map((account) => {
              const platformIcon = getPlatformIcon(account.platform);
              const brandColor = getPlatformColor(account.platform);
              const growthVal = account.growth !== undefined ? account.growth : (account.followers_end || 0) - (account.followers_start || 0);
              const isPositive = growthVal >= 0;

              return (
                <div
                  key={account.id}
                  style={{
                    background: 'var(--paper)',
                    borderRadius: '20px',
                    border: '1px solid var(--line-soft)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  className="hover:shadow-lg transition-all"
                >
                  {/* Card Header: Platform, Name, Handle, External link */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '12px',
                            background: `${brandColor}18`,
                            color: brandColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name={platformIcon} style={{ width: 20, height: 20 }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                            {account.account_name}
                          </h4>
                          <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 500 }}>
                            {account.account_handle}
                          </span>
                        </div>
                      </div>

                      {/* External profile link */}
                      {account.account_url && account.account_url !== '#' && (
                        <a
                          href={account.account_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka profil di tab baru"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '8px',
                            background: 'var(--subtle)',
                            color: 'var(--muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none',
                          }}
                          className="hover:text-blue-600 transition"
                        >
                          <Icon name="external" style={{ width: 14, height: 14 }} />
                        </a>
                      )}
                    </div>

                    {/* Metrics Display Box for Selected Period */}
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '14px',
                        background: 'var(--subtle)',
                        borderRadius: '14px',
                        border: '1px solid var(--line-soft)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                          Periode: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            background: isPositive ? '#ecfdf5' : '#fef2f2',
                            color: isPositive ? '#059669' : '#dc2626',
                          }}
                        >
                          {growthVal > 0 ? `+${growthVal.toLocaleString()}` : growthVal.toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Awal Bulan</div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, marginTop: '2px' }}>
                            {(account.followers_start || 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Akhir Bulan</div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, marginTop: '2px' }}>
                            {(account.followers_end || 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Konten Terbit</div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, marginTop: '2px', color: 'var(--primary-color, #4A55FF)' }}>
                            {account.posts_count || 0}
                          </div>
                        </div>
                      </div>

                      {account.notes && (
                        <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic', borderTop: '1px dashed var(--line-soft)', paddingTop: '6px' }}>
                          "{account.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--line-soft)' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openMetricsModal(account)}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: '9px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <Icon name="pencil" style={{ width: 13, height: 13 }} />
                      <span>Input Metrik</span>
                    </button>

                    <button
                      type="button"
                      title="Hapus Akun"
                      onClick={() => setAccountToDelete(account)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '9px',
                        background: 'transparent',
                        border: '1px solid var(--line-soft)',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                      className="hover:text-red-600 hover:border-red-300 transition"
                    >
                      <Icon name="trash" style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: TAMBAH AKUN BARU */}
      {isAddAccountModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => !isSubmitting && setIsAddAccountModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--paper)',
              borderRadius: '24px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  Tambah Akun Sosial Media
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
                  Daftarkan profil media sosial baru untuk sekolah atau unit jurusan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <Icon name="x" style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleAddAccount}>
              {/* Platform Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => {
                    const isSelected = newPlatform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewPlatform(p.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '12px',
                          border: isSelected ? `2px solid ${p.color}` : '1px solid var(--line-soft)',
                          background: isSelected ? p.bg : 'var(--paper)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ color: p.color }}>
                          <Icon name={p.icon} style={{ width: 18, height: 18 }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: isSelected ? 800 : 600, color: 'var(--text)' }}>
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nama Akun */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Nama Akun / Deskripsi
                </label>
                <input
                  type="text"
                  placeholder="Misal: Akun Utama Sekolah, OSIS SMK, Humas"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Handle */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Handle Akun
                </label>
                <input
                  type="text"
                  placeholder="Misal: @smk_official"
                  value={newAccountHandle}
                  onChange={(e) => setNewAccountHandle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* URL Profil */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  URL Profil / Link Luar (Opsional)
                </label>
                <input
                  type="url"
                  placeholder="https://instagram.com/smk_official"
                  value={newAccountUrl}
                  onChange={(e) => setNewAccountUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  disabled={isSubmitting}
                  style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INPUT / UPDATE METRIK BULANAN */}
      {isMetricsModalOpen && accountToUpdate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => !isSubmitting && setIsMetricsModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--paper)',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'var(--subtle)' }}>
                    {accountToUpdate.platform}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {accountToUpdate.account_handle}
                  </span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  Input Metrik: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMetricsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <Icon name="x" style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveMetrics}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Followers Awal */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                    Followers Awal Bulan
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricStartFollowers}
                    onChange={(e) => setMetricStartFollowers(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--line-soft)',
                      background: 'var(--paper)',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                </div>

                {/* Followers Akhir */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                    Followers Akhir Bulan
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricEndFollowers}
                    onChange={(e) => setMetricEndFollowers(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--line-soft)',
                      background: 'var(--paper)',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Live Preview Pertumbuhan */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: liveDiff >= 0 ? '#ecfdf5' : '#fef2f2',
                  border: liveDiff >= 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon
                    name={liveDiff >= 0 ? 'trending-up' : 'trending-down'}
                    style={{ width: 16, height: 16, color: liveDiff >= 0 ? '#059669' : '#dc2626' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: liveDiff >= 0 ? '#065f46' : '#991b1b' }}>
                    Kalkulasi Pertumbuhan:
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: liveDiff >= 0 ? '#059669' : '#dc2626',
                  }}
                >
                  {liveDiff > 0 ? `+${liveDiff.toLocaleString()}` : liveDiff.toLocaleString()}
                </span>
              </div>

              {/* Jumlah Konten Terbit */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                  Jumlah Post / Konten Terbit di Bulan Ini
                </label>
                <input
                  type="number"
                  min="0"
                  value={metricPostsCount}
                  onChange={(e) => setMetricPostsCount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Catatan / Keterangan */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                  Catatan Evaluasi (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Penambahan followers didorong oleh video reels viral peringatan HUT sekolah..."
                  value={metricNotes}
                  onChange={(e) => setMetricNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    fontSize: '12.5px',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsMetricsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Metrik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS AKUN */}
      {accountToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => !isSubmitting && setAccountToDelete(null)}
        >
          <div
            style={{
              background: 'var(--paper)',
              borderRadius: '24px',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Icon name="trash" style={{ width: 22, height: 22 }} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)' }}>
              Hapus Akun Sosial Media?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px 0' }}>
              Apakah Anda yakin ingin menghapus <b>{accountToDelete.account_name}</b> ({accountToDelete.account_handle})? Riwayat metrik akun ini akan dihapus dari sistem.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAccountToDelete(null)}
                disabled={isSubmitting}
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={isSubmitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
