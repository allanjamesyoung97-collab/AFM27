import { getClubBestTeam } from "./clubStrengthEngine.js";
import { getCareerClub } from "./contractEngine.js";

const FIRST_NAMES = ["Alex", "Ben", "Callum", "Daniel", "Elliot", "Grant", "Jack", "Liam", "Mark", "Nathan", "Patrick", "Ryan", "Sam", "Tom"];
const LAST_NAMES = ["Anderson", "Bennett", "Carter", "Dawson", "Ellis", "Fletcher", "Gibson", "Harrison", "Kelly", "Mitchell", "Reid", "Sullivan", "Turner", "Watson"];

function coachName(clubName, seasonYear, sequence = 0) {
  const seed = [...`${clubName}:${seasonYear}:${sequence}`].reduce((value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0, 17);
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length]}`;
}

export function getJobMarket(market = {}, clubs = [], managerClubName = null, seasonYear = 2027) {
  return {
    vacancies: market.vacancies ?? [],
    history: market.history ?? [],
    applications: market.applications ?? [],
    coaches: market.coaches ?? Object.fromEntries(clubs.map(club => [club.name, club.name === managerClubName ? "You" : coachName(club.name, seasonYear)])),
    userStatus: market.userStatus ?? "EMPLOYED",
    dismissedFrom: market.dismissedFrom ?? null,
    dismissedSeason: market.dismissedSeason ?? null,
    guaranteedVacancyClub: market.guaranteedVacancyClub ?? null,
    lastUserReviewScore: market.lastUserReviewScore ?? null,
    lastReviewedSeason: market.lastReviewedSeason ?? null,
    midseasonReviewSeason: market.midseasonReviewSeason ?? null,
    lastMidseasonReviewRound: market.lastMidseasonReviewRound ?? 0,
    midseasonPoorRounds: market.midseasonPoorRounds ?? {},
    midseasonDismissedClubs: market.midseasonDismissedClubs ?? [],
  };
}

export function reviewCoachingJobs({ market, clubs = [], players = [], contracts = {}, ladder = [], reviews = {}, managerClubName, seasonYear, date }) {
  const current = getJobMarket(market, clubs, managerClubName, seasonYear);
  if (Number(current.lastReviewedSeason) === Number(seasonYear) || !ladder.length) return current;
  const strengths = clubs.map(club => ({
    name: club.name,
    overall: Number(getClubBestTeam(players.filter(player => getCareerClub(player, contracts) === club.name)).bestTeamOverall ?? 65),
  })).sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
  const expectedRanks = new Map(strengths.map((entry, index) => [entry.name, index + 1]));
  const actualRanks = new Map(ladder.map((entry, index) => [entry.club, index + 1]));
  const vacancies = [...current.vacancies];
  const history = [...current.history];
  const coaches = { ...current.coaches };
  let userStatus = current.userStatus;
  let dismissedFrom = current.dismissedFrom;
  let lastUserReviewScore = current.lastUserReviewScore;
  const assessments = [];

  for (const club of clubs) {
    const actual = actualRanks.get(club.name);
    if (!actual) continue;
    const expected = expectedRanks.get(club.name) ?? Math.ceil(clubs.length / 2);
    const gap = actual - expected;
    const score = Number(reviews[club.name]?.score ?? 60);
    const isUserClub = club.name === managerClubName && userStatus === "EMPLOYED";
    if (isUserClub) lastUserReviewScore = score;
    const ladderTarget = Number(reviews[club.name]?.objectives?.find(objective => objective.type === "LADDER")?.target ?? expected);
    const poorReview = gap >= 3 && actual - ladderTarget >= 4 && score < (isUserClub ? 68 : 66);
    if (poorReview && !current.midseasonDismissedClubs.includes(club.name)
      && !vacancies.some(vacancy => vacancy.club === club.name && vacancy.status === "OPEN")) {
      assessments.push({ club: club.name, actual, expected, score, isUserClub });
    }
  }

  // Fill genuinely justified AI vacancies first. Never sack a healthy club's
  // coach simply to manufacture a job for the player.
  for (const item of assessments.filter(entry => !entry.isUserClub)) {
    const departingCoach = coaches[item.club] ?? coachName(item.club, seasonYear);
    coaches[item.club] = null;
    vacancies.push({ id: `coach-vacancy:${seasonYear}:${item.club}`, club: item.club, status: "OPEN", openedOn: date, seasonYear,
      expectedFinish: item.expected, actualFinish: item.actual, boardScore: item.score, departedCoach: departingCoach,
      reason: `Finished ${item.actual}${ordinal(item.actual)} after projecting ${item.expected}${ordinal(item.expected)}; board review ${item.score}/100.` });
    history.push({ id: `coach-sacked:${seasonYear}:${item.club}`, type: "SACKED", club: item.club, coach: departingCoach, date, seasonYear });
  }
  const userAssessment = assessments.find(entry => entry.isUserClub);
  const availableRole = vacancies.filter(vacancy => vacancy.status === "OPEN" && vacancy.club !== managerClubName)
    .sort((a, b) => Number(b.actualFinish ?? 0) - Number(a.actualFinish ?? 0))[0];
  if (userAssessment && availableRole) {
    const departingCoach = coaches[userAssessment.club] ?? "You";
    coaches[userAssessment.club] = null;
    vacancies.push({ id: `coach-vacancy:${seasonYear}:${userAssessment.club}`, club: userAssessment.club, status: "OPEN", openedOn: date, seasonYear,
      expectedFinish: userAssessment.expected, actualFinish: userAssessment.actual, boardScore: userAssessment.score, departedCoach: departingCoach,
      reason: `Finished ${userAssessment.actual}${ordinal(userAssessment.actual)} after projecting ${userAssessment.expected}${ordinal(userAssessment.expected)}; board review ${userAssessment.score}/100.` });
    history.push({ id: `coach-sacked:${seasonYear}:${userAssessment.club}`, type: "SACKED", club: userAssessment.club, coach: departingCoach, date, seasonYear });
    userStatus = "UNEMPLOYED";
    dismissedFrom = userAssessment.club;
  }
  return { ...current, vacancies, history, coaches, userStatus, dismissedFrom, dismissedSeason: userStatus === "UNEMPLOYED" ? seasonYear : current.dismissedSeason,
    guaranteedVacancyClub: userStatus === "UNEMPLOYED" ? availableRole?.club ?? null : current.guaranteedVacancyClub, lastUserReviewScore, lastReviewedSeason: seasonYear };
}

export function reviewCoachingJobsDuringSeason({ market, clubs = [], players = [], contracts = {}, ladder = [], reviews = {}, roundHistory = [], managerClubName, seasonYear, date }) {
  const current = getJobMarket(market, clubs, managerClubName, seasonYear);
  const completedRound = Math.max(0, ...roundHistory.map(entry => Number(entry.round) || 0));
  if (completedRound < 7 || ladder.length < clubs.length) return current;
  const sameSeason = Number(current.midseasonReviewSeason) === Number(seasonYear);
  if (sameSeason && completedRound <= Number(current.lastMidseasonReviewRound)) return current;
  const strengths = clubs.map(club => ({
    name: club.name,
    overall: Number(getClubBestTeam(players.filter(player => getCareerClub(player, contracts) === club.name)).bestTeamOverall ?? 65),
  })).sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
  const expectedRanks = new Map(strengths.map((entry, index) => [entry.name, index + 1]));
  const actualRanks = new Map(ladder.map((entry, index) => [entry.club, index + 1]));
  const vacancies = [...current.vacancies];
  const history = [...current.history];
  const coaches = { ...current.coaches };
  const poorRounds = sameSeason ? { ...current.midseasonPoorRounds } : {};
  const dismissedClubs = new Set(sameSeason ? current.midseasonDismissedClubs : []);
  const candidates = [];
  let lastUserReviewScore = current.lastUserReviewScore;

  for (const club of clubs) {
    const actual = actualRanks.get(club.name);
    if (!actual) continue;
    const expected = expectedRanks.get(club.name) ?? Math.ceil(clubs.length / 2);
    const board = reviews[club.name] ?? {};
    const score = Number(board.score ?? 60);
    const isUserClub = club.name === managerClubName && current.userStatus === "EMPLOYED";
    if (isUserClub) lastUserReviewScore = score;
    const ladderTarget = Number(board.objectives?.find(objective => objective.type === "LADDER")?.target ?? expected);
    const results = roundHistory.flatMap(entry => entry.results ?? [])
      .filter(result => result.homeTeam === club.name || result.awayTeam === club.name)
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")) || Number(a.round ?? 0) - Number(b.round ?? 0));
    const recent = results.slice(-6);
    const recentWins = recent.filter(result => result.winner === club.name).length;
    // The coach must be well below both the squad's ranking and the board's
    // explicit ladder objective, with a prolonged losing run and poor review.
    const veryPoor = actual - expected >= 4 && actual - ladderTarget >= 5 && actual >= 10
      && recent.length >= 6 && recentWins <= 1 && score <= 72;
    poorRounds[club.name] = veryPoor ? Number(poorRounds[club.name] ?? 0) + 1 : 0;
    if (poorRounds[club.name] < 3 || dismissedClubs.has(club.name)
      || vacancies.some(vacancy => vacancy.club === club.name && vacancy.status === "OPEN")) continue;
    candidates.push({ club: club.name, actual, expected, ladderTarget, score, isUserClub });
  }

  for (const item of candidates.filter(entry => !entry.isUserClub)) {
    const departingCoach = coaches[item.club] ?? coachName(item.club, seasonYear);
    coaches[item.club] = null;
    vacancies.push({ id: `coach-vacancy:${seasonYear}:${item.club}:${date}`, club: item.club, status: "OPEN", openedOn: date, seasonYear,
      expectedFinish: item.expected, actualFinish: item.actual, boardScore: item.score, departedCoach: departingCoach,
      reason: `Sits ${item.actual}${ordinal(item.actual)} against a top-${item.ladderTarget} objective; board review ${item.score}/100.` });
    history.push({ id: `coach-sacked:${seasonYear}:${item.club}:${date}`, type: "SACKED", club: item.club, coach: departingCoach, date, seasonYear });
    dismissedClubs.add(item.club);
  }
  const userAssessment = candidates.find(entry => entry.isUserClub);
  const availableRole = vacancies.filter(vacancy => vacancy.status === "OPEN" && vacancy.club !== managerClubName)
    .sort((a, b) => Number(b.actualFinish ?? 0) - Number(a.actualFinish ?? 0))[0];
  let userStatus = current.userStatus;
  let dismissedFrom = current.dismissedFrom;
  if (userAssessment && availableRole) {
    coaches[userAssessment.club] = null;
    vacancies.push({ id: `coach-vacancy:${seasonYear}:${userAssessment.club}:${date}`, club: userAssessment.club, status: "OPEN", openedOn: date, seasonYear,
      expectedFinish: userAssessment.expected, actualFinish: userAssessment.actual, boardScore: userAssessment.score, departedCoach: "You",
      reason: `Sits ${userAssessment.actual}${ordinal(userAssessment.actual)} against a top-${userAssessment.ladderTarget} objective; board review ${userAssessment.score}/100.` });
    history.push({ id: `coach-sacked:${seasonYear}:${userAssessment.club}:${date}`, type: "SACKED", club: userAssessment.club, coach: "You", date, seasonYear });
    dismissedClubs.add(userAssessment.club);
    userStatus = "UNEMPLOYED";
    dismissedFrom = userAssessment.club;
  }
  return { ...current, vacancies, history, coaches, userStatus, dismissedFrom, dismissedSeason: userStatus === "UNEMPLOYED" ? seasonYear : current.dismissedSeason,
    guaranteedVacancyClub: userStatus === "UNEMPLOYED" ? availableRole?.club ?? null : current.guaranteedVacancyClub,
    lastUserReviewScore, midseasonReviewSeason: seasonYear, lastMidseasonReviewRound: completedRound,
    midseasonPoorRounds: poorRounds, midseasonDismissedClubs: [...dismissedClubs] };
}

function ordinal(value) {
  if (value % 100 >= 11 && value % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" })[value % 10] ?? "th";
}

export function applyForCoachingJob(market, clubName, managerClubName, seasonYear, date) {
  const vacancy = market?.vacancies?.find(item => item.club === clubName && item.status === "OPEN");
  if (!vacancy) return { accepted: false, error: "This position is no longer vacant.", market };
  if (market.userStatus === "EMPLOYED" && clubName === managerClubName) return { accepted: false, error: "You already coach this club.", market };
  if (market.dismissedFrom === clubName && Number(vacancy.seasonYear) === Number(seasonYear)) {
    return { accepted: false, error: "The club that dismissed you will not reconsider this season.", market };
  }
  if ((market.applications ?? []).some(application => application.club === clubName && application.vacancyId === vacancy.id)) {
    return { accepted: false, error: "You have already applied for this vacancy.", market };
  }
  const score = Number(market.lastUserReviewScore ?? 60);
  const threshold = vacancy.expectedFinish <= 4 ? 70 : vacancy.expectedFinish <= 8 ? 60 : vacancy.expectedFinish <= 12 ? 48 : 38;
  const accepted = clubName === market.guaranteedVacancyClub && market.userStatus === "UNEMPLOYED" || score >= threshold;
  const application = { id: `job-application:${seasonYear}:${clubName}`, vacancyId: vacancy.id, club: clubName, date, accepted,
    reason: accepted ? "The board has offered you the role." : `The board wants a stronger recent record (review ${score}/100; target ${threshold}/100).` };
  if (!accepted) return { accepted: false, error: application.reason, market: { ...market, applications: [...(market.applications ?? []), application] } };
  const fromClub = market.userStatus === "EMPLOYED" ? managerClubName : null;
  const vacancies = market.vacancies.map(item => item.id === vacancy.id ? { ...item, status: "FILLED", filledOn: date, appointedCoach: "You" } : item);
  const history = [...(market.history ?? []), { id: `coach-appointed:${seasonYear}:${clubName}`, type: "APPOINTED", club: clubName, coach: "You", date, seasonYear }];
  const coaches = { ...market.coaches, [clubName]: "You" };
  if (fromClub && fromClub !== clubName) {
    coaches[fromClub] = null;
    vacancies.push({ id: `coach-vacancy:${seasonYear}:${fromClub}:${date}`, club: fromClub, status: "OPEN", openedOn: date, seasonYear,
      expectedFinish: null, actualFinish: null, boardScore: null, departedCoach: "You", reason: "The manager accepted a role at another club." });
    history.push({ id: `coach-departed:${seasonYear}:${fromClub}:${date}`, type: "DEPARTED", club: fromClub, coach: "You", date, seasonYear });
  }
  return { accepted: true, error: null, market: { ...market, vacancies, history, coaches, applications: [...(market.applications ?? []), application], userStatus: "EMPLOYED", guaranteedVacancyClub: null }, fromClub, toClub: clubName };
}

export function advanceJobMarketDay(market, date, seasonYear) {
  if (!market?.vacancies?.some(vacancy => vacancy.status === "OPEN")) return market;
  const vacancies = [...market.vacancies];
  const coaches = { ...(market.coaches ?? {}) };
  const history = [...(market.history ?? [])];
  let changed = false;
  for (let index = 0; index < vacancies.length; index += 1) {
    const vacancy = vacancies[index];
    if (vacancy.status !== "OPEN" || (market.userStatus === "UNEMPLOYED" && vacancy.club === market.guaranteedVacancyClub)) continue;
    const elapsed = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${vacancy.openedOn}T00:00:00Z`)) / 86_400_000;
    if (elapsed < 21) continue;
    const appointedCoach = coachName(vacancy.club, seasonYear, history.length + index + 1);
    vacancies[index] = { ...vacancy, status: "FILLED", filledOn: date, appointedCoach };
    coaches[vacancy.club] = appointedCoach;
    history.push({ id: `coach-appointed:${date}:${vacancy.club}`, type: "APPOINTED", club: vacancy.club, coach: appointedCoach, date, seasonYear });
    changed = true;
  }
  return changed ? { ...market, vacancies, coaches, history } : market;
}
