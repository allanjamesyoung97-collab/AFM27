import {
  breakPromise,
  defaultRoleForPlayer,
  evaluateFreeAgency,
  fulfillPromise,
  inferCareerStageKey,
} from "./negotiationEngine.js";
import { getEconomyFactor, getSalaryCap } from "./salaryCap.js";
import { clubs } from "../data/clubs.js";
import { gamesForPlayerInSeason, normalizeContractComponents } from "./contractComponents.js";

// ---------------------------------------------------------------------------
// State shape
//
// playerContracts[playerId] is one record per player:
//   contract TERMS   salary (this season), yearlySalaries, yearsRemaining, role, promises, signedSeason
//   mood             { leaveDesireDelta, relationshipDelta, promiseHistory }
//   negotiation      per-season negotiation bookkeeping (rounds, cooldown, counter-offer)
//   bookkeeping      lastAdvancedSeason, expiryResolvedSeason, ...
// getCareerContract() exposes ONLY the terms, so mood and negotiation never leak into
// player.contract. Older saves stored leaveDesire / interestedClubs flat on the record;
// getPlayerMood() still reads those.
// ---------------------------------------------------------------------------

export const CONTRACT_STATUS = {
  UNKNOWN: "UNKNOWN",
  UNDER_CONTRACT: "UNDER_CONTRACT",
  FINAL_YEAR: "FINAL_YEAR",
  OUT_OF_CONTRACT: "OUT_OF_CONTRACT",
};

// salary is what the player is paid THIS season; yearlySalaries (this season first) holds the
// whole structured deal. See contractStructure.js.
const CONTRACT_TERM_KEYS = ["salary", "yearsRemaining", "yearlySalaries", "role", "promises", "signedSeason", "club", "matchPayments", "performanceIncentives", "triggerClause", "triggerGamesPreviousSeason", "triggerStartSeason", "conditionalBaselineSeason", "conditionalBaselineGames", "conditionalBonusStartSeason"];

const isKnownYears = (years) => years !== null && years !== undefined && Number.isFinite(Number(years));

/** Display a contract against its end-of-October expiry, without changing stored season terms. */
export function formatContractDuration(yearsRemaining, { currentDate, seasonYear } = {}) {
  if (!isKnownYears(yearsRemaining)) return "Contract term unknown";
  const years = Number(yearsRemaining);
  if (years <= 0) return "Out of contract";

  const date = currentDate instanceof Date
    ? currentDate
    : currentDate ? new Date(currentDate) : null;
  const referenceYear = Number(seasonYear) || (date && !Number.isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear());
  const safeDate = date && !Number.isNaN(date.getTime()) ? date : new Date(referenceYear, 2, 1);
  const expiryYear = referenceYear + Math.ceil(years) - 1;
  const calendarMonths = (expiryYear - safeDate.getFullYear()) * 12 + (9 - safeDate.getMonth());
  // Count the current month when already in the active season: March to an
  // end-of-October expiry is eight displayed months. Preseason starts in the
  // prior October, where the month difference already gives a full year.
  const months = Math.max(0, calendarMonths + (safeDate.getFullYear() >= referenceYear ? 1 : 0));
  if (months <= 12) return `${months} month${months === 1 ? "" : "s"} remaining`;
  const remainingYears = months / 12;
  const displayYears = Number.isInteger(remainingYears) ? String(remainingYears) : remainingYears.toFixed(1);
  return `${displayYears} year${remainingYears === 1 ? "" : "s"} remaining`;
}

// null yearsRemaining means the source data has no known contract end date.
export function getContractStatus(contract) {
  const years = contract?.yearsRemaining;
  if (!isKnownYears(years)) return CONTRACT_STATUS.UNKNOWN;
  if (Number(years) <= 0) return CONTRACT_STATUS.OUT_OF_CONTRACT;
  if (Number(years) === 1) return CONTRACT_STATUS.FINAL_YEAR;
  return CONTRACT_STATUS.UNDER_CONTRACT;
}

