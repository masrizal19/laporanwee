import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '500px', width: '100%', margin: '0 auto', background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '12px', fontSize: '20px', fontWeight: 700 }}>Terjadi Kesalahan Render Halaman</h2>
            <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              Maaf, terjadi kendala saat memuat komponen ini. Silakan muat ulang halaman atau kembali ke dashboard utama.
            </p>
            <button
              onClick={() => {
                window.location.hash = '#/dashboard';
                window.location.pathname = '/dashboard';
                window.location.reload();
              }}
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
