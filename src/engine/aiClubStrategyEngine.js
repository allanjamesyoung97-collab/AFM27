import { getCareerClub } from './contractEngine.js';
import { getTopPositionNeeds } from './squadAnalysisEngine.js';
import { estimateSalaryDemand } from './contractValueEngine.js';
import { evaluateOffer, defaultRoleForPlayer } from './negotiationEngine.js';
import { getMinimumSalary } from './salaryCap.js';
import { getYearlySalaries } from './contractStructure.js';
import { checkClubCommitments } from './transactionRules.js';
import { TACTIC_STYLES, DEFAULT_TACTICS } from './tacticsEngine.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positions = (player) => player.positions?.length ? player.positions : [player.position];
const groups = { keyDefenders: ['KPD'], keyForwards: ['KPF'], midfielders: ['MID', 'WING'], rucks: ['RUC'], smallDefenders: ['HB', 'BP'], smallForwards: ['HF', 'FF'] };
const hash = (value) => { let h = 2166136261; for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function buildAIClubPlan(club, players, contracts, season, previous = {}) {
  const squad = players.filter(player => getCareerClub(player, contracts) === club.name);
  const ladderIndex = (season.ladder ?? []).findIndex(row => (row.club ?? row.team ?? row.name) === club.name);
  const played = (season.roundHistory ?? []).length;
  const expectedRank = number(previous.expectedRank ?? club.expectedFinish ?? club.projectedRank, 9);
  const rank = ladderIndex < 0 ? expectedRank : ladderIndex + 1;
  const gap = played >= 5 ? rank - expectedRank : 0;
  const averageAge = squad.reduce((sum, player) => sum + number(player.age, 25), 0) / Math.max(1, squad.length);
  const strategy = rank <= 6 && averageAge >= 25 ? 'CONTENDING' : rank >= 13 || averageAge < 24 ? 'REBUILDING' : 'DEVELOPING';
  const explicitNeeds = getTopPositionNeeds(players, club.name, contracts);
  const fallbackNeeds = Object.entries(groups).map(([category, codes]) => {
    const options = squad.filter(player => positions(player).some(pos => codes.includes(pos))).sort((a, b) => number(b.overall) - number(a.overall));
    const depth = options.slice(0, category === 'rucks' ? 2 : 4);
    const quality = depth.reduce((sum, player) => sum + number(player.overall, 60), 0) / Math.max(1, depth.length);
    return { category, priority: options.length < (category === 'rucks' ? 2 : 4) ? 'High' : quality < 74 ? 'Medium' : 'Low', depthRating: Math.round(quality) };
  }).sort((a, b) => a.depthRating - b.depthRating);
  const needs = explicitNeeds.length ? explicitNeeds.slice(0, 3) : fallbackNeeds.slice(0, 2);
  const targets = players.filter(player => {
    const owner = getCareerClub(player, contracts);
    return owner && owner !== club.name && !contracts[String(player.id)]?.retired && !contracts[String(player.id)]?.delisted;
  }).map(player => {
    const fit = needs.find(need => positions(player).some(pos => groups[need.category]?.includes(pos)));
    const age = number(player.age, 25);
    const ageFit = strategy === 'REBUILDING' ? Math.max(-18, 26 - age) * 2 : strategy === 'CONTENDING' ? -Math.abs(age - 27) * 2 : -Math.abs(age - 25);
    return { playerId: String(player.id), route: number(contracts[String(player.id)]?.yearsRemaining ?? player.contract?.yearsRemaining, 1) <= 0 ? 'FREE_AGENCY' : 'TRADE', score: (fit ? 32 - number(fit.depthRating) / 5 : -20) + number(player.overall, 60) * 0.4 + ageFit + hash(`${club.name}:${player.id}`) * 5, need: fit?.category ?? null };
  }).filter(target => target.need).sort((a, b) => b.score - a.score).slice(0, 4);
  return { ...previous, reviewedOn: season.calendarClock?.date, strategy, averageAge, rank, expectedRank, performanceGap: gap, needs: needs.map(({ category, priority, depthRating }) => ({ category, priority, depthRating })), targets };
}

export function chooseAIClubTactics(plan, squad, previous = DEFAULT_TACTICS) {
  // A sustained slide prompts a simpler structure; good sides keep a style that fits their attributes.
  if (plan.performanceGap >= 5) return { style: 'DEFENCE_FIRST', sliders: { attackDefence: 68, corridorBoundary: 58, possessionTerritory: 52, pressureStructure: 62, riskSafety: 72, contestSpread: 55 } };
  const candidates = TACTIC_STYLES.filter(style => style.id !== 'ADAPTIVE_HYBRID').map(style => {
    const suited = squad.filter(player => !style.fitPositions.length || positions(player).some(position => style.fitPositions.includes(position)));
    const sample = suited.length ? suited : squad;
    const score = sample.reduce((sum, player) => sum + style.fitAttributes.reduce((total, attribute) => total + number(player.attributes?.[attribute], 60), 0) / style.fitAttributes.length, 0) / Math.max(1, sample.length);
    return { style: style.id, score };
  }).sort((a, b) => b.score - a.score);
  return { ...DEFAULT_TACTICS, style: candidates[0]?.style ?? previous.style ?? DEFAULT_TACTICS.style };
}

export function negotiateAIExtension(player, clubName, players, contracts, administration, seasonYear, plan, date) {
  const record = contracts[String(player.id)] ?? player.contract ?? {};
  const remaining = Math.max(0, number(record.yearsRemaining, 0));
  if (remaining > 1 || record.calendarRetainedYear === Number(date.slice(0, 4))) return null;
  const squad = players.filter(candidate => getCareerClub(candidate, contracts) === clubName && String(candidate.id) !== String(player.id));
  const alternatives = squad.filter(candidate => positions(candidate).some(pos => positions(player).includes(pos))).sort((a, b) => number(b.overall) - number(a.overall));
  const replacement = alternatives[0];
  const role = defaultRoleForPlayer(player);
  const age = number(player.age, 25);
  const qualityGap = number(player.overall, 60) - number(replacement?.overall, 55);
  const need = (plan?.needs ?? []).some(item => positions(player).some(pos => groups[item.category]?.includes(pos)));
  const priority = qualityGap * 2 + (need ? 18 : 0) + (number(player.overall, 60) - 70) + (plan?.strategy === 'REBUILDING' && age >= 30 ? -25 : 0) + (age <= 23 ? 10 : 0);
  if (priority < 10) return { outcome: 'RELEASE', reason: 'Comparable cover or a different list direction.' };
  const demand = estimateSalaryDemand(player, clubName, 1, seasonYear + 1);
  const years = age >= 32 ? 1 : age >= 29 ? (priority >= 40 ? 2 : 1) : age <= 23 && priority >= 35 ? 3 : 2;
  const salaryFactors = priority >= 48 ? [1, 1.09] : priority >= 28 ? [0.92, 1.02] : [0.82, 0.94];
  for (const factor of salaryFactors) {
    const salary = Math.max(getMinimumSalary(seasonYear + 1), Math.round(demand * factor / 5000) * 5000);
    const currentSchedule = getYearlySalaries({ ...player.contract, ...record });
    const yearlySalaries = [...currentSchedule.slice(0, remaining), ...Array(years).fill(salary)];
    const next = { ...contracts, [player.id]: { ...record, salary: yearlySalaries[0], yearlySalaries, yearsRemaining: yearlySalaries.length, calendarRetainedYear: Number(date.slice(0, 4)), lastExtendedYear: seasonYear } };
    if (!checkClubCommitments(players, next, clubName, seasonYear, 3, administration).ok) continue;
    const offeredRole = number(player.overall, 60) >= 81 && qualityGap >= 0 ? 'BEST_22' : role;
    const verdict = evaluateOffer(player, { clubName, salary, years, role: offeredRole }, { seasonYear: seasonYear + 1, deterministic: true, clubName });
    const morale = number(player.development?.happiness ?? player.happiness ?? player.morale, 50);
    const opportunity = qualityGap >= 0 ? 5 : -6;
    const decisionScore = verdict.score + opportunity + (morale - 50) * 0.12;
    if (decisionScore >= 66) return { outcome: 'SIGNED', contracts: next, salary, years, score: decisionScore };
  }
  return { outcome: 'UNSIGNED', reason: 'The player or club could not agree to affordable terms.' };
}
