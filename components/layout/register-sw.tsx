'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker que dá ao Ryse o comportamento de app instalado
 * (Android e iOS). Só roda em produção — em dev o SW atrapalha o HMR.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* sem SW o app continua funcionando normalmente */
      });
    };

    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
