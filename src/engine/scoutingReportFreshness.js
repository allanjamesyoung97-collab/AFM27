export function getScoutingReportFreshness(report, currentDate) {
  const assessed = Date.parse(`${report?.assessedOn ?? ''}T12:00:00Z`);
  const current = Date.parse(`${currentDate ?? ''}T12:00:00Z`);
  if (!Number.isFinite(assessed) || !Number.isFinite(current)) {
    return { status: 'UNKNOWN', days: null, label: 'Date unavailable' };
  }
  const days = Math.max(0, Math.round((current - assessed) / 86400000));
  const status = days <= 42 ? 'CURRENT' : days <= 90 ? 'AGING' : 'STALE';
  return { status, days, label: days === 0 ? 'Filed today' : `${days} days old` };
}
