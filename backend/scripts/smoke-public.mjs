// scripts/smoke-public.mjs (ESM, read-only)
// Vérifie : /api/health, /api/auctions (défaut, all, archived), alias /api/auctions/:id/bids

import https from 'node:https';

const BASE = {
  hostname: 'localhost',
  port: 4443,
  rejectUnauthorized: false,
  headers: { Accept: 'application/json' },
};

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ ...BASE, path }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () =>
        resolve({ status: r.statusCode, headers: r.headers, body: d })
      );
    }).on('error', reject);
  });
}

function ok(cond, msg) {
  const mark = cond ? '✅' : '❌';
  console.log(`${mark} ${msg}`);
  return cond;
}

async function main() {
  let allGood = true;

  // 1) Health
  const h = await get('/api/health');
  const hJson = safeJson(h.body);
  allGood &= ok(h.status === 200 && hJson?.ok === true, 'Health OK');

  // 2) Auctions (défaut: not_archived)
  const a1 = await get('/api/auctions?page=1&limit=10&sort=created_at&order=asc');
  const j1 = safeJson(a1.body);
  allGood &= ok(a1.status === 200 && j1?.status === 'not_archived', 'Auctions défaut (not_archived)');
  console.log(`   -> total=${j1?.total} items.len=${(j1?.items||[]).length}`);

  // 3) Auctions (status=all)
  const a2 = await get('/api/auctions?status=all');
  const j2 = safeJson(a2.body);
  allGood &= ok(a2.status === 200 && j2?.status === 'all', 'Auctions status=all');
  console.log(`   -> total=${j2?.total} items.len=${(j2?.items||[]).length}`);

  // 4) Auctions (status=archived)
  const a3 = await get('/api/auctions?status=archived');
  const j3 = safeJson(a3.body);
  allGood &= ok(a3.status === 200 && j3?.status === 'archived', 'Auctions status=archived');
  console.log(`   -> total=${j3?.total} items.len=${(j3?.items||[]).length}`);

  // 5) Alias bids pour une enchère avec bids (ou la première)
  const list = j2?.items || j1?.items || [];
  const pick = list.find((x) => (x?.bids_count || 0) > 0) || list[0];
  if (pick?.id) {
    const b = await get(`/api/auctions/${pick.id}/bids?page=1&limit=5&sort=amount&order=desc`);
    const jb = safeJson(b.body);
    allGood &= ok(b.status === 200 && Array.isArray(jb?.items), 'Alias bids paginé/trié');
    console.log(`   -> auction_id=${pick.id} bids.len=${(jb?.items||[]).length}`);
  } else {
    console.log('ℹ️ Aucune enchère à tester pour les bids.');
  }

  console.log('\nRésumé:', allGood ? '✅ OK' : '❌ ÉCHEC');
  process.exit(allGood ? 0 : 1);
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return null; }
}

main().catch((e) => {
  console.error('Erreur smoke:', e.message);
  process.exit(1);
});
