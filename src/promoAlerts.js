// Pure date helpers for promo alerts. No DOM, no deps — runnable under node and bundlable
// into the Cron Worker. Shared by the Worker (dueToday) and the App.jsx bell (upcomingWithin).
const DAY = 86400000;

export function daysUntil(dateISO, todayISO) {
  const a = Date.parse(todayISO + 'T00:00:00Z');
  const b = Date.parse(dateISO + 'T00:00:00Z');
  return Math.round((b - a) / DAY);
}

export function dueToday(schedule, todayISO) {
  return schedule.filter((e) => {
    const d = daysUntil(e.startDate, todayISO);
    return d === 5 || d === 2;
  });
}

export function upcomingWithin(schedule, todayISO, days = 5) {
  return schedule.filter((e) => {
    const d = daysUntil(e.startDate, todayISO);
    return d >= 0 && d <= days;
  });
}

export function bangkokToday(now = new Date()) {
  // ponytail: fixed +7h offset — Thailand has no DST, so no tz library needed
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
