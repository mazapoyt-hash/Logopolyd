// POST /api/telegram/webhook
// Telegram Bot webhook. Handles the two events in the Stars payment flow:
//   1. pre_checkout_query  -> we must approve within 10s (validate first)
//   2. successful_payment  -> grant the skin, mark the purchase paid
// Register with:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP>/api/telegram/webhook&secret_token=<SECRET>
import { sql, grantSkin, setEquipped, isPaidSkin, readJson } from '../_lib.js';

async function tg(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // If a webhook secret is configured, reject spoofed calls.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).end();
  }

  let update;
  try { update = await readJson(req); } catch { return res.status(200).json({ ok: true }); }

  try {
    // ---- 1) pre-checkout: validate the pending purchase, then approve ----
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      const payload = q.invoice_payload;
      const rows = await sql`
        SELECT skin_id, stars, status FROM game.purchase WHERE id = ${payload}
      `;
      const p = rows[0];
      const ok = !!p && p.status !== 'paid' && isPaidSkin(p.skin_id) && p.stars === q.total_amount;
      await tg('answerPreCheckoutQuery', {
        pre_checkout_query_id: q.id,
        ok,
        error_message: ok ? undefined : 'This purchase is no longer valid. Please try again.',
      });
      return res.status(200).json({ ok: true });
    }

    // ---- 2) successful payment: grant + equip the skin (idempotent) ----
    const sp = update.message && update.message.successful_payment;
    if (sp) {
      const payload = sp.invoice_payload;
      const rows = await sql`
        SELECT tg_id, skin_id, status FROM game.purchase WHERE id = ${payload}
      `;
      const p = rows[0];
      if (p && p.status !== 'paid') {
        await grantSkin(p.tg_id, p.skin_id);
        await setEquipped(p.tg_id, p.skin_id);
        await sql`
          UPDATE game.purchase
          SET status = 'paid', paid_at = now(),
              telegram_charge_id = ${sp.telegram_payment_charge_id || null}
          WHERE id = ${payload}
        `;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.log('[v0] webhook error:', e.message);
    // Always 200 so Telegram doesn't hammer retries on a transient error.
    return res.status(200).json({ ok: true });
  }
}