export function getCareerContract(player, contractsByPlayer = {}) {
  const saved = contractsByPlayer?.[player.id] ?? contractsByPlayer?.[String(player.id)] ?? {};
  const terms = {};
  CONTRACT_TERM_KEYS.forEach((key) => {
    if (saved[key] !== undefined) terms[key] = saved[key];
  });
  return {
    ...(player.contract ?? {}),
    ...terms,
    yearsRemaining: saved.yearsRemaining ?? player.contract?.yearsRemaining ?? null,
  };
}

// Resolves a player's effective club from the contract record, falling back to the
// static player data. When a player is traded or signed as a free agent, the new club
// is stored on the contract record so the static player list never needs to mutate.
export function getCareerClub(player, contractsByPlayer = {}) {
  const saved = contractsByPlayer?.[player.id] ?? contractsByPlayer?.[String(player.id)] ?? {};
  if (saved.delisted || saved.retired) return null;
  if (Object.prototype.hasOwnProperty.call(saved, "club")) return saved.club;
  return saved.club ?? player.club;
}

export function getPlayerMood(record = {}) {
  const mood = record.mood ?? {};
  return {
    leaveDesireDelta: mood.leaveDesireDelta ?? record.leaveDesireDelta ?? null,
    relationshipDelta: mood.relationshipDelta ?? {},
    promiseHistory: mood.promiseHistory ?? [],
    interestedClubs: mood.interestedClubs ?? record.interestedClubs ?? 1,
  };
}

// The one place records are written. Terms go on the record, mood goes under `mood`.
// Legacy flat mood fields are removed only when a new mood is supplied (which already
// folds them in), so nothing is lost by a write that does not touch mood.
export function updateContractRecord(record = {}, { terms = {}, mood, negotiation } = {}) {
  const next = { ...record, ...terms };
  if (mood) {
    next.mood = mood;
    delete next.leaveDesire;
    delete next.leaveDesireDelta;
    delete next.interestedClubs;
  }
  if (negotiation !== undefined) next.negotiation = negotiation;
  return next;
}

// ---------------------------------------------------------------------------
// Season rollover
// ---------------------------------------------------------------------------

export function advancePlayerContracts(players, contractsByPlayer = {}, completedSeason, seasonState = null) {
  const nextContracts = { ...contractsByPlayer };
  const season = Number(completedSeason);

  players.forEach((player) => {
    const key = String(player.id);
    const previous = contractsByPlayer[key] ?? contractsByPlayer[player.id] ?? {};
    const yearsRemaining = previous.yearsRemaining ?? player.contract?.yearsRemaining;
    if (Number(previous.lastAdvancedSeason) >= season || Number(previous.signedSeason ?? 0) > season) return;

    const moodDelta = Number(previous.mood?.leaveDesireDelta);
    const hasMoodDelta = Number.isFinite(moodDelta) && moodDelta !== 0;
    // Nothing to advance: unknown end date and no mood to settle.
    if (!isKnownYears(yearsRemaining) && !hasMoodDelta) return;

    const next = { ...previous, lastAdvancedSeason: season };
    if (Array.isArray(previous.formerClubLiability?.yearlySalaries)) {
      next.formerClubLiability = { ...previous.formerClubLiability,
        yearlySalaries: previous.formerClubLiability.yearlySalaries.slice(1) };
    }
    if (isKnownYears(yearsRemaining)) {
      next.yearsRemaining = Math.max(0, Number(yearsRemaining) - 1);
      if (next.yearsRemaining === 0) next.freeAgentResolved = false;
      // A structured deal moves on a season: next year's pay becomes this year's salary.
      if (Array.isArray(previous.yearlySalaries) && previous.yearlySalaries.length) {
        next.yearlySalaries = previous.yearlySalaries.slice(1);
        if (next.yearlySalaries.length) next.salary = next.yearlySalaries[0];
      }
      const trigger = normalizeContractComponents(previous).triggerClause;
      if (seasonState && trigger.gamesAcrossTwoSeasons > 0 && !previous.triggerActivated
        && season >= Number(previous.triggerStartSeason ?? 0)) {
        const games = gamesForPlayerInSeason(seasonState, player.id, season);
        const priorGames = Number(previous.triggerGamesPreviousSeason ?? 0);
        const seasons = Number(previous.triggerSeasonsCount ?? 0) + 1;
        if (seasons >= 2 && priorGames + games >= trigger.gamesAcrossTwoSeasons) {
          next.yearsRemaining += 1;
          next.yearlySalaries = [...(next.yearlySalaries ?? []), Number(next.yearlySalaries?.at(-1) ?? next.salary ?? 0)];
          next.triggerActivated = true;
        }
        next.triggerGamesPreviousSeason = games;
        next.triggerSeasonsCount = seasons;
      }
    }
    // Grudges and goodwill fade: half of any stored leave-desire delta each season.
    if (hasMoodDelta) next.mood = { ...previous.mood, leaveDesireDelta: Math.round(moodDelta * 0.5) };
    nextContracts[key] = next;
  });

  return nextContracts;
}

