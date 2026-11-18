// Civil dates are persisted independently of browser timezone and daylight saving.
export const CLOCK_VERSION = 1;
export const DAY_SLOTS = ['MORNING', 'PREPARATION', 'COMPETITION', 'EVENING'];
export const CONTINUE_COMMANDS = [
  ['DAY', 'Continue'], ['EVENT', 'Continue to Next Event'], ['MATCH', 'Continue to Next Match'],
  ['WEEK', 'Continue One Week'], ['MONTH', 'Continue One Month'], ['TRADE', 'Continue to Trade Period'],
  ['DRAFT', 'Continue to National Draft'], ['SEASON_END', 'Continue to Season End'],
];
export function dayKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value) return value;
    throw new Error(`Invalid calendar date: ${value}`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid simulation date is required.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDate(value) {
  const [y, m, d] = dayKey(value).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(value, count) {
  const date = new Date(`${dayKey(value)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function addMonth(value) {
  const [y, m, d] = dayKey(value).split('-').map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last), 12)).toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${dayKey(b)}T12:00:00Z`) - Date.parse(`${dayKey(a)}T12:00:00Z`)) / 86400000);
}
export function formatDay(value) {
  if (!value) return '';
  try { return localDate(value).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return String(value); }
}
export function seededRandom(key) {
  let seed = 2166136261;
  for (const character of String(key)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
export function createClock(date, seed = 'afl-career') {
  return { version: CLOCK_VERSION, date: dayKey(date), slot: 0, seed, revision: 0, daysProcessed: 0 };
}
export function normalizeClock(clock, fallback) {
  return { ...createClock(fallback), ...clock, date: dayKey(clock?.date ?? fallback), slot: Math.max(0, Math.min(3, Number(clock?.slot) || 0)) };
}
export function nextCheckpoint(clock) {
  return { ...clock, revision: clock.revision + 1, slot: (clock.slot + 1) % 4,
    date: clock.slot === 3 ? addDays(clock.date, 1) : clock.date,
    daysProcessed: clock.daysProcessed + (clock.slot === 3 ? 1 : 0) };
}
