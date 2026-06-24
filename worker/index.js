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
  async fetch(request, env) {
    const url = new URL(request.url);
    // POST /api/test-alert?secret=X  — sends a test LINE message (behind LINE_TOKEN + shared secret)
    if (request.method === 'POST' && url.pathname === '/api/test-alert') {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== env.ALERT_TEST_SECRET) return new Response('Forbidden', { status: 403 });
      if (!env.LINE_TOKEN) return new Response('LINE_TOKEN not set', { status: 500 });
      try {
        await broadcast(env.LINE_TOKEN, `🔔 Test alert from VCAN Dashboard — ${new Date().toISOString()}`);
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 502 });
      }
    }
    // ponytail: assets-first serving; this only runs for non-asset routes (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};