// Stable pseudo-random number in [0, 1) from any key, so rollover results are the
// same however many times they are recomputed.
function hashUnit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

const roundTo = (value, step) => Math.round(value / step) * step;

// How many of the club's best players (by overall) a promise implies he must be among.
const PROMISE_RANK_LIMITS = {
  BEST_22_GUARANTEE: 22,
  MIDFIELD_ROLE: 18,
  FORWARD_LINE_ROLE: 18,
  KEY_DEFENDER_DEV: 18,
  LEADERSHIP_ROLE: 18,
  CAPTAINCY_PATHWAY: 10,
};

// Settles promises whose due season has arrived. Selection data is not available here,
// so a promise counts as kept when the player ranks inside the group of players the
// promise implies (see PROMISE_RANK_LIMITS). Replace the rank test with real selection
// data when it is exposed.
export function resolveContractPromises({ players, contractsByPlayer = {}, seasonYear }) {
  const season = Number(seasonYear);
  const contracts = { ...contractsByPlayer };
  const results = [];
  const rankByPlayer = new Map();
  const byClub = new Map();
  players.forEach((player) => {
    if (!byClub.has(player.club)) byClub.set(player.club, []);
    byClub.get(player.club).push(player);
  });
  byClub.forEach((list) => {
    [...list].sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).forEach((player, index) => rankByPlayer.set(String(player.id), index + 1));
  });

  players.forEach((player) => {
    const key = String(player.id);
    const record = contracts[key];
    const active = (record?.promises ?? []).filter((promise) => promise.status === "ACTIVE" && promise.dueSeason !== null && Number(promise.dueSeason) <= season);
    if (!active.length) return;

    let promises = record.promises;
    let mood = { ...(record.mood ?? {}) };
    let delta = Number(mood.leaveDesireDelta ?? 0);
    const relationshipDelta = { ...(mood.relationshipDelta ?? {}) };
    const promiseHistory = [...(mood.promiseHistory ?? [])];

    active.forEach((promise) => {
      const kept = (rankByPlayer.get(key) ?? 99) <= (PROMISE_RANK_LIMITS[promise.id] ?? 22);
      const view = { ...player, contract: { promises } };
      const outcome = kept
        ? fulfillPromise(view, promise.id, { seasonYear: season, round: null })
        : breakPromise(view, promise.id, { seasonYear: season, round: null });
      promises = outcome.promises;
      promiseHistory.push(...outcome.promiseHistory);
      delta += outcome.leaveDesireImpact;
      Object.entries(outcome.relationshipDelta).forEach(([name, change]) => {
        relationshipDelta[name] = Number(relationshipDelta[name] ?? 0) + change;
      });
      results.push({ playerId: player.id, name: player.name, promiseId: promise.id, status: kept ? "FULFILLED" : "BROKEN", moraleImpact: Number(outcome.moraleImpact ?? 0) });
    });

    mood = { ...mood, leaveDesireDelta: Math.max(-100, Math.min(100, Math.round(delta))), relationshipDelta, promiseHistory };
    contracts[key] = { ...record, promises, mood };
  });

  return { contracts, results };
}

