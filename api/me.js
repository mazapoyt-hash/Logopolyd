// GET /api/me -> { owned:[...], equipped:"id" } for the authed Telegram user.
import { authUser, ensurePlayer, getInventory } from './_lib.js';

export default async function handler(req, res) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  try {
    await ensurePlayer(user.id, user.username);
    const inv = await getInventory(user.id);
    return res.status(200).json(inv);
  } catch (e) {
    console.log('[v0] /api/me error:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
}
