// POST /api/equip { skin:"id" } -> equips a skin the player OWNS.
import { authUser, ensurePlayer, getInventory, setEquipped, readJson, isValidSkin } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  try {
    const body = await readJson(req);
    const skin = String(body.skin || '');
    if (!isValidSkin(skin)) return res.status(400).json({ error: 'bad_skin' });

    await ensurePlayer(user.id, user.username);
    const inv = await getInventory(user.id);
    // Authoritative ownership check — can't equip what you don't own.
    if (!inv.owned.includes(skin)) return res.status(403).json({ error: 'not_owned' });

    await setEquipped(user.id, skin);
    return res.status(200).json({ ok: true, equipped: skin, owned: inv.owned });
  } catch (e) {
    console.log('[v0] /api/equip error:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
}
