// League-relative squad assessment used by Recruitment's Position Needs screen.
import { getClubAttraction } from '../data/clubAttraction.js';
import { clubs } from '../data/clubs.js';
import { getCareerClub } from './contractEngine.js';
import { compareLeagueSquads } from './leagueSquadComparison.js';

const number = (value, fallback) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;

function leagueRosters(allPlayers, contractsByPlayer) {
  const byClub = Object.fromEntries(clubs.map(club => [club.name, []]));
  for (const player of allPlayers ?? []) {
    const club = getCareerClub(player, contractsByPlayer);
    if (club && byClub[club]) byClub[club].push(player);
  }
  return byClub;
}

function ageProfile(players) {
  const result = { young: 0, prime: 0, veteran: 0 };
  for (const player of players) {
    const age = number(player.age, 25);
    if (age <= 23) result.young++;
    else if (age <= 29) result.prime++;
    else result.veteran++;
  }
  return result;
}

function generateInsights(analysis) {
  const insights = [];
  const groups = Object.values(analysis.positions);
  if (analysis.overallRank != null && analysis.leagueSize > 1) {
    const topThird = analysis.overallRank <= Math.ceil(analysis.leagueSize / 3);
    const bottomThird = analysis.overallRank > Math.floor(analysis.leagueSize * 2 / 3);
    if (topThird) insights.push({ text: `Overall squad quality ranks ${analysis.overallRank} of ${analysis.leagueSize} clubs.`, priority: 'medium', type: 'strength' });
    if (bottomThird) insights.push({ text: `Overall squad quality ranks ${analysis.overallRank} of ${analysis.leagueSize} clubs — improve the starting team.`, priority: 'high', type: 'need' });
  }
  for (const group of groups) {
    const comparison = `ranked ${group.rank} of ${group.leagueSize}, ${group.score} OVR against a league average of ${group.leagueAverage}`;
    if (group.missing) {
      insights.push({ text: `${group.label}: ${group.missing} starting ${group.missing === 1 ? 'option' : 'options'} missing (${comparison}).`, priority: 'high', type: 'need' });
    } else if (group.depth.label === 'Weak' || group.depth.label === 'Below average') {
      insights.push({ text: `Improve ${group.label.toLowerCase()} — ${comparison}.`, priority: group.depth.label === 'Weak' ? 'high' : 'medium', type: 'need' });
    } else if (group.depth.label === 'Elite') {
      insights.push({ text: `${group.label} are a league-leading group — ${comparison}.`, priority: 'low', type: 'strength' });
    }
  }
  if (!insights.some(insight => insight.type === 'need') && groups.length > 0) {
    const weakest = [...groups].sort((a, b) => a.gap - b.gap)[0];
    insights.push({ text: `Closest area to improve: ${weakest.label.toLowerCase()} (${weakest.score} OVR; league average ${weakest.leagueAverage}).`, priority: 'medium', type: 'need' });
  }
  return insights.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]);
}

export function analyzeSquad(allPlayers, clubName, contractsByPlayer = {}) {
  const rosters = leagueRosters(allPlayers, contractsByPlayer);
  const squad = rosters[clubName] ?? [];
  const positions = compareLeagueSquads(rosters, clubName);
  for (const group of Object.values(positions)) {
    group.averageOverall = Math.round(average(group.players.map(player => number(player.overall, 60))));
    group.averageAge = average(group.players.map(player => number(player.age, 25)));
    group.topOverall = group.players.length ? Math.max(...group.players.map(player => number(player.overall, 60))) : 0;
  }
  const overallQuality = average(squad.map(player => number(player.overall, 60)));
  const overallScores = Object.entries(rosters).map(([club, roster]) => ({ club, score: average(roster.map(player => number(player.overall, 60))) }));
  const overallRank = overallScores.length ? 1 + overallScores.filter(entry => entry.score > overallQuality).length : null;
  const attraction = getClubAttraction(clubName, { allPlayers, playerContracts: contractsByPlayer });
  const analysis = {
    clubName, squadSize: squad.length, overallQuality: Math.round(overallQuality),
    overallRank, leagueSize: overallScores.length,
    averageAge: average(squad.map(player => number(player.age, 25))),
    ageProfile: ageProfile(squad), positions,
    premiershipWindow: attraction.premiershipWindow ?? 60,
    rebuildStatus: (attraction.premiershipWindow ?? 60) < 50 ? 'Rebuilding' : (attraction.premiershipWindow ?? 60) >= 80 ? 'Contending' : 'Developing',
  };
  analysis.insights = generateInsights(analysis);
  return analysis;
}

export function getTopPositionNeeds(allPlayers, clubName, contractsByPlayer = {}) {
  const analysis = analyzeSquad(allPlayers, clubName, contractsByPlayer);
  return Object.entries(analysis.positions)
    .filter(([, group]) => group.missing > 0 || (group.leagueSize > 1 && (group.depth.label === 'Weak' || group.depth.label === 'Below average')))
    .map(([category, group]) => ({
      category, label: group.label,
      priority: group.missing > 0 || group.depth.label === 'Weak' ? 'High' : 'Medium',
      depthRating: group.depth.rating, depthLabel: group.depth.label,
      color: group.depth.color, count: group.count,
      averageOverall: group.averageOverall, averageAge: group.averageAge,
      leagueAverage: group.leagueAverage, rank: group.rank, leagueSize: group.leagueSize,
      starterQuality: group.score, missingStarters: group.missing,
    }))
    .sort((a, b) => (a.priority === b.priority ? a.depthRating - b.depthRating : a.priority === 'High' ? -1 : 1));
}
