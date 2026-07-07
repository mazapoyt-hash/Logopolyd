// ===== Token skins (cosmetic) =====
// A skin only changes how a player's 3D piece LOOKS — never gameplay. The
// player's COLOR is still shown (identity ring at the base of every skin) so
// pieces always stay distinguishable, even with premium finishes.
//
// This catalog is the single source of truth shared by:
//   - board3d.js  -> reads `finish` to build the 3D material/topper
//   - the shop UI -> reads name/price/swatch for cards
//   - the backend -> validates purchases against these ids + prices
//
// Prices are in Telegram Stars (XTR). price === 0 means free / owned by all.

const SKINS = [
  { id: 'classic',  price: 0,   finish: 'matte',    swatch: ['#c9ccd4', '#8b8f99'], icon: '♟',
    name: { ru: 'Классика',  en: 'Classic',   uk: 'Класика',   de: 'Klassik' } },
  { id: 'steel',    price: 0,   finish: 'steel',    swatch: ['#e7ebf2', '#9aa3b2'], icon: '♟',
    name: { ru: 'Сталь',     en: 'Steel',     uk: 'Сталь',     de: 'Stahl' } },
  { id: 'gold',     price: 75,  finish: 'gold',     swatch: ['#ffe38a', '#e0a52b'], icon: '♟',
    name: { ru: 'Золото',    en: 'Gold',      uk: 'Золото',    de: 'Gold' } },
  { id: 'chrome',   price: 120, finish: 'chrome',   swatch: ['#f2f6fb', '#aeb8c6'], icon: '♟',
    name: { ru: 'Хром',      en: 'Chrome',    uk: 'Хром',      de: 'Chrom' } },
  { id: 'obsidian', price: 99,  finish: 'obsidian', swatch: ['#3a3f4a', '#111318'], icon: '♟',
    name: { ru: 'Обсидиан',  en: 'Obsidian',  uk: 'Обсидіан',  de: 'Obsidian' } },
  { id: 'neon',     price: 150, finish: 'neon',     swatch: ['#38f2c8', '#0b3b34'], icon: '♟',
    name: { ru: 'Неон',      en: 'Neon',      uk: 'Неон',      de: 'Neon' } },
  { id: 'ruby',     price: 180, finish: 'ruby',     swatch: ['#ff5b7f', '#a1123a'], icon: '♟',
    name: { ru: 'Рубин',     en: 'Ruby',      uk: 'Рубін',     de: 'Rubin' } },
  { id: 'emerald',  price: 180, finish: 'emerald',  swatch: ['#4be39a', '#0f7a4a'], icon: '♟',
    name: { ru: 'Изумруд',   en: 'Emerald',   uk: 'Смарагд',   de: 'Smaragd' } },
  { id: 'crown',    price: 250, finish: 'crown',    swatch: ['#ffe38a', '#c98b1f'], icon: '♟',
    name: { ru: 'Корона',    en: 'Crown',     uk: 'Корона',    de: 'Krone' } },
  { id: 'diamond',  price: 300, finish: 'diamond',  swatch: ['#eaf6ff', '#a8cfe8'], icon: '♟',
    name: { ru: 'Алмаз',     en: 'Diamond',   uk: 'Діамант',   de: 'Diamant' } },
];

const DEFAULT_SKIN = 'classic';
// Owned by everyone without a purchase (price 0).
const FREE_SKINS = SKINS.filter(s => s.price === 0).map(s => s.id);

function skinById(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
function skinFinish(id) { return skinById(id).finish; }
function skinName(id) {
  const s = skinById(id);
  // `LANG` comes from i18n.js; fall back to English then the id.
  const lang = (typeof LANG !== 'undefined' && LANG) || 'en';
  return s.name[lang] || s.name.en || s.id;
}
// Guard against a client requesting a skin it doesn't own (belt-and-braces;
// the server is the real authority).
function validSkin(id, owned) {
  if (!skinById(id) || skinById(id).id !== id) return DEFAULT_SKIN;
  if (skinById(id).price === 0) return id;
  return (owned && owned.includes(id)) ? id : DEFAULT_SKIN;
}
