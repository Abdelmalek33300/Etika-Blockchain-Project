// src/dev-probe.ts
// Sonde de dev : logge le résultat de /api/auctions via le proxy Vite.
// AUCUN impact visuel.

if ((import.meta as any)?.env?.DEV) {
  const FLAG = '__ETIKA_DEV_PROBE__';
  // @ts-ignore
  if (!(window as any)[FLAG]) {
    // @ts-ignore
    (window as any)[FLAG] = true;
    fetch('/api/auctions', { credentials: 'include' })
      .then(r => r.json())
      .then(data => console.log('[Étika][probe] /api/auctions ->', data))
      .catch(err => console.error('[Étika][probe] error ->', err));
  }
}
