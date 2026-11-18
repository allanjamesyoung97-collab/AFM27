export const MAX_ACTIVE_SCOUTING_ASSIGNMENTS = 5;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const addDays = (day, count) => {
  const date = new Date(`${String(day).slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};

export function scoutingDurationDays(listManagerRating) {
  const rating = Number.isFinite(Number(listManagerRating)) ? Number(listManagerRating) : 60;
  return clamp(Math.round(10 - (rating - 45) * 0.12), 3, 10);
}

export function nextScoutingAccuracy(baseAccuracy, previousReport, listManagerRating) {
  const base = clamp(Number(baseAccuracy) || 0.55, 0.45, 0.92);
  if (!previousReport) return base;
  const rating = Number.isFinite(Number(listManagerRating)) ? Number(listManagerRating) : 60;
  return clamp(Math.max(base, Number(previousReport.accuracy) || base) + clamp(0.07 + (rating - 60) * 0.001, 0.055, 0.105), 0.45, 0.95);
}

export function assignScoutingPlayer(season, playerId, baseAccuracy, listManagerRating) {
  const id = String(playerId);
  const active = (season.scoutingAssignments ?? []).filter(item => !item.completed);
  if (!id || id === 'undefined' || active.length >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS
    || active.some(item => String(item.playerId) === id)) return season;
  const date = season.calendarClock?.date;
  if (!date) return season;
  const previous = season.scoutingReports?.[id];
  const number = Math.max(0, Number(previous?.scoutingPasses) || (previous ? 1 : 0)) + 1;
  return { ...season, scoutingAssignments: [...(season.scoutingAssignments ?? []), {
    id: `scout:${id}:${date}:${number}`, playerId: playerId, assignedOn: date,
    dueDate: addDays(date, scoutingDurationDays(listManagerRating)),
    targetAccuracy: nextScoutingAccuracy(baseAccuracy, previous, listManagerRating),
    scoutingPass: number,
  }] };
}
