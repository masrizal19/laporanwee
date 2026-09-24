import React from 'react';
import { ToastMessage } from '../types';
import { Icon } from './icons';

interface ToastProps {
  toasts: ToastMessage[];
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts }) => {
  return (
    <div id="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast show">
          <div className="tic">
            <Icon name="check" />
          </div>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};
