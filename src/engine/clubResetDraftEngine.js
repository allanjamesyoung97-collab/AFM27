import { createPlayer } from "./playerFactory.js";
import { getMinimumSalary, getSalaryCap } from "./salaryCap.js";

export const CLUB_RESET_ROSTER_SIZE = 44;
export const CLUB_RESET_POSITION_MINIMUMS = { DEF: 6, MID: 6, FWD: 6, RUC: 2 };

export function resetDraftPositionGroup(player) {
  const positions = player?.positions ?? (player?.position ? [player.position] : []);
  if (positions.some(position => ["RUC", "RUCK"].includes(position))) return "RUC";
  if (positions.some(position => ["KPD", "HB", "BP", "FB", "CHB"].includes(position))) return "DEF";
  if (positions.some(position => ["KPF", "HF", "HFF", "FP", "FF", "CHF"].includes(position))) return "FWD";
  return "MID";
}

function rosterCounts(state, clubName) {
  const counts = { DEF: 0, MID: 0, FWD: 0, RUC: 0 };
  for (const playerId of state.rosters[clubName] ?? []) {
    const player = state.playersById[playerId];
    if (player) counts[resetDraftPositionGroup(player)] += 1;
  }
  return counts;
}

function remainingForClub(state, clubName) {
  return Math.max(0, CLUB_RESET_ROSTER_SIZE - (state.rosters[clubName]?.length ?? 0));
}

function snakeOrder(clubs) {
  // The opening league draft has no prior ladder. Draw a new club order for
  // each Club Reset game, then reverse it in alternating rounds.
  const ordered = clubs.map(club => club.name);
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return Array.from({ length: CLUB_RESET_ROSTER_SIZE }, (_, round) =>
    round % 2 === 0 ? ordered : [...ordered].reverse(),
  ).flat();
}

export function createClubResetDraft({ players = [], prospects = [], clubs = [], userClub, contracts = {}, seasonYear = 2027 } = {}) {
  const cap = getSalaryCap(seasonYear);
  const minimumSalary = getMinimumSalary(seasonYear);
  const prospectPlayers = prospects.map(prospect => {
    const salary = minimumSalary;
    const player = createPlayer({
      id: prospect.id, name: prospect.name, club: null, age: 18, positions: prospect.positions,
      overall: prospect.overall, potential: prospect.potential, salary, yearsRemaining: 2,
      tier: prospect.potential >= 88 ? "Elite" : prospect.potential >= 82 ? "Star" : "Depth",
    });
    return { ...player, ageYear: seasonYear, heightCm: prospect.height, juniorClub: prospect.juniorClub, draftRank: prospect.rank, isDraftProspect: true };
  });
  const allPlayers = [...players, ...prospectPlayers];
  const playerContracts = { ...contracts };
  allPlayers.forEach(player => {
    const id = String(player.id);
    const previous = playerContracts[id] ?? {};
    playerContracts[id] = { ...previous, club: null };
    if (player.isDraftProspect) {
      playerContracts[id] = { ...playerContracts[id], salary: minimumSalary, yearsRemaining: 2, contractYears: 2, signedSeason: seasonYear };
    } else if (!Number.isFinite(Number(playerContracts[id].salary))) {
      playerContracts[id] = { ...playerContracts[id], salary: Number(player.contract?.salary ?? minimumSalary) };
    }
  });
  const pickOwners = snakeOrder(clubs);
  const state = {
    mode: "CLUB_RESET",
    seasonYear,
    userClub,
    clubs: clubs.map(club => club.name),
    players: allPlayers,
    playersById: Object.fromEntries(allPlayers.map(player => [String(player.id), player])),
    playerContracts,
    availableIds: allPlayers.map(player => String(player.id)),
    pickOwners,
    pickIndex: 0,
    totalPicks: Math.min(pickOwners.length, allPlayers.length),
    rosters: Object.fromEntries(clubs.map(club => [club.name, []])),
    payroll: Object.fromEntries(clubs.map(club => [club.name, 0])),
    salaryCap: cap,
    minimumSalary,
    picks: [],
    completed: false,
  };
  return advanceClubResetDraftToUser(state);
}

export function getClubResetDraftStatus(state, clubName = state?.userClub) {
  const counts = state ? rosterCounts(state, clubName) : { ...CLUB_RESET_POSITION_MINIMUMS };
  return {
    counts,
    minimums: CLUB_RESET_POSITION_MINIMUMS,
    rostered: state?.rosters?.[clubName]?.length ?? 0,
    rosterSize: CLUB_RESET_ROSTER_SIZE,
    remainingPicks: remainingForClub(state ?? {}, clubName),
    remainingCap: Math.max(0, Number(state?.salaryCap ?? 0) - Number(state?.payroll?.[clubName] ?? 0)),
    payroll: Number(state?.payroll?.[clubName] ?? 0),
    salaryCap: Number(state?.salaryCap ?? 0),
  };
}

