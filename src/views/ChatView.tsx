import React, { useState, useEffect, useRef } from 'react';
import { ViewType } from '../types';

export interface ChatUser {
  id: number;
  name: string;
  email: string;
  job_title: string;
  status_type: string;
  avatar_url: string | null;
  initials: string;
  conversation_id: number | null;
  last_message: string;
  last_time: string;
}

export interface Message {
  id: number;
  sender_id: number | string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface ChatViewProps {
  onNavigate?: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onAddToast }) => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUser, setActiveUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'private' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('laporanwee_token') ||
        localStorage.getItem('access_token') ||
        ''
      : '';

  // Fetch daftar kontak dari database MySQL
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/users.php', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const filtered = json.data.filter((u: any) => !u.is_me);
        setUsers(filtered);
        if (!activeUser && filtered.length > 0) {
          handleSelectUser(filtered[0], false);
        }
      }
    } catch (err) {
      console.error('Gagal memuat kontak chat:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch pesan untuk user aktif
  const fetchMessages = async (convId?: number | null) => {
    if (!convId) return;
    try {
      const res = await fetch(`https://api-laporanwe.mkverse.my.id/api/chat/messages/list.php?conversation_id=${convId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const json = await res.json();
      if (json.success && json.data?.messages) {
        setMessages(json.data.messages);
      }
    } catch (err) {
      console.error('Gagal mengambil pesan:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeUser?.conversation_id) {
      fetchMessages(activeUser.conversation_id);
      const interval = setInterval(() => {
        fetchMessages(activeUser.conversation_id!);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeUser?.conversation_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectUser = async (user: ChatUser, openOnMobile = true) => {
    setActiveUser(user);
    if (openOnMobile) {
      setShowMobileChat(true);
    }

    if (!user.conversation_id) {
      // Buat percakapan baru jika belum ada
      try {
        const res = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/conversations/create.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ type: 'private', user_id: user.id }),
        });
        const json = await res.json();
        if (json.success && json.data?.id) {
          user.conversation_id = json.data.id;
          fetchMessages(json.data.id);
        }
      } catch (e) {
        console.error('Gagal membuat percakapan:', e);
      }
    } else {
      fetchMessages(user.conversation_id);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeUser) return;

    let targetConvId = activeUser.conversation_id;

    // Jika conversation belum ada, buat terlebih dahulu
    if (!targetConvId) {
      try {
        const createRes = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/conversations/create.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ type: 'private', user_id: activeUser.id }),
        });
        const createJson = await createRes.json();
        if (createJson.success && createJson.data?.id) {
          targetConvId = createJson.data.id;
          activeUser.conversation_id = targetConvId;
        } else {
          if (onAddToast) onAddToast('Gagal memulai percakapan baru.');
          return;
        }
      } catch (err) {
        console.error('Error creating conversation before send:', err);
        return;
      }
    }

    const text = inputText;
    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/chat/messages/send.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: targetConvId,
          message: text,
        }),
      });
      const json = await res.json();
      if (json.success && targetConvId) {
        fetchMessages(targetConvId);
      } else if (onAddToast) {
        onAddToast(json.message || 'Gagal mengirim pesan.');
      }
    } catch (err) {
      console.error('Gagal kirim pesan:', err);
      if (onAddToast) onAddToast('Koneksi terputus saat mengirim pesan.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.job_title && u.job_title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterTab === 'private') return !u.status_type || u.status_type !== 'group';
    if (filterTab === 'group') return u.status_type === 'group';
    return true;
  });

  return (
    <div className="flex-1 h-[calc(100vh-130px)] sm:h-[calc(100vh-120px)] md:h-[calc(100vh-110px)] max-h-[calc(100vh-100px)] min-h-[520px] flex flex-col min-w-0">
      <div className="w-full h-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#181622]/90 backdrop-blur-2xl shadow-xl flex relative">
        
        {/* PANEL KIRI: DAFTAR KONTAK */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-black/5 dark:border-white/5 flex flex-col h-full bg-white/40 dark:bg-[#15131e]/50 ${
            showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header Kontak */}
          <div className="p-4 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] flex items-center justify-center font-bold text-sm shadow-xs">
                  💬
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pesan Tim</h2>
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                title="Segarkan daftar kontak"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <svg
                  className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 mt-3 p-1 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-[#252233] text-gray-900 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('private')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                  filterTab === 'private'
                    ? 'bg-white dark:bg-[#252233] text-gray-900 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Pribadi
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('group')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                  filterTab === 'group'
                    ? 'bg-white dark:bg-[#252233] text-gray-900 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Grup
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari rekan kerja..."
                className="w-full py-2 pl-9 pr-3 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#22202e] text-gray-800 dark:text-white outline-none focus:border-[#d4ee6b] transition-colors"
              />
              <span className="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
            </div>
          </div>

          {/* List Kontak */}
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
            {isLoadingUsers && users.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">Memuat kontak tim...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">Tidak ada kontak ditemukan</div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    activeUser?.id === u.id
                      ? 'bg-black/5 dark:bg-white/10 shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs bg-[#d4ee6b] text-[#1f1d2b] flex-shrink-0 overflow-hidden shadow-xs">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.name}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      u.initials || u.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                      {u.last_time && <span className="text-[10px] text-gray-400 flex-shrink-0">{u.last_time}</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {u.last_message || u.job_title || 'Anggota Tim'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL KANAN: RUANG CHAT AKTIF */}
        <div
          className={`flex-1 flex flex-col h-full min-h-0 bg-white/20 dark:bg-black/10 ${
            showMobileChat ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeUser ? (
            <>
              {/* Header Chat */}
              <div className="px-5 py-3.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  {/* Tombol kembali ke daftar kontak di mobile */}
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1.5 -ml-1 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-black/5"
                    title="Kembali ke kontak"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-[#d4ee6b] text-[#1f1d2b] flex-shrink-0 overflow-hidden">
                    {activeUser.avatar_url ? (
                      <img src={activeUser.avatar_url} alt={activeUser.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      activeUser.initials || activeUser.name.substring(0, 2).toUpperCase()
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white leading-tight">
                      {activeUser.name}
                    </h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Online • {activeUser.job_title || 'Anggota Tim'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {activeUser.conversation_id && (
                    <button
                      type="button"
                      onClick={() => fetchMessages(activeUser.conversation_id!)}
                      title="Segarkan percakapan"
                      className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 21h5v-5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Area Daftar Pesan */}
              <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-xl mb-2">
                      💬
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Belum ada percakapan</p>
                    <p className="text-xs mt-1">Kirim pesan pertama Anda untuk memulai diskusi dengan {activeUser.name}.</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMe = String(m.sender_id) !== String(activeUser.id);
                    return (
                      <div key={m.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-[#d4ee6b] text-[#1f1d2b] font-medium shadow-xs rounded-br-none'
                              : 'bg-white dark:bg-[#282637] text-gray-900 dark:text-white shadow-xs rounded-bl-none'
                          }`}
                        >
                          <p className="break-words leading-relaxed whitespace-pre-wrap">{m.message}</p>
                          <span className="block text-[10px] opacity-60 text-right mt-1">
                            {m.created_at ? m.created_at.substring(11, 16) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Kirim Pesan */}
              <div className="p-3 sm:p-4 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#1a1824]/80">
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Tulis pesan ke ${activeUser.name}...`}
                    disabled={isSending}
                    className="flex-1 py-3 px-4 rounded-2xl text-sm border border-black/10 dark:border-white/10 bg-white dark:bg-[#22202e] text-gray-900 dark:text-white outline-none focus:border-[#d4ee6b] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="w-11 h-11 rounded-2xl bg-[#1f1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1f1d2b] flex items-center justify-center font-bold disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all shadow-xs flex-shrink-0"
                    title="Kirim pesan"
                  >
                    {isSending ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      '➤'
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-2xl mb-3">
                💬
              </div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Pilih rekan tim untuk memulai obrolan</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Pilih salah satu kontak dari daftar sebelah kiri untuk melihat riwayat obrolan atau memulai pesan baru.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ChatView;
