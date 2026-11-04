import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AuthUser } from '../types';
import { getAbsoluteAvatarUrl } from '../utils/api';

export interface ChatUser {
  id: string | number;
  name: string;
  initials: string;
  job_title: string;
  status_type: string;
  avatar_url?: string | null;
  last_message?: string;
  last_time?: string;
  is_online?: boolean;
  is_me?: boolean;
  conversation_id?: string | number | null;
}

export interface ChatMessage {
  id: string | number;
  sender_id?: string | number;
  is_me: boolean;
  message: string;
  time: string;
  type?: 'text' | 'image' | 'video' | 'file';
  file_url?: string | null;
  file_name?: string | null;
  file_size?: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface ChatViewProps {
  currentUser?: AuthUser | null;
  onAddToast?: (text: string) => void;
}

// Fallback registered team members in database
const DEFAULT_REGISTERED_USERS: ChatUser[] = [
  {
    id: 1,
    name: 'Rizal Fadhilah',
    initials: 'RF',
    job_title: 'Lead Designer & PM',
    status_type: 'Karyawan',
    avatar_url: null,
    last_message: 'Halo, laporan proyek mingguan sudah siap dicek?',
    last_time: '10:45',
    is_online: true,
    is_me: false,
    conversation_id: 'conv_1',
  },
  {
    id: 2,
    name: 'Farel Haqqi',
    initials: 'FH',
    job_title: 'Frontend Developer',
    status_type: 'Karyawan',
    avatar_url: null,
    last_message: 'Daftar pengguna obrolan sudah terhubung ke API 👍',
    last_time: '09:30',
    is_online: true,
    is_me: false,
    conversation_id: 'conv_2',
  },
  {
    id: 3,
    name: 'Rayhan Alvaro',
    initials: 'RA',
    job_title: 'Fullstack Engineer',
    status_type: 'Karyawan',
    avatar_url: null,
    last_message: 'Endpoint REST chat/users.php sudah aktif di database',
    last_time: 'Kemarin',
    is_online: false,
    is_me: false,
    conversation_id: null,
  },
  {
    id: 4,
    name: 'Rafa',
    initials: 'RF',
    job_title: 'UI/UX Designer',
    status_type: 'Anak Magang',
    avatar_url: null,
    last_message: 'Desain glassmorphism chat sudah saya perbarui ✨',
    last_time: 'Kemarin',
    is_online: true,
    is_me: false,
    conversation_id: null,
  },
  {
    id: 5,
    name: 'Zaiyana Shofiya',
    initials: 'ZS',
    job_title: 'Social Media & Content',
    status_type: 'Anak Magang',
    avatar_url: null,
    last_message: 'Konten Instagram dan TikTok hari ini siap diunggah 🚀',
    last_time: 'Senin',
    is_online: false,
    is_me: false,
    conversation_id: null,
  },
  {
    id: 6,
    name: 'Rizqy Aditya',
    initials: 'RA',
    job_title: 'Mobile Developer',
    status_type: 'Anak PKL',
    avatar_url: null,
    last_message: 'Testing responsivitas mobile dan fluid layout sudah lancar',
    last_time: 'Senin',
    is_online: false,
    is_me: false,
    conversation_id: null,
  },
  {
    id: 7,
    name: 'Zulham Anwar',
    initials: 'ZA',
    job_title: 'QA Engineer',
    status_type: 'Anak Magang',
    avatar_url: null,
    last_message: 'Validasi form dan endpoint chat lolos testing ✅',
    last_time: '3 hari lalu',
    is_online: true,
    is_me: false,
    conversation_id: null,
  },
];

const AVATAR_COLORS = ['#d4ee6a', '#b9a9f0', '#ffc9a8', '#a8dcff', '#ffd1e8', '#c7f0d8', '#fde047', '#fed7aa'];

const getAvatarBgColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 97;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const POPULAR_EMOJIS = ['😀', '😂', '🥹', '😍', '😎', '🤔', '🙏', '👍', '👏', '🔥', '🎉', '✅', '❤️', '💪', '🙌', '📌', '🚀', '☕', '🍜', '✨', '📸', '📄'];

export const ChatView: React.FC<ChatViewProps> = ({ currentUser, onAddToast }) => {
  // 1. Deteksi State Tema Aktif (Dinamis Light & Dark Mode)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.documentElement.dataset.theme === 'dark' ||
        localStorage.getItem('theme') === 'dark' ||
        localStorage.getItem('laporanwee_theme') === 'dark'
      );
    }
    return false;
  });

  useEffect(() => {
    const checkTheme = () => {
      const dark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.dataset.theme === 'dark' ||
        localStorage.getItem('theme') === 'dark' ||
        localStorage.getItem('laporanwee_theme') === 'dark';
      setIsDark(dark);
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    window.addEventListener('storage', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  const [users, setUsers] = useState<ChatUser[]>(DEFAULT_REGISTERED_USERS);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [activeUserId, setActiveUserId] = useState<string | number>(1);
  const [activeConversationId, setActiveConversationId] = useState<string | number | null>('conv_1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'karyawan' | 'magang'>('all');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // 3. Auto-scroll ke pesan terbaru
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeUser = users.find((u) => String(u.id) === String(activeUserId)) || users[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch Daftar Pengguna dari API (users.php)
  const fetchUsersFromApi = useCallback(async () => {
    setIsLoadingUsers(true);
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('laporanwee_token') ||
      '';

    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/users.php', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json && (json.success || Array.isArray(json.data))) {
        const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

        const mapped: ChatUser[] = rawList.map((u: any, idx: number) => {
          const rawName = u.name || u.full_name || u.username || `Anggota ${idx + 1}`;
          const parts = rawName.trim().split(/\s+/);
          const computedInitials =
            u.initials ||
            (parts.length >= 2
              ? (parts[0][0] + parts[1][0]).toUpperCase()
              : rawName.slice(0, 2).toUpperCase());

          const isMe = Boolean(
            u.is_me ||
              (currentUser?.id && String(u.id) === String(currentUser.id)) ||
              (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase())
          );

          return {
            id: u.id || u.user_id || idx + 1,
            name: rawName,
            initials: computedInitials,
            job_title: u.job_title || u.role || u.position || 'Anggota Tim',
            status_type: u.status_type || u.status || 'Karyawan',
            avatar_url: u.avatar_url || u.avatar || null,
            last_message: u.last_message || u.latest_message || '',
            last_time: u.last_time || u.time || '',
            is_online: Boolean(u.is_online || u.online || u.presence === 'online'),
            is_me: isMe,
            conversation_id: u.conversation_id || null,
          };
        });

        // Filter: jangan tampilkan diri sendiri di daftar kontak obrolan pribadi
        const filtered = mapped.filter((u: ChatUser) => !u.is_me);

        if (filtered.length > 0) {
          setUsers(filtered);
          if (!activeUserId || !filtered.some((u) => String(u.id) === String(activeUserId))) {
            setActiveUserId(filtered[0].id);
            setActiveConversationId(filtered[0].conversation_id || null);
          }
        }
      }
    } catch (err) {
      console.warn('Gagal memuat daftar pengguna dari API chat/users.php, menggunakan data tim terdaftar:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentUser?.email, currentUser?.id, activeUserId]);

  useEffect(() => {
    fetchUsersFromApi();
  }, [fetchUsersFromApi]);

  // Load message list for active conversation
  const loadMessages = useCallback(
    async (convId: string | number) => {
      setIsLoadingMessages(true);
      const token =
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('laporanwee_token') ||
        '';

      try {
        const res = await fetch(
          `https://api-laporanwe.mkverse.my.id/api/chat/messages/list.php?conversation_id=${encodeURIComponent(
            String(convId)
          )}`,
          {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (res.ok) {
          const json = await res.json();
          const rawMessages = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.messages)
            ? json.messages
            : [];

          if (rawMessages.length > 0) {
            const mappedMessages: ChatMessage[] = rawMessages.map((m: any, idx: number) => ({
              id: m.id || `msg_${idx}`,
              sender_id: m.sender_id || m.user_id,
              is_me: Boolean(
                m.is_me || (currentUser?.id && String(m.sender_id) === String(currentUser.id))
              ),
              message: m.message || m.content || m.text || '',
              time: m.time || m.created_at || 'Baru saja',
              type: m.type || (m.file_url ? 'image' : 'text'),
              file_url: m.file_url || null,
              file_name: m.file_name || null,
              file_size: m.file_size || null,
              status: 'read',
            }));
            setMessages(mappedMessages);
            setIsLoadingMessages(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Gagal mengambil pesan obrolan dari server:', err);
      }

      // Default initial welcome messages for this conversation
      const partner = users.find((u) => String(u.id) === String(activeUserId));
      setMessages([
        {
          id: `init_1_${convId}`,
          is_me: false,
          message: partner?.last_message || `Halo! Ada yang bisa saya bantu untuk pekerjaan hari ini? 😊`,
          time: partner?.last_time || '09:15',
          type: 'text',
          status: 'read',
        },
      ]);
      setIsLoadingMessages(false);
    },
    [currentUser?.id, activeUserId, users]
  );

  // Initial load of messages for initial active conversation
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // Logika Klik / Memilih Pengguna (Start / Open Chat)
  const handleSelectUser = async (user: ChatUser) => {
    setActiveUserId(user.id);
    setShowMobileChat(true);

    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('laporanwee_token') ||
      '';

    let convId = user.conversation_id;

    if (!convId) {
      setIsLoadingMessages(true);
      try {
        const res = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/conversations/create.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: 'private',
            user_id: user.id,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && (json.conversation_id || json.data?.conversation_id || json.data?.id)) {
            convId = json.conversation_id || json.data?.conversation_id || json.data?.id;
          }
        }
      } catch (err) {
        console.warn('POST conversations/create.php notice:', err);
      }

      if (!convId) {
        convId = `conv_${user.id}`;
      }

      setUsers((prev) =>
        prev.map((u) => (String(u.id) === String(user.id) ? { ...u, conversation_id: convId } : u))
      );
    }

    setActiveConversationId(convId);
    await loadMessages(convId);
  };

  // Send new message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeUser) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      is_me: true,
      message: text,
      time: timeStr,
      type: 'text',
      status: 'sent',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setShowEmojiPicker(false);
    setShowAttachMenu(false);

    setUsers((prev) =>
      prev.map((u) =>
        String(u.id) === String(activeUser.id)
          ? { ...u, last_message: text, last_time: timeStr }
          : u
      )
    );

    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('laporanwee_token') ||
      '';

    try {
      await fetch('https://api-laporanwe.mkverse.my.id/api/chat/messages/send.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          recipient_id: activeUser.id,
          user_id: activeUser.id,
          message: text,
          type: 'text',
        }),
      });
    } catch (err) {
      console.warn('POST messages/send.php notice:', err);
    }
  };

  // Handle file / image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeUser) return;

    const file = files[0];
    const isImg = file.type.startsWith('image/');
    const fileUrl = URL.createObjectURL(file);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg: ChatMessage = {
      id: `file_${Date.now()}`,
      is_me: true,
      message: isImg ? 'Mengirim foto' : file.name,
      time: timeStr,
      type: isImg ? 'image' : 'file',
      file_url: fileUrl,
      file_name: file.name,
      file_size: `${(file.size / 1024).toFixed(0)} KB`,
      status: 'sent',
    };

    setMessages((prev) => [...prev, newMsg]);
    setShowAttachMenu(false);

    if (onAddToast) {
      onAddToast(`Berkas "${file.name}" berhasil dilampirkan.`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter users by search query and category
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.job_title.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'online') return Boolean(u.is_online);
    if (activeFilter === 'karyawan') return u.status_type.toLowerCase().includes('karyawan');
    if (activeFilter === 'magang') return u.status_type.toLowerCase().includes('magang') || u.status_type.toLowerCase().includes('pkl');

    return true;
  });

  return (
    // PEMBUNGKUS UTAMA CHAT (Dinamis Light & Dark, Mengisi Seluruh Tinggi Viewport)
    <div className="flex-1 h-[calc(100vh-24px)] max-h-[calc(100vh-24px)] flex flex-col min-h-0 min-w-0 transition-colors duration-300">
      <div
        className={`w-full h-full rounded-3xl overflow-hidden flex border transition-all duration-300 min-h-0 ${
          isDark
            ? 'bg-[#1b1924]/95 border-white/10 shadow-2xl text-gray-100'
            : 'bg-white/90 border-black/5 shadow-xl text-gray-800'
        }`}
      >
        {/* 2. KOLOM KIRI (DAFTAR PERCAKAPAN & PENCARIAN DENGAN MIN-H-0 & FLEX-1) */}
        <aside
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full min-h-0 border-r transition-colors duration-300 ${
            isDark ? 'bg-[#211e2b] border-white/5' : 'bg-[#faf9fd] border-black/5'
          } ${showMobileChat ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Header Sidebar - flex-shrink-0 */}
          <div
            className={`flex-shrink-0 p-4 border-b flex items-center justify-between transition-colors duration-300 ${
              isDark ? 'border-white/5' : 'border-black/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#23212e] dark:bg-[#d4ee6a] text-white dark:text-[#23212e] flex items-center justify-center font-bold shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Pesan Tim
                </h2>
                <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {users.filter((u) => u.is_online).length} anggota online
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchUsersFromApi}
              disabled={isLoadingUsers}
              title="Muat ulang daftar kontak"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-gray-200'
                  : 'bg-black/5 hover:bg-black/10 text-gray-700'
              }`}
            >
              <svg className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* Input Cari Chat - flex-shrink-0 */}
          <div className="flex-shrink-0 px-3.5 pt-3 pb-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari rekan tim..."
                className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm outline-none transition-all ${
                  isDark
                    ? 'bg-[#2a2738] text-white placeholder-gray-400 border border-white/5 focus:border-[#d4ee6b]'
                    : 'bg-white text-gray-800 placeholder-gray-400 border border-black/10 focus:border-[#7a69d0] shadow-2xs'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tab Filter - flex-shrink-0 */}
          <div className="flex-shrink-0 px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'online', label: 'Online' },
              { id: 'karyawan', label: 'Karyawan' },
              { id: 'magang', label: 'Magang / PKL' },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={
                    isActive
                      ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#d4ee6b] text-[#1f1d2b] shadow-xs'
                      : `px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isDark
                            ? 'bg-white/5 text-gray-400 hover:text-white'
                            : 'bg-black/5 text-gray-600 hover:text-black'
                        }`
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Daftar Kontak Pengguna - KUNCI: flex-1 overflow-y-auto min-h-0 */}
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1 py-1">
            {isLoadingUsers && users.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                <div className="w-6 h-6 border-2 border-[#7a63d8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Memuat data obrolan...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={`p-6 text-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Tidak ada rekan tim ditemukan
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = String(user.id) === String(activeUserId);
                const avatarSrc = user.avatar_url ? getAbsoluteAvatarUrl(user.avatar_url) : null;

                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectUser(user);
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all duration-150 select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-[#2a273b] border-l-4 border-[#d4ee6b]'
                          : 'bg-white border-l-4 border-[#7a69d0] shadow-xs'
                        : isDark
                        ? 'hover:bg-white/5 text-gray-300'
                        : 'hover:bg-black/5 text-gray-700'
                    }`}
                  >
                    {/* Avatar dengan Online Dot */}
                    <div className="relative flex-shrink-0">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={user.name}
                          className="w-11 h-11 rounded-full object-cover border border-black/10 dark:border-white/10 shadow-xs"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-[#1e1d2b] shadow-xs"
                          style={{ backgroundColor: getAvatarBgColor(user.name) }}
                        >
                          {user.initials}
                        </div>
                      )}
                      {user.is_online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#2ecc71] border-2 border-white dark:border-[#211e2b]" />
                      )}
                    </div>

                    {/* Info Kontak: Nama, Subteks, Waktu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {user.name}
                        </h3>
                        {user.last_time && (
                          <span
                            className={`text-[10px] whitespace-nowrap flex-shrink-0 ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {user.last_time}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {user.last_message || `${user.job_title} • ${user.status_type}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tombol Mulai Chat Baru di Bawah - flex-shrink-0 p-3 mt-auto */}
          <div
            className={`flex-shrink-0 p-3 mt-auto border-t transition-colors duration-300 ${
              isDark ? 'border-white/5 bg-[#211e2b]/95' : 'border-black/5 bg-[#faf9fd]/95'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                if (filteredUsers.length > 0) {
                  handleSelectUser(filteredUsers[0]);
                }
              }}
              className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isDark
                  ? 'bg-[#d4ee6b] text-[#1f1d2b] hover:opacity-90 shadow-sm'
                  : 'bg-[#1e1d2b] text-white hover:bg-black/80 shadow-sm'
              }`}
            >
              <span>✎</span>
              <span>Mulai chat / percakapan baru</span>
            </button>
          </div>
        </aside>

        {/* 1. STRUKTUR FLEXBOX PANEL KANAN (ACTIVE CHAT ROOM) */}
        <section
          className={`flex-1 flex flex-col h-full min-h-0 min-w-0 relative transition-colors duration-300 ${
            isDark ? 'bg-[#181622]' : 'bg-[#f4f3f9]'
          } ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}
        >
          {activeUser ? (
            <div className="flex-1 flex flex-col h-full min-h-0 relative">
              {/* 1. Header Lawan Bicara (Terkunci di Atas) - flex-shrink-0 */}
              <div
                className={`flex-shrink-0 px-6 py-4 border-b flex items-center justify-between transition-colors duration-300 ${
                  isDark ? 'bg-[#211e2b]/80 border-white/5' : 'bg-white/80 border-black/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Tombol Kembali Mobile */}
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center ${
                      isDark ? 'bg-white/10 text-gray-200' : 'bg-black/5 text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>

                  {/* Avatar Rekan Bicara */}
                  <div className="relative flex-shrink-0">
                    {activeUser.avatar_url ? (
                      <img
                        src={getAbsoluteAvatarUrl(activeUser.avatar_url)}
                        alt={activeUser.name}
                        className="w-10 h-10 rounded-full object-cover border border-black/10 dark:border-white/10 shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-[#1e1d2b] shadow-xs"
                        style={{ backgroundColor: getAvatarBgColor(activeUser.name) }}
                      >
                        {activeUser.initials}
                      </div>
                    )}
                    {activeUser.is_online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#2ecc71] border-2 border-white dark:border-[#211e2b]" />
                    )}
                  </div>

                  {/* Nama, Jabatan & Status Kehadiran */}
                  <div className="min-w-0">
                    <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {activeUser.name}
                    </h3>
                    <div
                      className={`flex items-center gap-1.5 text-[11px] truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {activeUser.job_title}
                      </span>
                      <span>•</span>
                      <span>{activeUser.status_type}</span>
                      <span>•</span>
                      <span className={activeUser.is_online ? 'text-[#2ea66b] font-medium' : 'opacity-70'}>
                        {activeUser.is_online ? '🟢 Online' : '⚪ Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aksi Cepat Header */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => activeConversationId && loadMessages(activeConversationId)}
                    title="Segarkan pesan obrolan"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isDark
                        ? 'bg-white/10 hover:bg-white/15 text-gray-200'
                        : 'bg-black/5 hover:bg-black/10 text-gray-700'
                    }`}
                  >
                    <svg className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 2. Message Stream Feed (MENGISI PENUH SISA RUANG & MENDORONG INPUT KE BAWAH) */}
              {/* KUNCI UTAMA: Wajib menggunakan 'flex-1 overflow-y-auto min-h-0' */}
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {/* Chip Tanggal */}
                <div className="flex justify-center my-2">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-medium backdrop-blur-xs ${
                      isDark ? 'bg-white/10 text-gray-300' : 'bg-black/5 text-gray-600'
                    }`}
                  >
                    Hari ini
                  </span>
                </div>

                {isLoadingMessages ? (
                  <div className="flex justify-center py-10">
                    <div className="w-7 h-7 border-2 border-[#7a63d8] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className={`text-center py-12 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-2xl">
                      💬
                    </div>
                    <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      Mulai percakapan dengan {activeUser.name}
                    </p>
                    <p className="text-xs opacity-75">
                      Kirim pesan atau bagikan berkas dokumen kerja secara langsung.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.is_me ? 'items-end' : 'items-start'}`}
                    >
                      {/* Bubble Pesan */}
                      <div
                        className={
                          msg.is_me
                            ? 'max-w-[70%] p-4 rounded-3xl rounded-tr-sm text-sm bg-[#d4ee6b] text-[#181722] font-medium shadow-2xs'
                            : `max-w-[70%] p-4 rounded-3xl rounded-tl-sm text-sm transition-all shadow-2xs ${
                                isDark
                                  ? 'bg-[#282537] text-gray-100 border border-white/5'
                                  : 'bg-white text-gray-800 border border-black/5'
                              }`
                        }
                      >
                        {/* Lampiran Foto */}
                        {msg.type === 'image' && msg.file_url && (
                          <div className="mb-2 rounded-2xl overflow-hidden max-h-60 border border-black/10 dark:border-white/10">
                            <img
                              src={msg.file_url}
                              alt="Lampiran"
                              className="w-full h-full object-cover block cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(msg.file_url || '', '_blank')}
                            />
                          </div>
                        )}

                        {/* Lampiran Dokumen */}
                        {msg.type === 'file' && (
                          <div className="mb-2 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex items-center gap-2.5 border border-black/10 dark:border-white/10">
                            <div className="w-8 h-8 rounded-lg bg-[#7a63d8]/20 text-[#7a63d8] flex items-center justify-center font-bold text-xs flex-shrink-0">
                              📄
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs truncate">{msg.file_name || 'Dokumen'}</p>
                              <p className="text-[10px] opacity-75">{msg.file_size || 'Berkas'}</p>
                            </div>
                          </div>
                        )}

                        {/* Teks Pesan */}
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                        {/* Timestamp & Status Centang */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                            msg.is_me ? 'text-[#181722]/70 font-semibold' : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          <span>{msg.time}</span>
                          {msg.is_me && <span>✓✓</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 3. Bottom Message Input Bar (TERKUNCI DI PALING BAWAH - flex-shrink-0 mt-auto) */}
              <div
                className={`flex-shrink-0 mt-auto p-4 border-t transition-colors duration-300 relative ${
                  isDark ? 'bg-[#211e2b]/90 border-white/5' : 'bg-white/90 border-black/5'
                }`}
              >
                {/* Popup Emoji */}
                {showEmojiPicker && (
                  <div
                    className={`absolute bottom-full mb-3 left-4 p-3 rounded-2xl shadow-xl border z-30 grid grid-cols-6 gap-2 ${
                      isDark ? 'bg-[#252336] border-white/10 text-white' : 'bg-white border-black/10 text-gray-800'
                    }`}
                  >
                    {POPULAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setInputText((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-lg transition-transform hover:scale-110"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Popup Attachment */}
                {showAttachMenu && (
                  <div
                    className={`absolute bottom-full mb-3 left-4 p-2 rounded-2xl shadow-xl border z-30 min-w-[170px] space-y-1 ${
                      isDark ? 'bg-[#252336] border-white/10 text-white' : 'bg-white border-black/10 text-gray-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*';
                          fileInputRef.current.click();
                        }
                        setShowAttachMenu(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <span>🖼️</span> Kirim Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.zip,*/*';
                          fileInputRef.current.click();
                        }
                        setShowAttachMenu(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <span>📄</span> Dokumen Kerja
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <form onSubmit={handleSendMessage} className="flex items-center gap-3 w-full">
                  {/* Tombol Lampiran [+] */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu((prev) => !prev);
                      setShowEmojiPicker(false);
                    }}
                    title="Lampirkan berkas"
                    className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 transition-all text-gray-600 dark:text-gray-300"
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>

                  {/* Input Box Pesan */}
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Tulis pesan ke ${activeUser?.name || 'rekan tim'}...`}
                      className={`w-full h-11 pl-4 pr-11 rounded-2xl border text-sm outline-none transition-all ${
                        isDark
                          ? 'bg-[#282637] text-white placeholder-gray-400 border-white/10 focus:border-[#d4ee6b]'
                          : 'bg-white text-gray-800 placeholder-gray-400 border-gray-200 focus:border-[#7a69d0]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker((prev) => !prev);
                        setShowAttachMenu(false);
                      }}
                      title="Pilih emoji"
                      className="absolute right-3 text-lg opacity-70 hover:opacity-100 transition-opacity"
                    >
                      😊
                    </button>
                  </div>

                  {/* Tombol Kirim Pesan [>] */}
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    title="Kirim pesan"
                    className="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center bg-[#d4ee6b] text-[#1f1d2b] hover:opacity-90 active:scale-95 transition-all shadow-md font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 -rotate-45 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div
              className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <div className="w-16 h-16 rounded-3xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-3xl mb-3">
                💬
              </div>
              <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                Pilih Rekan Tim
              </h3>
              <p className="text-xs opacity-75 max-w-xs">
                Pilih salah satu kontak di sebelah kiri untuk membuka ruang obrolan kerja.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ChatView;
