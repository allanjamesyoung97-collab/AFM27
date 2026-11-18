import { TACTIC_STYLES, getTacticalStyleFit } from './tacticsEngine.js';
import { getCareerClub } from './contractEngine.js';
import { createPlayer } from './playerFactory.js';
import { ATTRIBUTE_GROUPS, CORE_ATTRIBUTES_BY_POSITION, TRAIT_DEFINITIONS, getAttributeLabel, getPlayerTraitIds, getPositionFamily } from '../data/footballData.js';
import { getPlayerDevelopmentForecast } from './developmentEngine.js';
import { getPlayerPotential } from './potentialRules.js';

const styles = TACTIC_STYLES.filter(style => style.id !== 'ADAPTIVE_HYBRID');

export function assessRecruitmentFit(target, squad = []) {
  if (!target?.attributes) return null;
  const best = squad.filter(player => player?.attributes).sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 22);
  const targetRoles = target.positions ?? [];
  const sameRole = best.filter(player => (player.positions ?? []).some(role => targetRoles.includes(role)));
  const replaced = (sameRole.length ? sameRole : best).at(-1);
  const projected = best.length >= 22 && replaced ? [...best.filter(player => player !== replaced), target] : [...best, target];
  const rows = styles.map(style => {
    const before = getTacticalStyleFit(style.id, best).score;
    const after = getTacticalStyleFit(style.id, projected).score;
    return { id: style.id, name: style.name, before, after, change: after - before };
  });
  const sorted = [...rows].sort((a, b) => b.after - a.after);
  const strongest = sorted[0];
  const weakest = sorted.at(-1);
  const gains = [...rows].sort((a, b) => b.change - a.change);
  const average = rows.reduce((sum, row) => sum + row.after, 0) / rows.length;
  const specialty = strongest.after - average;
  const exposed = weakest.after < 68 || strongest.after - weakest.after >= 14;
  return {
    styles: rows, strongest, weakest, replaced: replaced?.name ?? null,
    balance: Math.round(100 - (strongest.after - weakest.after) * 1.5),
    summary: `${target.name} ${gains[0].change > 0 ? `improves ${gains[0].name} by ${gains[0].change} points` : `best suits ${strongest.name}`}. ${exposed ? `${weakest.name} remains a vulnerability` : specialty < 3 ? 'The squad remains balanced but lacks a clear specialty' : `${strongest.name} remains a distinct strength`}.`,
  };
}

export function getScoutingSquad(players, contracts, club) {
  return players.filter(player => getCareerClub(player, contracts) === club);
}

export function scoutingCandidateForProspect(prospect) {
  return createPlayer({
    id: prospect.id, name: prospect.name, club: '', age: 18,
    positions: prospect.positions, overall: prospect.overall,
    potential: prospect.potential, tier: 'Rookie', salary: 0, yearsRemaining: 0,
  });
}

