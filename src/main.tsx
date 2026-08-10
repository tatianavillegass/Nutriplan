import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

/**
 * Instalable como app.
 *
 * El service worker es lo que permite a Android y al escritorio ofrecer
 * "Instalar", y de paso deja que NutriPlan abra sin conexión. En desarrollo no
 * se registra: sólo estorbaría, cacheando versiones a medio hacer.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin service worker la app funciona igual, sólo no se puede instalar.
    });
  });
}
