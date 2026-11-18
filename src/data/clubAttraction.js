// Club attraction ratings describe off-field appeal, not playing strength.

import { clubs } from "./clubs.js";
import { clubProfiles } from "./clubProfiles.js";

// Club profiles are career-start baselines. When live career data is supplied,
// current list quality, ladder position, facilities, morale and finances replace
// those baselines for the fields they can actually inform.
function buildAttractionProfile(club, context = {}) {
  const profile = clubProfiles[club.name.replace(/\s+/g, "_").toUpperCase()] ?? {};
  const prestige = profile.footballPrestige ?? 70;
  const roster = (context.allPlayers ?? context.roster ?? []).filter((player) => {
    const contracts = context.playerContracts ?? {};
    const contract = contracts[String(player.id)] ?? {};
    const currentClub = Object.prototype.hasOwnProperty.call(contract, "club") ? contract.club : player.club;
    return currentClub === club.name && !context.playerContracts?.[String(player.id)]?.retired;
  });
  const bestTeam = [...roster].sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 23);
  const listStrength = bestTeam.length
    ? Math.round(bestTeam.reduce((sum, player) => sum + Number(player.overall ?? 0), 0) / bestTeam.length)
    : null;
  const ladderEntry = (context.ladder ?? []).find((entry) => (entry.club ?? entry.name) === club.name);
  const rank = Number(context.clubContext?.ladderRank ?? context.ladderRank ?? ladderEntry?.position ?? ((context.ladder ?? []).indexOf(ladderEntry) + 1 || 0));
  const roundsPlayed = Number(context.clubContext?.roundsPlayed ?? context.roundsPlayed ?? 0);
  const ladderStrength = rank > 0 ? Math.max(25, Math.min(95, 100 - (rank - 1) * 4.2)) : null;
  const livePerformance = listStrength !== null && ladderStrength !== null
    ? listStrength * 0.55 + ladderStrength * 0.45
    : listStrength ?? ladderStrength;
  // Historical reputation and starting finances are not evidence of current
  // premiership prospects. Start neutral, then use list quality and the ladder.
  const baselineWindow = 60;
  const liveWeight = livePerformance === null ? 0 : roundsPlayed > 0
    ? Math.min(0.75, roundsPlayed / 18)
    : listStrength !== null ? 0.5 : 0;
  const premiershipWindow = Math.round(baselineWindow * (1 - liveWeight) + (livePerformance ?? baselineWindow) * liveWeight);
  const administration = context.administrationState ?? context.clubAdministration ?? {};
  const finance = context.finance ?? {};
  const cashBalance = Number(administration.cashBalance ?? finance.cashBalance ?? context.cashBalance);
  const capRoom = Number(finance.remainingCap ?? finance.capRoom);
  const salaryCap = Number(finance.salaryCap);
  const liveFinancialHealth = Number.isFinite(cashBalance) || (Number.isFinite(capRoom) && salaryCap > 0)
    ? Math.round(Math.max(0, Math.min(100,
      50 + (Number.isFinite(cashBalance) ? Math.max(-30, Math.min(30, cashBalance / 100_000)) : 0)
      + (Number.isFinite(capRoom) && salaryCap > 0 ? Math.max(-20, Math.min(20, (capRoom / salaryCap) * 20)) : 0))))
    : 70;
  const facilityValues = Object.entries(administration.facilities ?? {}).filter(([key]) => key !== "matchdayFanExperience").map(([, value]) => Number(value)).filter(Number.isFinite);
  const liveFacilities = facilityValues.length
    ? Math.round(70 + (facilityValues.reduce((sum, value) => sum + value, 0) / facilityValues.length - 2) * 8)
    : null;
  const morale = Number(context.seasonState?.clubMorale?.[club.name] ?? context.clubMorale?.[club.name]);
  const culture = Number.isFinite(morale) ? Math.round(Math.max(0, Math.min(100, morale))) : profile.boardStrength ?? 75;

  return {
    name: club.name,
    state: stateForClub(club.name),
    reputation: prestige,
    facilities: liveFacilities ?? 75,
    listStrength,
    culture,
    premiershipWindow,
    marketSize: profile.marketSize ?? 70,
    financialHealth: liveFinancialHealth,
  };
}

const stateLookup = {
  Adelaide: "SA",
  "Port Adelaide": "SA",
  Fremantle: "WA",
  "West Coast": "WA",
  Sydney: "NSW",
  GWS: "NSW",
  Brisbane: "QLD",
  "Gold Coast": "QLD",
  Geelong: "VIC",
  Carlton: "VIC",
  Collingwood: "VIC",
  Essendon: "VIC",
  Hawthorn: "VIC",
  Melbourne: "VIC",
  "North Melbourne": "VIC",
  Richmond: "VIC",
  "St Kilda": "VIC",
  "Western Bulldogs": "VIC",
};

export function stateForClub(clubName) {
  return stateLookup[clubName] ?? "VIC";
}

const attractionByClub = Object.fromEntries(
  clubs.map((club) => [club.name, buildAttractionProfile(club)])
);

// How appealing a club's city is to live in: market size plus a small lifestyle
// adjustment by state. This describes the place, not where any player was born; each
// player's own taste is added in negotiationEngine.getLocationContentment().
const stateLifestyle = { VIC: 0, NSW: 4, QLD: 6, SA: -2, WA: -1 };

export function getClubLocationAppeal(clubName) {
  const attraction = getClubAttraction(clubName);
  const appeal = 45 + (attraction.marketSize ?? 70) * 0.25 + (stateLifestyle[attraction.state] ?? 0);
  return Math.max(0, Math.min(100, Math.round(appeal)));
}

export function getClubAttraction(clubName, context = {}) {
  const club = clubs.find((item) => item.name === clubName);
  const base = attractionByClub[clubName] ?? {
      name: clubName,
      state: stateForClub(clubName),
      reputation: 70,
      facilities: 70,
      listStrength: 70,
      culture: 70,
      premiershipWindow: 60,
      marketSize: 70,
      financialHealth: 70,
    };
  if (!Object.keys(context).length) return base;
  if (context.clubContext) context = { ...context, ...context.clubContext };
  return buildAttractionProfile(club ?? { name: clubName, id: 0 }, context);
}

// Success bonus: a contender boosts attractiveness, a rebuild drags it down.
// Range roughly -12 to +20.
export function getClubSuccessBonus(clubName, context = {}) {
  const attr = getClubAttraction(clubName, context);
  const window = attr.premiershipWindow;
  if (window >= 90) return 18;
  if (window >= 80) return 10;
  if (window >= 70) return 4;
  if (window >= 60) return 0;
  if (window >= 50) return -4;
  return -10;
}

export function getAllClubAttractions() {
  return attractionByClub;
}