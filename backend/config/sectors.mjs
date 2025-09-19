/** Liste centrale des secteurs (extensible) */
const normalize = (s) => String(s ?? '').toLowerCase();

export const SECTORS_RAW = [
  ['mobile',        'Téléphonie mobile'],
  ['box_internet',  'Box internet'],
  ['bank',          'Banque'],
  ['insurance',     'Assurance'],
  ['mutual',        'Mutuelle'],
  ['payment_card',  'Carte de paiement'],
  ['vod',           'VOD'],
  ['electricity','Électricité'],
  ['search_engine', 'Moteur de recherche'],
];

export const sectors = SECTORS_RAW.map(([slug, label]) => ({ slug: normalize(slug), label }));
export const sectorMap = Object.fromEntries(sectors.map(s => [s.slug, s.label]));
export const knownSlugs = new Set(sectors.map(s => s.slug));

export const getSectorLabel = (slug) => sectorMap[normalize(slug)] ?? String(slug ?? '');
export const isKnownSector = (slug) => knownSlugs.has(normalize(slug));

/** Optionnel : activer une whitelist stricte via l'env */
export const enforceWhitelist = process.env.SECTORS_ENFORCE === 'true';

