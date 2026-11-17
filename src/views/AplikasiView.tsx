import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, ArrowRight, Grid2X2, Loader2 } from 'lucide-react';
import { REGISTERED_APPS, RegisteredApp } from '../data/appsRegistry';

export interface AplikasiViewProps {
  onOpenApp: (app: RegisteredApp) => void;
  onAddToast?: (text: string) => void;
}

export const AplikasiView: React.FC<AplikasiViewProps> = ({
  onOpenApp,
  onAddToast,
}) => {
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const launchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current !== null) {
        window.clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  const availableApps = REGISTERED_APPS.filter((app) => app.status === 'available');

  const handleLaunch = (app: RegisteredApp) => {
    if (launchingId) return;
    setLaunchingId(app.id);
    onAddToast?.(`Membuka ${app.name}...`);

    if (launchTimerRef.current !== null) {
      window.clearTimeout(launchTimerRef.current);
    }
    launchTimerRef.current = window.setTimeout(() => {
      launchTimerRef.current = null;
      onOpenApp(app);
      setLaunchingId(null);
    }, 180);
  };

  return (
    <div className="aplikasi-hub w-full max-w-[1200px] mx-auto min-w-0 pb-10">
      <style>{`
        @keyframes lwAppEnter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .aplikasi-enter {
          animation: lwAppEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .aplikasi-enter {
            animation: none !important;
          }
        }
      `}</style>

      {/* Header Halaman */}
      <header className="aplikasi-enter mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className="text-[clamp(1.75rem,3vw,2.35rem)] font-bold tracking-tight text-[var(--ink)] leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Aplikasi
          </h1>
          <p className="mt-1.5 text-sm sm:text-[15px] text-[var(--muted)] max-w-[60ch] leading-relaxed">
            Akses berbagai aplikasi produktivitas dan kreativitas dalam satu ekosistem LaporanWe.
          </p>
        </div>

        <div className="shrink-0 text-xs sm:text-sm font-medium text-[var(--muted)] tabular-nums whitespace-nowrap">
          <span className="font-semibold text-[var(--ink)]">{availableApps.length}</span> aplikasi tersedia
        </div>
      </header>

      {/* Daftar Aplikasi / Empty State */}
      {availableApps.length === 0 ? (
        <section
          className="aplikasi-enter rounded-[28px] border border-[var(--line)] bg-[var(--glass)] backdrop-blur-2xl p-10 sm:p-14 text-center shadow-[var(--shadow-card)]"
          aria-label="Belum ada aplikasi"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lav)]/60 dark:bg-white/10 text-[var(--ink)]">
            <Grid2X2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">
            Belum ada aplikasi tersedia
          </h2>
          <p className="mx-auto mt-2 max-w-[44ch] text-sm text-[var(--muted)] leading-relaxed">
            Aplikasi produktivitas dan kreativitas yang terhubung dengan akun LaporanWe Anda akan tampil di sini.
          </p>
        </section>
      ) : (
        <section
          className="aplikasi-enter grid !grid-cols-1 sm:!grid-cols-2 lg:!grid-cols-3 !gap-6 w-full"
          aria-label="Daftar aplikasi tersedia"
        >
          {availableApps.map((app) => {
            const isLaunching = launchingId === app.id;

            return (
              <article
                key={app.id}
                role="button"
                tabIndex={0}
                onClick={() => handleLaunch(app)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLaunch(app);
                  }
                }}
                className="group relative flex flex-col justify-between rounded-[28px] border border-[var(--line)] bg-[var(--glass)] dark:bg-white/[0.05] backdrop-blur-2xl p-5 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:bg-[var(--glass-solid)] dark:hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lav-deep)] cursor-pointer text-left"
              >
                <div>
                  {/* Thumbnail Pastel Glassmorphism + Identitas Visual FOTOWE */}
                  <div className="relative mb-5 flex h-44 w-full items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-[#f6e6cf] via-[#f1d8e4] to-[#d9d3f5] dark:from-[#322846] dark:via-[#2c2238] dark:to-[#22243a] border border-white/60 dark:border-white/10">
                    {/* Viewfinder Corner Framing */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-4 rounded-xl border border-dashed border-[#1f1d2b]/15 dark:border-white/15"
                    />

                    {/* Central Photography Icon Tile */}
                    <div className="relative z-10 flex flex-col items-center gap-2.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-active:scale-95">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 dark:bg-[#1e1c2b]/90 text-[#1f1d2b] dark:text-white shadow-sm border border-black/5 dark:border-white/10">
                        <Camera className="h-7 w-7 stroke-[1.8]" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-extrabold tracking-tight text-[#1a1446] dark:text-white/90">
                        fotowe<span className="text-[#ff3d6e]">.</span>
                      </span>
                    </div>
                  </div>

                  {/* Metadata Kategori & Status (Clean unboxed typography) */}
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                    <span className="truncate">{app.category}</span>
                    <span className="inline-flex items-center gap-1 text-[#16A34A] dark:text-emerald-400 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{app.statusLabel}</span>
                    </span>
                  </div>

                  {/* Judul & Deskripsi */}
                  <h2 className="mt-2.5 text-xl font-bold tracking-tight text-[var(--ink)]">
                    {app.name}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed line-clamp-3">
                    {app.description}
                  </p>
                </div>

                {/* Action Footer */}
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={isLaunching}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunch(app);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--dark)] text-[var(--on-dark)] px-5 py-2.5 min-h-[42px] text-sm font-semibold shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-70 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isLaunching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Membuka Aplikasi...</span>
                      </>
                    ) : (
                      <>
                        <span>Buka Aplikasi</span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default AplikasiView;
