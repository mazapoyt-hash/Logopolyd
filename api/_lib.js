// ===== Shared server helpers for the skin shop API =====
// Runs as Vercel serverless functions. Postgres is the AUTHORITY for what a
// player owns and has equipped; the client only ever mirrors this.

import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

// Server-side skin catalog. This is the source of truth for PRICES — the
// client sends only a skin id, never a price, so a tampered client can't
// change what an item costs. Keep ids/prices in sync with js/skins.js.
export const SKIN_PRICES = {
  classic: 0, steel: 0, gold: 75, chrome: 120, obsidian: 99,
  neon: 150, ruby: 180, emerald: 180, crown: 250, diamond: 300,
};
export const FREE_SKINS = Object.keys(SKIN_PRICES).filter(id => SKIN_PRICES[id] === 0);
export const DEFAULT_SKIN = 'classic';

export function isValidSkin(id) {
  return Object.prototype.hasOwnProperty.call(SKIN_PRICES, id);
}
export function isPaidSkin(id) {
  return isValidSkin(id) && SKIN_PRICES[id] > 0;
}

// ---- Telegram WebApp initData verification ----
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns the parsed user object { id, username, ... } when the signature is
// valid and fresh, otherwise null. NEVER trust a user id that isn't verified
// this way — it's the only thing standing between a player and free skins.
export function verifyInitData(initData, maxAgeSec = 86400) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;
  let params;
  try { params = new URLSearchParams(initData); } catch { return null; }

  const hash = params.get('hash');
  if (!hash) return null;

  const pairs = [];
  for (const [k, v] of params) { if (k !== 'hash') pairs.push(`${k}=${v}`); }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // constant-time compare
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // freshness check to blunt replay attacks
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || (Date.now() / 1000 - authDate) > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || typeof user.id !== 'number') return null;
    return user;
  } catch { return null; }
}

// Pull + verify the authed Telegram user from a request. Returns null on
// failure; callers should respond 401.
export function authUser(req) {
  const initData = req.headers['x-telegram-init-data'];
  return verifyInitData(Array.isArray(initData) ? initData[0] : initData);
}

// ---- inventory helpers (all queries are scoped by tg_id) ----
export async function ensurePlayer(tgId, username) {
  await sql`
    INSERT INTO game.player (tg_id, username)
    VALUES (${tgId}, ${username || null})
    ON CONFLICT (tg_id) DO UPDATE
      SET username = COALESCE(EXCLUDED.username, game.player.username),
          updated_at = now()
  `;
}

export async function getInventory(tgId) {
  const [rows, prof] = await Promise.all([
    sql`SELECT skin_id FROM game.owned_skin WHERE tg_id = ${tgId}`,
    sql`SELECT equipped_skin FROM game.player WHERE tg_id = ${tgId}`,
  ]);
  const paid = rows.map(r => r.skin_id).filter(isValidSkin);
  const owned = Array.from(new Set(FREE_SKINS.concat(paid)));
  let equipped = (prof[0] && prof[0].equipped_skin) || DEFAULT_SKIN;
  // never report an equipped skin the player doesn't actually own
  if (!owned.includes(equipped)) equipped = DEFAULT_SKIN;
  return { owned, equipped };
}

export async function grantSkin(tgId, skinId) {
  await sql`
    INSERT INTO game.owned_skin (tg_id, skin_id)
    VALUES (${tgId}, ${skinId})
    ON CONFLICT (tg_id, skin_id) DO NOTHING
  `;
}

export async function setEquipped(tgId, skinId) {
  await sql`
    UPDATE game.player SET equipped_skin = ${skinId}, updated_at = now()
    WHERE tg_id = ${tgId}
  `;
}

export function readJson(req) {
  // Vercel usually parses JSON bodies, but fall back to manual parse.
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