export function getClubResetDraftEligibility(state, clubName = state?.userClub) {
  const eligibility = {};
  if (!state || state.completed || state.pickOwners[state.pickIndex] !== clubName) return eligibility;
  const status = getClubResetDraftStatus(state, clubName);
  if (status.rostered >= CLUB_RESET_ROSTER_SIZE) return eligibility;
  const availableGroupCounts = { DEF: 0, MID: 0, FWD: 0, RUC: 0 };
  state.availableIds.forEach(id => { const player = state.playersById[id]; if (player) availableGroupCounts[resetDraftPositionGroup(player)] += 1; });
  const rosterDeficits = Object.fromEntries(Object.entries(CLUB_RESET_POSITION_MINIMUMS).map(([group, minimum]) => [group, Math.max(0, minimum - status.counts[group])]));
  const leagueDeficits = { DEF: 0, MID: 0, FWD: 0, RUC: 0 };
  Object.keys(state.rosters).forEach(club => {
    const counts = rosterCounts(state, club);
    Object.entries(CLUB_RESET_POSITION_MINIMUMS).forEach(([group, minimum]) => {
      leagueDeficits[group] += Math.max(0, minimum - counts[group]);
    });
  });
  for (const id of state.availableIds) {
    const player = state.playersById[id];
    if (!player) continue;
    const group = resetDraftPositionGroup(player);
    const salary = Number(state.playerContracts[id]?.salary ?? player.contract?.salary ?? state.minimumSalary);
    let reason = "";
    if (status.payroll + salary + (status.remainingPicks - 1) * state.minimumSalary > status.salaryCap) {
      reason = "This selection would leave too little cap space to complete the list.";
    }
    const deficitsAfter = { ...rosterDeficits, [group]: Math.max(0, rosterDeficits[group] - 1) };
    const picksAfter = status.remainingPicks - 1;
    const leagueDeficitsAfter = { ...leagueDeficits };
    if (leagueDeficitsAfter[group] > 0 && rosterDeficits[group] > 0) leagueDeficitsAfter[group] -= 1;
    if (!reason && Object.values(deficitsAfter).reduce((sum, value) => sum + value, 0) > picksAfter) {
      reason = "This would make the minimum position requirements impossible to meet.";
    }
    if (!reason && Object.entries(deficitsAfter).some(([neededGroup, deficit]) => availableGroupCounts[neededGroup] - (neededGroup === group ? 1 : 0) < deficit)) {
      reason = `Not enough ${group} players would remain to meet the list minimum.`;
    }
    if (!reason && Object.entries(leagueDeficitsAfter).some(([neededGroup, deficit]) => availableGroupCounts[neededGroup] - (neededGroup === group ? 1 : 0) < deficit)) {
      reason = `This selection would leave too few ${neededGroup} players for league-wide list minimums.`;
    }
    eligibility[id] = reason ? { ok: false, reason, player, salary } : { ok: true, player, salary };
  }
  return eligibility;
}

export function canDraftClubResetPlayer(state, playerId, clubName = state?.userClub) {
  if (!state || state.completed || state.pickOwners[state.pickIndex] !== clubName) return { ok: false, reason: "This club is not on the clock." };
  const id = String(playerId);
  const player = state.playersById[id];
  if (!player || !state.availableIds.includes(id)) return { ok: false, reason: "That player is no longer available." };
  const eligibility = getClubResetDraftEligibility(state, clubName)[id];
  if (eligibility) return eligibility;
  const status = getClubResetDraftStatus(state, clubName);
  if (status.rostered >= CLUB_RESET_ROSTER_SIZE) return { ok: false, reason: "The club has filled its 44-player list." };
  const salary = Number(state.playerContracts[id]?.salary ?? player.contract?.salary ?? state.minimumSalary);
  return { ok: true, player, salary };
}

