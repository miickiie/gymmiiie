import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import AccountGate from './components/AccountGate';
import { ToastProvider } from './components/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AccountGate>
          <App />
        </AccountGate>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Let the layout own install prompts.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __installPrompt?: Event }).__installPrompt = e;
  window.dispatchEvent(new Event('gymmiie:installready'));
});
window.addEventListener('appinstalled', () => {
  delete (window as unknown as { __installPrompt?: Event }).__installPrompt;
  window.dispatchEvent(new Event('gymmiie:installed'));
});
