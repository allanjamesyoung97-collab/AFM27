// A completed move or fresh extension must not immediately create another trade demand.
export function recentPlayerMovement(player, season = {}, year = season.seasonYear) {
  const id = String(player?.id ?? '');
  const record = season.playerContracts?.[id] ?? {};
  const tradeYear = Number(String(season.calendarClock?.date ?? year).slice(0, 4));
  const movedInPeriod = (season.tradePeriodTransactions ?? []).some(transaction =>
    Number(transaction.tradePeriodYear) === tradeYear &&
    (transaction.playerMoves ?? []).some(move =>
      String(move.playerId ?? '') === id || (!move.playerId && move.playerName === player?.name)));
  return movedInPeriod || Number(record.lastTradedYear) === tradeYear || Number(record.lastTradedYear) === Number(year);
}

export function tradeEligibility(player, season = {}, year = season.seasonYear) {
  if (recentPlayerMovement(player, season, year)) return { eligible: false, reason: 'Player recently moved clubs' };
  return { eligible: true, reason: '' };
}

export function canRequestTrade(player, season = {}, year = season.seasonYear) {
  if (!tradeEligibility(player, season, year).eligible) return false;
  const record = season.playerContracts?.[String(player?.id)] ?? {};
  const signed = Number(record.signedSeason);
  const current = Number(year);
  // Contract extensions are distinct from initial list contracts and trades.
  if (record.lastExtendedYear && Number(record.lastExtendedYear) >= current - 1) return false;
  if (record.renewedOn && String(record.renewedOn).slice(0, 4) >= String(current - 1)) return false;
  if (record.contractExtension && Number.isFinite(signed) && signed >= current - 1) return false;
  return true;
}
