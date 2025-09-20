// public/sponsors/app.js
(() => {
  'use strict';

  const BASE = 'https://localhost:4433/api';
  const $ = s => document.querySelector(s);

  const msg = $('#msg');
  const out = $('#out');
  const sel = $('#auctionSelect');
  const btnSend = document.getElementById('btnSend');
  const btnShowBids = document.getElementById('btnShowBids');

  function esc(s){return (s??'').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#39;');}

  async function loadAuctions() {
    if (sel) sel.innerHTML = '<option value="">Chargement…</option>';
    if (msg) msg.textContent = 'JS chargé, chargement des enchères…';
    try {
      const r = await fetch(`${BASE}/auctions`, { method:'GET', cache:'no-store' });
      const txt = await r.text();
      console.log('GET /auctions →', r.status, txt);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = txt ? JSON.parse(txt) : {};
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        if (sel) sel.innerHTML = '<option value="">Aucune enchère</option>';
        if (msg) msg.textContent = 'Aucune enchère pour le moment.';
        return;
      }
      if (sel) sel.innerHTML = items
        .map(a => `<option value="${esc(a.id)}">${esc(a.title)} — ${esc(a.sector||'')}</option>`)
        .join('');
      if (msg) msg.textContent = 'Enchères chargées ✅';
    } catch (e) {
      console.error('loadAuctions error:', e);
      if (sel) sel.innerHTML = '<option value="">Erreur de chargement</option>';
      if (msg) msg.innerHTML = '<span class="err">Erreur: '+esc(e.message)+'</span>';
    }
  }

  async function sendBid() {
    const auctionId = sel?.value || '';
    const bidder = $('#bidder')?.value.trim() || '';
    const amount = Number($('#amount')?.value || '0');
    if (!auctionId) { if (msg) msg.textContent = 'Choisissez une enchère.'; return; }
    if (msg) msg.textContent = 'Envoi en cours…';
    try {
      const r = await fetch(`${BASE}/bids`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ auctionId, bidder, amount })
      });
      const txt = await r.text();
      console.log('POST /bids →', r.status, txt);
      const data = txt ? JSON.parse(txt) : {};
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      if (msg) msg.innerHTML = '<span class="ok">Bid enregistré ✅</span>';
      if (out) out.textContent = JSON.stringify(data, null, 2);
    } catch(e) {
      console.error('sendBid error:', e);
      if (msg) msg.innerHTML = '<span class="err">Erreur: '+esc(e.message)+'</span>';
    }
  }

  async function showBids() {
    const id = sel?.value || '';
    if (!id) { if (msg) msg.textContent='Choisissez une enchère.'; return; }
    try {
      const r = await fetch(`${BASE}/bids/${id}`, { cache:'no-store' });
      const txt = await r.text();
      console.log('GET /bids/:id →', r.status, txt);
      if (out) out.textContent = txt || '';
    } catch {
      if (out) out.textContent = 'Erreur de chargement.';
    }
  }

  // Wire UI
  if (btnSend) btnSend.addEventListener('click', sendBid);
  if (btnShowBids) btnShowBids.addEventListener('click', showBids);

  // Launch
  document.addEventListener('DOMContentLoaded', loadAuctions);
})();
