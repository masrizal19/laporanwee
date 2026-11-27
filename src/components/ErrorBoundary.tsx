import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

const AUTH_PRESERVE_KEYS = new Set([
  'auth_token',
  'token',
  'laporanwee_token',
  'access_token',
  'laporanwee_user',
  'userEmail',
  'email',
  'laporanwee_registered_email',
]);

const NON_AUTH_CACHE_KEYS = [
  'musikwe_persist_v1',
  'laporanwee_ui_settings',
  'app_ui_settings',
  'lw_store_reports',
  'lw_store_counters',
  'lw_store_activities',
  'lw_store_files',
  'lw_reports_data_cache',
  'lw_reports_counters_cache',
  'laporanwee_daily_reports_cache',
  'laporanwee_activities_cache',
  'laporanwee_report_overrides',
  'laporanwee_selected_report_id',
  'cache_activities_120',
  'cache_project_documents',
  'cache_daily_reports',
];

function clearNonAuthCaches(): void {
  try {
    for (const key of NON_AUTH_CACHE_KEYS) {
      if (!AUTH_PRESERVE_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || AUTH_PRESERVE_KEYS.has(k)) continue;
      if (
        k.startsWith('cache_') ||
        k.startsWith('lw_store_') ||
        k.startsWith('lw_reports_') ||
        k.startsWith('musikwe_')
      ) {
        toDelete.push(k);
      }
    }
    for (const k of toDelete) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore storage access errors
  }
}

function extractFailingComponent(componentStack?: string | null): string {
  if (!componentStack || typeof componentStack !== 'string') return '';
  const match = componentStack.match(/^\s*at\s+([A-Za-z0-9_$.]+)/m);
  return match && match[1] ? match[1] : '';
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleResetAndGoHome = () => {
    clearNonAuthCaches();
    try {
      window.location.href = '/';
    } catch {
      window.location.replace('/');
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown render error';
      const componentStack = this.state.errorInfo?.componentStack || '';
      const componentName = extractFailingComponent(componentStack);
      const stackPreview = componentStack
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4)
        .join(' | ');

      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '560px', width: '100%', margin: '0 auto', background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '12px', fontSize: '20px', fontWeight: 700 }}>Terjadi Kesalahan Render Halaman</h2>
            <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
              Maaf, terjadi kendala saat memuat komponen ini. Tekan tombol di bawah untuk membersihkan cache sementara dan kembali ke dashboard utama.
            </p>
            <div style={{ textAlign: 'left', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '22px', fontSize: '12px', color: '#991b1b', wordBreak: 'break-word' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                Detail Teknis{componentName ? ` (${componentName})` : ''}:
              </div>
              <div style={{ fontFamily: 'monospace', lineHeight: '1.45' }}>{errorMessage}</div>
              {stackPreview && (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7f1d1d', marginTop: '6px', opacity: 0.85 }}>
                  {stackPreview}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleResetAndGoHome}
              style={{ background: '#4A55FF', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