export function selectClubResetPlayer(state, playerId) {
  const club = state?.pickOwners?.[state.pickIndex];
  const validation = canDraftClubResetPlayer(state, playerId, club);
  if (!validation.ok) return { state, error: validation.reason };
  const id = String(playerId);
  const player = validation.player;
  const playerContracts = { ...state.playerContracts, [id]: { ...state.playerContracts[id], club } };
  const next = {
    ...state,
    playerContracts,
    availableIds: state.availableIds.filter(candidateId => candidateId !== id),
    rosters: { ...state.rosters, [club]: [...state.rosters[club], id] },
    payroll: { ...state.payroll, [club]: state.payroll[club] + validation.salary },
    picks: [...state.picks, { year: state.seasonYear - 1, pick: state.pickIndex + 1, club, playerId: id, playerName: player.name, position: resetDraftPositionGroup(player), positions: player.positions, overall: player.overall, potential: player.development?.potential ?? player.potential, rank: player.draftRank ?? null, juniorClub: player.juniorClub ?? null, salary: validation.salary }],
    pickIndex: state.pickIndex + 1,
  };
  next.completed = next.pickIndex >= next.totalPicks || Object.values(next.rosters).every(roster => roster.length >= CLUB_RESET_ROSTER_SIZE);
  return { state: next, error: null };
}

function bestAIPlayer(state, clubName) {
  const status = getClubResetDraftStatus(state, clubName);
  const counts = status.counts;
  const eligibility = getClubResetDraftEligibility(state, clubName);
  const candidates = state.availableIds.map(id => eligibility[id]?.ok ? state.playersById[id] : null).filter(Boolean);
  const averageRemainingBudget = status.remainingCap / Math.max(1, status.remainingPicks);
  const positionShare = { DEF: 0.30, MID: 0.36, FWD: 0.27, RUC: 0.07 };
  const score = player => {
    const group = resetDraftPositionGroup(player);
    const overall = Number(player.overall ?? 50);
    const potential = Number(player.development?.potential ?? player.potential ?? overall);
    const salary = Number(state.playerContracts[String(player.id)]?.salary ?? player.contract?.salary ?? state.minimumSalary);
    const age = Number(player.age ?? 26);
    const minimumGap = Math.max(0, CLUB_RESET_POSITION_MINIMUMS[group] - counts[group]);
    const positionGap = Math.max(0, Math.ceil((status.rostered + 1) * positionShare[group]) - counts[group]);
    // The salary cap is enforced by eligibility. Its ranking penalty should only
    // separate similarly rated players, rather than make stars go undrafted.
    const salaryPremium = Math.max(0, salary - state.minimumSalary) / 250_000;
    const budgetPressure = status.rostered / CLUB_RESET_ROSTER_SIZE;
    const capPenalty = salaryPremium * (0.65 + budgetPressure * 0.55)
      + Math.max(0, salary / Math.max(1, averageRemainingBudget) - 1) * budgetPressure * 1.5;
    const ageBonus = age <= 24 ? Math.min(2.5, (25 - age) * 0.35) : age >= 31 ? -Math.min(3, (age - 30) * 0.6) : 0;
    const needBonus = (minimumGap > 0 ? 1.2 : 0) + Math.min(2, positionGap) * 1.4;
    return overall + Math.max(0, potential - overall) * 0.18 + ageBonus + needBonus - capPenalty;
  };
  candidates.sort((a, b) => {
    return score(b) - score(a) || String(a.name).localeCompare(String(b.name));
  });
  return candidates[0] ?? null;
}

export function advanceClubResetDraftToUser(input) {
  let state = input;
  while (state && !state.completed) {
    const club = state.pickOwners[state.pickIndex];
    if (!club) return { ...state, completed: true };
    if (remainingForClub(state, club) <= 0) {
      state = { ...state, pickIndex: state.pickIndex + 1, picks: [...state.picks, { year: state.seasonYear - 1, pick: state.pickIndex + 1, club, passed: true }] };
      if (state.pickIndex >= state.totalPicks) state.completed = true;
      continue;
    }
    if (club === state.userClub) return state;
    const availableChoice = bestAIPlayer(state, club);
    if (!availableChoice) {
      state = { ...state, pickIndex: state.pickIndex + 1, picks: [...state.picks, { year: state.seasonYear - 1, pick: state.pickIndex + 1, club, passed: true }] };
      if (state.pickIndex >= state.totalPicks) state.completed = true;
      continue;
    }
    const result = selectClubResetPlayer(state, availableChoice.id);
    if (result.error) return state;
    state = result.state;
  }
  return state;
}

export function autofillClubResetDraft(input, maxUserPicks = Infinity) {
  let state = advanceClubResetDraftToUser(input);
  let filled = 0;
  while (state && !state.completed && filled < maxUserPicks) {
    if (state.pickOwners[state.pickIndex] !== state.userClub) {
      return { state, error: "The draft could not advance to your next selection." };
    }
    const choice = bestAIPlayer(state, state.userClub);
    if (!choice) {
      return { state, error: "No eligible player can complete your list within the salary cap and position minimums." };
    }
    const result = selectClubResetPlayer(state, choice.id);
    if (result.error) return result;
    state = advanceClubResetDraftToUser(result.state);
    filled += 1;
  }
  return { state, error: null, filled };
}
