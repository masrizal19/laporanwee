import React, { useEffect, useState } from 'react';
import {
  Disc3,
  Maximize2,
  Pause,
  Play,
  Radio,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useMusikWe } from '../context/MusikWeContext';

export interface FloatingMusikweMiniPlayerProps {
  onOpenMusikwe: () => void;
}

export const FloatingMusikweMiniPlayer: React.FC<FloatingMusikweMiniPlayerProps> = ({
  onOpenMusikwe,
}) => {
  const {
    isSuperAdmin,
    logoUrl,
    currentTrack,
    hasActiveTrack,
    playerActivated,
    isPlaying,
    progress,
    duration,
    miniPlayerDismissed,
    isLiveBroadcastActive,
    isMuted,
    autoplayBlocked,
    togglePlayPause,
    nextTrack,
    toggleMute,
    joinLiveAudio,
    dismissMiniPlayer,
  } = useMusikWe();

  const [imgError, setImgError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [currentTrack.img]);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const shouldRender =
    !miniPlayerDismissed &&
    (isLiveBroadcastActive || isPlaying || (hasActiveTrack && playerActivated));

  if (!shouldRender) {
    return null;
  }

  const pct = Math.min(100, Math.max(0, (progress / (duration || 200)) * 100));
  const isListenerLive = !isSuperAdmin && isLiveBroadcastActive;

  return (
    <aside
      aria-label="Pemutar mini .MUSIKWE"
      className="fixed bottom-24 md:bottom-5 right-4 md:right-5 z-[70] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--glass-solid)]/95 text-[var(--ink)] shadow-[0_18px_42px_-12px_rgba(20,16,45,0.35)] backdrop-blur-xl transition-all duration-300"
    >
      {/* Top playback progress bar */}
      <div className="h-[3px] w-full bg-[var(--ink)]/10">
        <div
          className="h-full bg-[#ff2a55] transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Browser autoplay blocked prompt for live listeners */}
      {isListenerLive && autoplayBlocked && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[#ff2a55]/10 px-3 py-1.5">
          <span className="flex items-center gap-1.5 truncate text-[11px] font-medium text-[#ff2a55]">
            <Radio size={12} className="shrink-0 animate-pulse" />
            <span className="truncate">Siaran live aktif</span>
          </span>
          <button
            type="button"
            onClick={joinLiveAudio}
            className="shrink-0 rounded-full bg-[#ff2a55] px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            Dengarkan Live
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 p-2.5">
        {/* Cover & title click -> reopen /Aplikasi/Musikwe */}
        <button
          type="button"
          onClick={onOpenMusikwe}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity hover:opacity-90"
          title="Buka MusikWe"
        >
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#ff2a55] to-[#6366f1] text-white shadow-sm">
            {currentTrack.img && !imgError ? (
              <img
                src={currentTrack.img}
                alt={currentTrack.t}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt=".MUSIKWE"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-full w-full object-cover bg-black/20 p-1"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Disc3 size={18} className={isPlaying ? 'animate-spin' : ''} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isListenerLive ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#ff2a55]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#ff2a55]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-[#ff2a55] ${
                      isPlaying ? 'animate-pulse' : ''
                    }`}
                  />
                  LIVE
                </span>
              ) : (
                isPlaying && (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff2a55] animate-pulse" />
                )
              )}
              <span className="truncate text-[13px] font-semibold leading-tight text-[var(--ink)]">
                {currentTrack.t}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
              {currentTrack.a}
            </div>
          </div>
        </button>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1">
          {isListenerLive ? (
            <>
              <button
                type="button"
                data-musikwe-no-autounlock="true"
                onClick={toggleMute}
                aria-label={isMuted ? 'Bunyikan suara' : 'Bisukan suara'}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105 active:scale-95 ${
                  isMuted || autoplayBlocked
                    ? 'bg-[#ff2a55] text-white'
                    : 'bg-[var(--ink)]/10 text-[var(--ink)]'
                }`}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              <button
                type="button"
                onClick={onOpenMusikwe}
                aria-label="Buka MusikWe"
                title="Buka MusikWe"
                className="flex h-8 items-center gap-1 rounded-full bg-[var(--ink)]/10 px-2.5 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)]/15"
              >
                <Maximize2 size={12} />
                <span className="hidden sm:inline">Buka MusikWe</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Jeda lagu' : 'Putar lagu'}
                title={isPlaying ? 'Jeda' : 'Putar'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff2a55] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => nextTrack()}
                aria-label="Lagu berikutnya"
                title="Berikutnya"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink)]/80 transition-colors hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]"
              >
                <SkipForward size={15} />
              </button>

              <button
                type="button"
                onClick={onOpenMusikwe}
                aria-label="Buka .MUSIKWE"
                title="Buka MusikWe"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink)]/80 transition-colors hover:bg-[var(--ink)]/10 hover:text-[var(--ink)]"
              >
                <Maximize2 size={14} />
              </button>
            </>
          )}

          <button
            type="button"
            data-musikwe-no-autounlock="true"
            onClick={dismissMiniPlayer}
            aria-label="Tutup pemutar mini"
            title={isSuperAdmin ? 'Hentikan & Tutup' : 'Tutup mini-player'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default FloatingMusikweMiniPlayer;
