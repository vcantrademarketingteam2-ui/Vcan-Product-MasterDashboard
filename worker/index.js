import { dueToday, daysUntil, bangkokToday } from '../src/promoAlerts.js';

const LINE_URL = 'https://api.line.me/v2/bot/message/broadcast';
const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGES = 5;

function validateSchedule(schedule) {
  if (!Array.isArray(schedule)) throw new Error('Malformed notification schedule');
  for (const entry of schedule) {
    if (!entry || typeof entry.retailer !== 'string' ||
        typeof entry.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate) ||
        !Array.isArray(entry.activities) || !Array.isArray(entry.brands)) {
      throw new Error('Malformed notification schedule');
    }
  }
}

function entryLine(entry, today) {
  const period = typeof entry.period === 'string' ? entry.period : '';
  const activities = entry.activities.join(', ');
  const brands = entry.brands.length ? ` | brands: ${entry.brands.join(', ')}` : '';
  return `- ${entry.startDate} (in ${daysUntil(entry.startDate, today)} days) | ${period} | activities: ${activities}${brands}`;
}

function digestLines(due, today) {
  const lines = [`Promo alerts for ${today}`];
  const grouped = new Map();
  for (const entry of due) {
    if (!grouped.has(entry.retailer)) grouped.set(entry.retailer, []);
    grouped.get(entry.retailer).push(entry);
  }
  for (const [retailer, entries] of grouped) {
    lines.push('', retailer);
    for (const entry of entries) lines.push(entryLine(entry, today));
  }
  return lines;
}

function splitMessages(lines) {
  const messages = [];
  let current = '';
  for (const line of lines) {
    if (line.length > MAX_MESSAGE_LENGTH) throw new Error('LINE digest line is too long');
    const next = current ? `${current}\n${line}` : line;
    if (next.length > MAX_MESSAGE_LENGTH) {
      messages.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) messages.push(current);
  if (messages.length > MAX_MESSAGES) throw new Error('LINE digest exceeds message limit');
  return messages;
}

async function retryKey(today, body) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(today + body));
  const bytes = new Uint8Array(digest);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function broadcast(token, messages, today) {
  const body = JSON.stringify({ messages: messages.map((text) => ({ type: 'text', text })) });
  const response = await fetch(LINE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': await retryKey(today, body),
    },
    body,
  });
  const acceptedId = response.headers.get('X-Line-Accepted-Request-Id');
  const requestId = response.headers.get('X-Line-Request-Id') || acceptedId || '';
  if (!response.ok && !(response.status === 409 && acceptedId)) {
    const error = new Error(`LINE request failed with status ${response.status}`);
    error.status = response.status;
    error.requestId = requestId;
    throw error;
  }
  return { status: response.status, requestId };
}

function resultLog(today, dueCount, messageCount, outcome, status = '', requestId = '') {
  console.log(`promo-alerts result date=${today} due=${dueCount} messages=${messageCount} outcome=${outcome} status=${status} requestId=${requestId}`);
}

export default {
  async scheduled(event, env) {
    const today = bangkokToday();
    let dueCount = 0;
    let messageCount = 0;
    try {
      if (!env.LINE_TOKEN) throw new Error('LINE_TOKEN not set');
      const response = await env.ASSETS.fetch('https://assets.local/notification_schedule.json');
      if (!response.ok) {
        const error = new Error(`Schedule fetch failed with status ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const schedule = await response.json();
      validateSchedule(schedule);
      const due = dueToday(schedule, today);
      dueCount = due.length;
      if (!due.length) {
        resultLog(today, 0, 0, 'success');
        return;
      }
      const messages = splitMessages(digestLines(due, today));
      messageCount = messages.length;
      const result = await broadcast(env.LINE_TOKEN, messages, today);
      resultLog(today, dueCount, messageCount, 'success', result.status, result.requestId);
    } catch (error) {
      resultLog(today, dueCount, messageCount, 'failure', error.status || '', error.requestId || '');
      throw error;
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    // POST /api/test-alert?secret=X — sends a test LINE message (behind LINE_TOKEN + shared secret)
    if (request.method === 'POST' && url.pathname === '/api/test-alert') {
      const secret = (url.searchParams.get('secret') || '').trim();
      const stored = (env.ALERT_TEST_SECRET || '').trim();
      console.log(`test-alert: received len=${secret.length}, stored len=${stored.length}`);
      if (!secret || secret !== stored) return new Response(`Forbidden (got ${secret.length} chars, stored ${stored.length} chars)`, { status: 403 });
      if (!env.LINE_TOKEN) return new Response('LINE_TOKEN not set', { status: 500 });
      try {
        await broadcast(env.LINE_TOKEN, [`🔔 Test alert from VCAN Dashboard — ${new Date().toISOString()}`], bangkokToday());
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 502 });
      }
    }
    // ponytail: assets-first serving; this only runs for non-asset routes (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};
