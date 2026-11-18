import { seededRandom, addDays } from './simulationClock.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const IMPACT = ['Low', 'Medium', 'High', 'Severe'];

export function gradeIncident({ conduct, impact, contact }) {
  const score = (conduct === 'Intentional' ? 2 : 0) + IMPACT.indexOf(impact) + (contact === 'High' ? 1 : 0);
  if (score <= 1) return { kind: 'FINE', fine: score ? 2500 : 1500, matches: 0 };
  return { kind: 'SUSPENSION', fine: 0, matches: clamp(score - 1, 1, 5) };
}

export function createMatchIncidents(result, players, seed) {
  const byId = new Map(players.map(player => [String(player.id), player]));
  const incidents = [];
  for (const side of ['home', 'away']) for (const row of result.playerStats?.[side] ?? []) {
    if (!row.playerId || Number(row.timeOnGround ?? 0) <= 0) continue;
    const player = byId.get(String(row.playerId));
    const random = seededRandom(`${seed}:mro:${row.playerId}`);
    const discipline = Number(player?.attributes?.discipline ?? 65);
    const tackles = Number(row.tackles ?? 0);
    const freeAgainst = Number(row.freeKicksAgainst ?? 0);
    const probability = clamp(0.001 + tackles * 0.0015 + freeAgainst * 0.008 + Math.max(0, 65 - discipline) * 0.0004, 0, 0.12);
    if (random() >= probability) continue;
    const conduct = random() < clamp(0.12 + (55 - discipline) * 0.004, 0.04, 0.4) ? 'Intentional' : 'Careless';
    const impactRoll = random();
    const impact = impactRoll < 0.57 ? 'Low' : impactRoll < 0.85 ? 'Medium' : impactRoll < 0.97 ? 'High' : 'Severe';
    const contact = random() < 0.36 ? 'High' : 'Body';
    const sanction = gradeIncident({ conduct, impact, contact });
    incidents.push({ id: `${result.fixtureId}:mro:${row.playerId}`, fixtureId: result.fixtureId,
      playerId: String(row.playerId), playerName: row.playerName ?? player?.name ?? 'Player',
      club: result[`${side}Team`], date: result.date, conduct, impact, contact, ...sanction,
      legalFee: 15000 + sanction.matches * 5000, status: 'PENDING' });
  }
  return incidents;
}

export function resolveTribunalCase(season, fitness, caseId, action, userClubName = '') {
  const incident = (season.tribunalCases ?? []).find(item => item.id === caseId);
  if (!incident || incident.status !== 'PENDING') return { season, fitness };
  const challenged = action === 'CHALLENGE';
  const roll = seededRandom(`${caseId}:tribunal-hearing`)();
  const overturned = challenged && roll < (incident.conduct === 'Intentional' ? 0.2 : incident.impact === 'Low' ? 0.45 : 0.3);
  const status = challenged ? overturned ? 'OVERTURNED' : 'UPHELD' : 'ACCEPTED';
  const nextSeason = { ...season,
    tribunalCases: season.tribunalCases.map(item => item.id === caseId ? { ...item, status, resolvedOn: season.calendarClock?.date ?? incident.date } : item),
    calendarDecisions: (season.calendarDecisions ?? []).map(event => event.caseId === caseId ? { ...event, status: 'RESOLVED', resolvedOn: season.calendarClock?.date ?? incident.date } : event),
  };
  if (challenged && incident.club === userClubName && season.clubAdministration) {
    nextSeason.clubAdministration = { ...season.clubAdministration,
      cashBalance: Number(season.clubAdministration.cashBalance ?? 0) - incident.legalFee };
  }
  const nextFitness = { ...fitness };
  if (!overturned && incident.matches > 0) {
    const state = nextFitness[incident.playerId] ?? { fitness: 100 };
    nextFitness[incident.playerId] = { ...state,
      suspension: { matchesRemaining: Math.max(Number(state.suspension?.matchesRemaining ?? 0), incident.matches),
        reason: `${incident.conduct} · ${incident.impact} impact · ${incident.contact} contact`, caseId } };
  }
  if (incident.club === userClubName) nextSeason.mailMessages = [...(nextSeason.mailMessages ?? []), {
    id: `tribunal-outcome:${caseId}`, type: 'TRIBUNAL', receivedAt: `${nextSeason.calendarClock?.date ?? incident.date}T17:00:00`,
    subject: `${incident.playerName} · ${status === 'OVERTURNED' ? 'charge overturned' : incident.matches ? `${incident.matches}-match suspension` : 'fine'}`,
    summary: `${incident.club}: ${status.toLowerCase()}.`,
    detail: `${incident.conduct} conduct, ${incident.impact.toLowerCase()} impact, ${incident.contact.toLowerCase()} contact. ${status === 'OVERTURNED' ? 'No sanction applies.' : incident.matches ? `${incident.matches} senior matches to serve.` : `$${incident.fine.toLocaleString()} fine.`}${challenged ? ` Tribunal legal fee: $${incident.legalFee.toLocaleString()}.` : ''}`,
  }];
  return { season: nextSeason, fitness: nextFitness };
}

export function tribunalDecision(incident) {
  return { id: `tribunal:${incident.id}`, caseId: incident.id, type: 'TRIBUNAL', title: `Match Review · ${incident.playerName}`,
    reason: `${incident.conduct} conduct · ${incident.impact} impact · ${incident.contact} contact. Proposed ${incident.matches ? `${incident.matches}-match ban` : `$${incident.fine.toLocaleString()} fine`}. Tribunal legal fee $${incident.legalFee.toLocaleString()}.`,
    deadline: addDays(incident.date, 2), screen: 'SEASON', status: 'PENDING', created: incident.date };
}
