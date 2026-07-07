// POST /api/purchase/create { skin:"id" }
// Creates a Telegram Stars invoice link for a PAID skin and records a pending
// purchase keyed by a random payload. The bot webhook later matches the
// payment against this row and grants the skin. Prices come from the server
// catalog, never from the client.
import crypto from 'node:crypto';
import { authUser, ensurePlayer, getInventory, readJson, isPaidSkin, SKIN_PRICES, sql } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'bot_not_configured' });

  try {
    const body = await readJson(req);
    const skin = String(body.skin || '');
    if (!isPaidSkin(skin)) return res.status(400).json({ error: 'bad_skin' });

    await ensurePlayer(user.id, user.username);
    const inv = await getInventory(user.id);
    if (inv.owned.includes(skin)) return res.status(409).json({ error: 'already_owned' });

    const price = SKIN_PRICES[skin];
    const payload = crypto.randomUUID();

    await sql`
      INSERT INTO game.purchase (id, tg_id, skin_id, stars, status)
      VALUES (${payload}, ${user.id}, ${skin}, ${price}, 'pending')
    `;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Skin: ${skin}`,
        description: `Monopoly Online token skin "${skin}"`,
        payload,
        currency: 'XTR',
        prices: [{ label: `${skin} skin`, amount: price }],
      }),
    });
    const data = await tgRes.json();
    if (!data.ok) {
      console.log('[v0] createInvoiceLink failed:', JSON.stringify(data));
      return res.status(502).json({ error: 'invoice_failed' });
    }
    return res.status(200).json({ invoiceLink: data.result, payload });
  } catch (e) {
    console.log('[v0] /api/purchase/create error:', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
}
