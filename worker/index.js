import { dueToday, daysUntil, bangkokToday } from '../src/promoAlerts.js';

function alertText(e, daysOut) {
  const acts = e.activities.join(', ');
  const brands = e.brands.length ? ` (${e.brands.join(', ')})` : '';
  return `📢 ${e.retailer}${brands}: ${acts} promo starts in ${daysOut} days — ${e.startDate}`;
}

async function broadcast(token, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
}

export default {
  async scheduled(event, env, ctx) {
    if (!env.LINE_TOKEN) { console.error('LINE_TOKEN not set'); return; }
    const today = bangkokToday();
    const res = await env.ASSETS.fetch('https://assets.local/notification_schedule.json');
    if (!res.ok) { console.error('schedule fetch failed', res.status); return; }
    const schedule = await res.json();
    const due = dueToday(schedule, today);
    console.log(`promo-alerts ${today}: ${due.length} due`);
    for (const e of due) {
      await broadcast(env.LINE_TOKEN, alertText(e, daysUntil(e.startDate, today)));
    }
  },
  fetch(request, env) {
    // ponytail: assets-first serving; this only runs for non-asset routes (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};