function extensionYears(player, seasonYear) {
  const age = Number(player.age ?? 25);
  const base = age <= 29 ? 3 : age <= 32 ? 2 : 1;
  return base + (hashUnit(`${player.id}:${seasonYear}:ext`) > 0.6 && age <= 30 ? 1 : 0);
}

// Rival salaries are anchored on the player's current deal (not on market value): the
// league's contracts are generated to fit the salary cap and sit well below market
// value, so market-value rivals would win every free agency.
function rivalOffers(player, userClubName, seasonYear, currentSalary) {
  const age = Number(player.age ?? 25);
  const stage = inferCareerStageKey(age);
  const years = stage === "VETERAN" ? 2 : stage === "YOUNG_PROSPECT" ? 3 : 4;
  return clubs
    .filter((club) => club.name !== userClubName)
    .map((club) => ({ club, order: hashUnit(`${player.id}:${club.name}:${seasonYear}:rival`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 4)
    .map(({ club }) => ({
      clubName: club.name,
      salary: roundTo(currentSalary * (0.95 + 0.25 * hashUnit(`${player.id}:${club.name}:${seasonYear}:pay`)), 5000),
      years,
      role: defaultRoleForPlayer(player),
      promises: [],
    }));
}

// Contracts at 0 years are resolved here instead of sitting at 0 forever.
//   Other clubs: extend the player on his existing salary (they have no cap model).
//   The user's club: run free agency. The club offers the player's current salary for
//   two years against four rival offers of 95-120% of that salary, scored by evaluateFreeAgency
//   with the club's live context (coach, ladder, reputation, facilities).
//     - club wins            -> re-signed on current terms for 2 years
//     - a rival scores higher -> kept on a 1-year deal at a premium, if the cap allows
//                                (otherwise on current salary), and his mood worsens.
// Players do not physically leave: rosters are built from static player data in many
// screens. The result keeps the winning rival in the report so a transfer layer can use it.
export function resolveExpiredContracts({ players, contractsByPlayer = {}, userClubName, seasonYear, userClubContext = null }) {
  const season = Number(seasonYear);
  const contracts = { ...contractsByPlayer };
  const report = { seasonYear: season, extended: 0, freeAgency: [] };

  const salaryOf = (player) => Number(contracts[String(player.id)]?.salary ?? player.contract?.salary ?? 0);
  const expired = players.filter((player) => {
    const record = contracts[String(player.id)] ?? {};
    const years = record.yearsRemaining ?? player.contract?.yearsRemaining;
    return !record.delisted && !record.retired
      && isKnownYears(years) && Number(years) === 0
      && Number(record.expiryResolvedSeason) !== season;
  });

  // Other clubs first.
  expired.filter((player) => player.club !== userClubName).forEach((player) => {
    const key = String(player.id);
    const record = contracts[key] ?? {};
    contracts[key] = {
      ...record,
      salary: record.salary ?? player.contract?.salary,
      yearsRemaining: extensionYears(player, season),
      expiryResolvedSeason: season,
    };
    report.extended += 1;
  });

  // The user's club: best players decide first so the cap is spent on them.
  // The contracts being decided run from the NEXT season, so the cap that applies is next season's.
  const nextSeasonCap = getSalaryCap(season + 1);
  let payroll = players.filter((player) => player.club === userClubName).reduce((sum, player) => sum + salaryOf(player), 0);
  expired
    .filter((player) => player.club === userClubName)
    .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0))
    .forEach((player) => {
      const key = String(player.id);
      const record = contracts[key] ?? {};
      const currentSalary = salaryOf(player);
      // The club's standing offer keeps the player's share of a cap that grows each season
      // (so about +5%), as long as it fits under next season's cap.
      const raised = roundTo(currentSalary * (getEconomyFactor(season + 1) / getEconomyFactor(season)), 5000);
      const standingSalary = payroll + (raised - currentSalary) <= nextSeasonCap ? Math.max(raised, currentSalary) : currentSalary;
      const userOffer = {
        clubName: userClubName,
        salary: standingSalary,
        years: 2,
        role: defaultRoleForPlayer(player),
        promises: [],
      };
      const result = evaluateFreeAgency(
        player,
        [userOffer, ...rivalOffers(player, userClubName, season, currentSalary)],
        { deterministic: true, clubContexts: userClubContext ? { [userClubName]: userClubContext } : {} },
      );
      const userRanking = result.rankings.find((item) => item.clubName === userClubName);
      const best = result.rankings[0];
      const clubWins = best.clubName === userClubName;

      let outcome = "RE_SIGNED";
      let salary = standingSalary;
      let years = 2;
      let moodChange = 0;
      payroll += standingSalary - currentSalary;
      if (!clubWins) {
        payroll -= standingSalary - currentSalary; // undo; the rival win is priced below
        const premium = Math.max(0.03, Math.min(0.2, (best.score - userRanking.score) * 0.008));
        const premiumSalary = roundTo(Math.max(currentSalary, standingSalary) * (1 + premium), 5000);
        const increase = premiumSalary - currentSalary;
        years = 1;
        if (payroll + increase <= nextSeasonCap) {
          outcome = "RETAINED_AT_PREMIUM";
          salary = premiumSalary;
          payroll += increase;
          moodChange = 15;
        } else {
          outcome = "RETAINED_CAP_LIMITED";
          salary = standingSalary <= currentSalary ? currentSalary : currentSalary; // no room for a raise
          moodChange = 10;
        }
      }

      const mood = { ...(record.mood ?? {}) };
      if (moodChange) mood.leaveDesireDelta = Math.min(100, Number(mood.leaveDesireDelta ?? 0) + moodChange);
      contracts[key] = {
        ...record,
        salary,
        yearsRemaining: years,
        yearlySalaries: Array.from({ length: years }, () => salary),
        mood,
        expiryResolvedSeason: season,
      };
      report.freeAgency.push({
        playerId: player.id,
        name: player.name,
        outcome,
        salary,
        years,
        previousSalary: currentSalary,
        userScore: userRanking.score,
        bestRival: clubWins ? null : { clubName: best.clubName, score: best.score },
      });
    });

  return { contracts, report };
}

// One call for the app's end-of-season step: advance years, settle promises, resolve
// expiries. AI list management runs before expiry resolution and marks releases as
// delisted so they are not silently extended. completedSeason is the season that just finished.
export function runContractRollover({ players, contractsByPlayer = {}, completedSeason, seasonState = null, userClubName, userClubContext = null, beforeExpiryResolution = null }) {
  const advanced = advancePlayerContracts(players, contractsByPlayer, completedSeason, seasonState);
  const promises = resolveContractPromises({ players, contractsByPlayer: advanced, seasonYear: completedSeason });
  const preparedContracts = typeof beforeExpiryResolution === "function"
    ? (beforeExpiryResolution({ players, contractsByPlayer: promises.contracts, completedSeason, userClubName }) ?? promises.contracts)
    : promises.contracts;
  const expiries = resolveExpiredContracts({
    players,
    contractsByPlayer: preparedContracts,
    userClubName,
    seasonYear: completedSeason,
    userClubContext,
  });
  return {
    contracts: expiries.contracts,
    report: { ...expiries.report, promises: promises.results },
  };
}