// A completed report is an estimate, not an exact readout of hidden attributes.
// The same assignment always produces the same assessment when a save is resumed.
export function estimateRecruitmentFit(fit, accuracy, assignmentId) {
  if (!fit) return null;
  const confidence = Math.max(0.45, Math.min(0.95, Number(accuracy) || 0.55));
  const margin = Math.max(2, Math.round((1 - confidence) * 18));
  const noise = (key) => {
    let hash = 2166136261;
    for (const character of `${assignmentId}:${key}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return ((hash >>> 0) / 4294967295 - 0.5) * 2;
  };
  const rows = fit.styles.map(row => {
    const after = Math.max(0, Math.min(100, Math.round(row.after + noise(row.id) * margin)));
    const change = Math.round(row.change + noise(`${row.id}:change`) * Math.max(1, margin / 2));
    return { ...row, after, before: after - change, change, margin };
  });
  const ranked = [...rows].sort((a, b) => b.after - a.after);
  const gain = [...rows].sort((a, b) => b.change - a.change)[0];
  const spread = ranked[0].after - ranked.at(-1).after;
  return {
    styles: rows,
    strongest: ranked[0],
    weakest: ranked.at(-1),
    margin,
    summary: `${gain.change > margin / 2 ? `Likely strengthens ${gain.name}` : `Projects best in ${ranked[0].name}`}. ${spread > 13 + margin ? `${ranked.at(-1).name} may remain exposed.` : 'No clear tactical weakness is established by this report.'}`,
  };
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function scoutNoise(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return ((hash >>> 0) / 4294967295 - 0.5) * 2;
}

/** Freeze observations when an assignment completes so later development does not rewrite history. */
export function buildScoutingDossier(player, squad = [], accuracy = 0.55, assignmentId = '', seasonYear = 2027, playerState = {}) {
  const confidence = clamp(Number(accuracy) || 0.55, 0.45, 0.95);
  const halfWidth = Math.max(2, Math.round(2 + (1 - confidence) * 19));
  const positions = player.positions?.length ? player.positions : [player.position].filter(Boolean);
  const groups = Object.entries(ATTRIBUTE_GROUPS).map(([id, keys]) => ({
    id,
    name: id === 'footballIQ' ? 'Football IQ' : `${id[0].toUpperCase()}${id.slice(1)}`,
    attributes: keys.filter(key => Number.isFinite(Number(player.attributes?.[key])) && Number(player.attributes[key]) > 0)
      .map(key => {
        const actual = Number(player.attributes[key]);
        const estimate = clamp(Math.round(actual + scoutNoise(`${assignmentId}:attribute:${key}`) * halfWidth * 0.65), 1, 99);
        return { key, name: getAttributeLabel(key), low: clamp(estimate - halfWidth, 1, 99), high: clamp(estimate + halfWidth, 1, 99) };
      }),
  }));
  const readings = Object.fromEntries(groups.flatMap(group => group.attributes.map(row => [row.key, (row.low + row.high) / 2])));
  const roleKeys = [...new Set(positions.flatMap(position => CORE_ATTRIBUTES_BY_POSITION[position] ?? []))];
  const family = getPositionFamily(positions[0]);
  const observedTraitIds = getPlayerTraitIds(player).filter(id => (scoutNoise(`${assignmentId}:trait:${id}`) + 1) / 2 < confidence);
  const peers = squad.filter(candidate => candidate?.attributes && candidate.id !== player.id
    && (candidate.positions ?? [candidate.position]).some(position => positions.includes(position) || getPositionFamily(position) === family));
  const peerRows = peers.map(candidate => {
    const comparableKeys = roleKeys.filter(key => Number.isFinite(Number(candidate.attributes[key])) && Number.isFinite(readings[key]));
    const gap = comparableKeys.length
      ? comparableKeys.reduce((sum, key) => sum + readings[key] - Number(candidate.attributes[key]), 0) / comparableKeys.length
      : Number(player.overall ?? 60) - Number(candidate.overall ?? 60);
    const strengths = comparableKeys.map(key => ({ key, name: getAttributeLabel(key), gap: Math.round(readings[key] - Number(candidate.attributes[key])) }))
      .sort((a, b) => b.gap - a.gap);
    const ownTraits = new Set(observedTraitIds);
    const peerTraits = new Set(getPlayerTraitIds(candidate));
    return { playerId: candidate.id, name: candidate.name, positions: candidate.positions ?? [candidate.position],
      estimatedRoleGap: Math.round(gap), advantage: strengths.find(row => row.gap > halfWidth)?.name ?? null,
      disadvantage: [...strengths].reverse().find(row => row.gap < -halfWidth)?.name ?? null,
      sharedTraits: [...ownTraits].filter(id => peerTraits.has(id)).map(id => TRAIT_DEFINITIONS[id]?.label ?? id),
      uniqueTraits: [...ownTraits].filter(id => !peerTraits.has(id)).map(id => TRAIT_DEFINITIONS[id]?.label ?? id) };
  }).sort((a, b) => Math.abs(a.estimatedRoleGap) - Math.abs(b.estimatedRoleGap)).slice(0, 3);
  const actualPotential = getPlayerPotential(player, player.overall);
  const potentialEstimate = clamp(Math.round(actualPotential + scoutNoise(`${assignmentId}:ceiling`) * halfWidth * 0.65), Number(player.overall ?? 40), 99);
  let projectedOverall = Number(player.overall ?? 60);
  const projection = Array.from({ length: 3 }, (_, index) => {
    const year = Number(seasonYear) + index + 1;
    const forecast = getPlayerDevelopmentForecast({ ...player, overall: projectedOverall }, { ...playerState, overall: projectedOverall }, {
      seasonYear: year,
      playerMinutesPlayedById: { [player.id]: projectedOverall >= 78 ? 1350 : 650 },
    });
    projectedOverall = clamp(projectedOverall + Number(forecast.change ?? 0), 40, actualPotential);
    const estimate = clamp(Math.round(projectedOverall + scoutNoise(`${assignmentId}:year:${year}`) * halfWidth * 0.35), 40, 99);
    const spread = halfWidth + index + 1;
    return { year, low: clamp(estimate - spread, 40, 99), high: clamp(estimate + spread, 40, 99),
      phase: forecast.ageBand, assumption: 'Regular senior opportunities and balanced training' };
  });
  const traits = observedTraitIds.map(id => ({ id, label: TRAIT_DEFINITIONS[id]?.label ?? id,
    kind: TRAIT_DEFINITIONS[id]?.category ?? 'general' }));
  return { version: 1, confidence: Math.round(confidence * 100), halfWidth, groups, peers: peerRows, traits,
    potentialRange: { low: clamp(potentialEstimate - halfWidth, Number(player.overall ?? 40), 99), high: clamp(potentialEstimate + halfWidth, Number(player.overall ?? 40), 99) },
    projection, positions, playerName: player.name, club: player.club, age: player.age };
}
