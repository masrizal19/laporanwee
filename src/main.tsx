import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import './motion/laporanwe-motion.css';
import './motion/laporanwe-motion.js';

console.log('[APP ORIGIN]', typeof window !== 'undefined' ? window.location.origin : '');
console.log('[API BASE URL]', (import.meta.env.VITE_API_URL as string) || 'https://api-laporanwe.mkverse.my.id/api');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
