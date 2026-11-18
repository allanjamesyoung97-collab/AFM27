import { dayKey, addDays } from './simulationClock.js';
// Game preset; replace year overrides to reproduce a particular published AFL calendar.
export function getSeasonRules(year, overrides = {}) {
const date = (month, day) => `${year}-${month}-${day}`;
return {
version: 1, year, timezone: 'Australia/Melbourne', listLimit: 44, nationalDraftRounds: 5,
freeAgencyOpen: date('10', '05'), freeAgencyClose: date('10', '18'),
delistedFreeAgencyOpen: date('10', '31'), delistedFreeAgencyClose: date('11', '24'),
tradeOpen: date('10', '05'), tradeClose: date('10', '18'), contractExpiry: date('10', '31'),
nationalDraft: date('11', '25'), rookieDraft: date('11', '28'),
preseasonReturn: date('11', '15'), communitySeries: date('02', '25'),
midSeasonDraft: date('06', '01'),
// Tasmania's expansion concession: the club may sign players who are out of contract
// for the following season (one per club) from the day the career hands over to the
// manager until free agency closes.
tasmaniaConcessionOpen: date('10', '01'), tasmaniaConcessionClose: date('10', '18'), ...overrides,
};
}
export function rulesForDate(season, date) {
const year = Number(dayKey(date).slice(0, 4));
return getSeasonRules(year, season.calendarRules?.[year]);
}
export function windowOpen(date, start, end) { const key = dayKey(date); return key >= start && key <= end; }
export function isMovementWindow(season, date, kind = 'trade') {
const rules = rulesForDate(season, date);
return windowOpen(date, rules[`${kind}Open`], rules[`${kind}Close`]);
}
export function annualEvents(season, date) {
const year = Number(dayKey(date).slice(0, 4));
const r = getSeasonRules(year, season.calendarRules?.[year]);
const concessionEvents = season?.expansionCareer && year === 2027 ? [
{ id: `tasmania-concession-${year}`, date: r.tasmaniaConcessionOpen, type: 'TRADE', title: 'Tasmania concession signing window opens' },
{ id: `tasmania-concession-close-${year}`, date: r.tasmaniaConcessionClose, type: 'TRADE', title: 'Tasmania concession signing window closes' },
] : [];
return [
...concessionEvents,
{ id: `trade-open-${year}`, date: r.tradeOpen, type: 'TRADE', title: 'Trade period opens' },
{ id: `trade-close-${year}`, date: r.tradeClose, type: 'TRADE', title: 'Trade deadline' },
{ id: `free-agency-${year}`, date: r.freeAgencyOpen, type: 'TRADE', title: 'Free agency opens' },
{ id: `contracts-expire-${year}`, date: r.contractExpiry, type: 'CONTRACT', title: 'Contract expiry and list review' },
{ id: `draft-${year}`, date: r.nationalDraft, type: 'DRAFT', title: 'National Draft', mandatory: true,
resolved: Number(season.draftState?.draftYear) !== year || Boolean(season.draftState?.completed) || ["ROOKIE", "MID_SEASON"].includes(season.draftState?.kind) },
{ id: `rookie-draft-${year}`, date: r.rookieDraft, type: 'DRAFT', title: 'Rookie Draft', mandatory: true, resolved: season.draftState?.kind !== 'ROOKIE' || season.draftState?.completed },
{ id: `return-${year}`, date: r.preseasonReturn, type: 'CLUB_EVENT', title: 'Preseason return assessments' },
{ id: `community-${year}`, date: r.communitySeries, type: 'CLUB_EVENT', title: 'Community Series preparation' },
{ id: `midseason-${year}`, date: r.midSeasonDraft, type: 'DRAFT', title: 'Mid-season Draft', mandatory: true, resolved: season.draftState?.kind !== 'MID_SEASON' || season.draftState?.completed },
{ id: `trade-roundup-1-${year}`, date: addDays(r.tradeOpen, 7), type: 'MEDIA', title: 'Trades Completed (Week 1)' },
{ id: `trade-roundup-2-${year}`, date: addDays(r.tradeClose, 1), type: 'MEDIA', title: 'Trades Completed (Week 2)' },
];
}
