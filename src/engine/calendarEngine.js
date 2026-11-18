// Calendar Engine — generates and manages the season calendar.
// The calendar is the single source of truth for season progression.
//
// Event types:
//   MATCH        — fixture match (always a hard stop, never delegatable)
//   TRAINING     — training session (delegatable)
//   CONTRACT     — contract expiry / negotiation event
//   TRADE        — trade period event
//   DRAFT        — draft event
//   CLUB_EVENT   — general club event (AGM, awards, etc.)
//
// Each event has:
//   { id, type, date, title, description, round, mandatory, delegatable, resolved, data }

import { assistantWeeklySchedule, getTrainingCategoryById } from "../data/trainingCategories.js";
import { assistantChooseTraining } from "./trainingEngine.js";

// --- Date helpers ---

// Parse fixture date strings (e.g. "Thu, 18 Mar 2027" or "18 Mar 2027") into Date objects.
export function parseFixtureDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    // Try stripping weekday prefix: "Thu, 18 Mar 2027"
    const cleaned = value.replace(/^[A-Za-z]{3},\s*/, "");
    const retry = new Date(cleaned);
    if (Number.isNaN(retry.getTime())) return null;
    return retry;
  }
  return parsed;
}

export function formatDateForCalendar(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function getMonthLabel(year, month) {
  const date = new Date(year, month, 15);
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function datesEqual(d1, d2) {
  const a = d1 instanceof Date ? d1 : new Date(d1);
  const b = d2 instanceof Date ? d2 : new Date(d2);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// --- Event generation ---

let eventIdCounter = 0;
function nextEventId() {
  eventIdCounter += 1;
  return `evt-${eventIdCounter}`;
}

// Generate all match events from the fixture for a specific club.
export function generateMatchEvents(fixture, clubName, completedRounds = []) {
  const events = [];
  const completedRoundSet = new Set(completedRounds);
  for (const roundData of fixture) {
    for (const match of roundData.matches ?? []) {
      const home = match.homeTeam ?? match.home;
      const away = match.awayTeam ?? match.away;
      const isClubMatch = home === clubName || away === clubName;
      if (!isClubMatch) continue;

      const date = parseFixtureDate(match.date);
      events.push({
        id: `match-r${roundData.round}-${clubName}`,
        type: "MATCH",
        date,
        title: `${home} vs ${away}`,
        description: `Round ${roundData.round} · ${match.venue ?? "TBD"}`,
        round: roundData.round,
        mandatory: true,
        delegatable: false,
        resolved: completedRoundSet.has(roundData.round),
        data: { match: { ...match, round: roundData.round }, roundData },
      });
    }
  }
  return events;
}

// Generate training events between matches for a club.
// If assistantManaged, uses the default weekly schedule.
// If userManaged, uses user-specified sessions from userTrainingSchedule.
export function generateTrainingEvents(matchEvents, options = {}) {
  const {
    assistantManaged = true,
    userTrainingSchedule = [],
    players = [],
    playerFitness = {},
    startDate = new Date(2027, 2, 18),
    endDate = new Date(2027, 8, 26),
  } = options;

  const events = [];
  const matchDates = matchEvents.map((e) => e.date).filter(Boolean);

  // Walk day by day from start to end.
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dayOfWeek = cursor.getDay();
    const isMatchDay = matchDates.some((d) => datesEqual(d, cursor));

    if (isMatchDay) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    let trainingCategory = null;

    if (assistantManaged) {
      const scheduled = assistantWeeklySchedule.find((s) => s.day === dayOfWeek);
      if (scheduled) {
        const nextMatch = matchEvents
          .filter((event) => event.date && event.date >= cursor)
          .sort((a, b) => a.date - b.date)[0];
        const daysToNextMatch = nextMatch
          ? Math.max(0, Math.round((nextMatch.date - cursor) / 86400000))
          : 7;
        const categoryId = assistantChooseTraining(players, playerFitness, {
          daysToNextMatch,
          upcomingOpponentStrength: 80,
        }) ?? scheduled.categoryId;
        trainingCategory = getTrainingCategoryById(categoryId);
      }
    } else {
      // User-managed: look for a user-scheduled session on this date.
      const userSession = userTrainingSchedule.find((s) => datesEqual(s.date, cursor));
      if (userSession) {
        trainingCategory = getTrainingCategoryById(userSession.categoryId);
      }
    }

    if (trainingCategory) {
      events.push({
        id: `training-${cursor.toISOString().slice(0, 10)}`,
        type: "TRAINING",
        date: new Date(cursor),
        title: trainingCategory.name,
        description: trainingCategory.description,
        round: null,
        mandatory: false,
        delegatable: true,
        delegated: assistantManaged,
        resolved: assistantManaged, // Auto-resolved if delegated
        data: { category: trainingCategory },
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return events;
}

// Generate contract events for players whose contracts are expiring.
export function generateContractEvents(players, clubName, seasonYear) {
  const events = [];
  const clubPlayers = players.filter((p) => p.club === clubName);

  for (const player of clubPlayers) {
    const contract = player.contract ?? {};
    const yearsRemaining = contract.yearsRemaining;
    const finalYear = contract.finalYear;

    if (yearsRemaining != null && yearsRemaining <= 1) {
      // Contract expiring this season or next — create a negotiation event.
      const eventDate = new Date(seasonYear, 7, 15); // Mid-August, typical contract deadline period
      events.push({
        id: `contract-${player.id}`,
        type: "CONTRACT",
        date: eventDate,
        title: `${player.name} contract decision`,
        description: `${player.name} is ${yearsRemaining === 0 ? "out of contract" : "entering the final year"}. ${contract.status ?? ""}`.trim(),
        round: null,
        mandatory: true,
        delegatable: true,
        resolved: false,
        data: { player, contract },
      });
    }
  }

  return events;
}

// Generate trade period events.
export function generateTradeEvents(seasonYear) {
  return [
    {
      id: `trade-period-start-${seasonYear}`,
      type: "TRADE",
      date: new Date(seasonYear, 9, 5), // Early October
      title: "Trade Period Opens",
      description: "The AFL trade period has opened. Clubs can exchange players and picks.",
      round: null,
      mandatory: false,
      delegatable: true,
      resolved: false,
      data: {},
    },
    {
      id: `trade-period-end-${seasonYear}`,
      type: "TRADE",
      date: new Date(seasonYear, 9, 18),
      title: "Trade Period Closes",
      description: "Final day to complete trades for this year.",
      round: null,
      mandatory: false,
      delegatable: true,
      resolved: false,
      data: {},
    },
  ];
}

// Generate draft events.
export function generateDraftEvents(seasonYear, completed = false) {
  return [
    {
      id: `draft-${seasonYear}`,
      type: "DRAFT",
      date: new Date(seasonYear, 10, 25), // Late November
      title: "AFL Draft",
      description: "The national draft. Select the next generation of talent.",
      round: null,
      mandatory: true,
      delegatable: true,
      resolved: completed,
      data: {},
    },
  ];
}

// Generate general club events.
export function generateClubEvents(seasonYear, clubName) {
  return [
    {
      id: `season-start-${seasonYear}`,
      type: "CLUB_EVENT",
      date: new Date(seasonYear, 2, 15),
      title: "Season Launch",
      description: `${clubName} season launch and membership drive.`,
      round: null,
      mandatory: false,
      delegatable: false,
      resolved: true,
      data: {},
    },
    {
      id: `mid-season-review-${seasonYear}`,
      type: "CLUB_EVENT",
      date: new Date(seasonYear, 5, 15),
      title: "Mid-Season Review",
      description: "Board reviews the football department's performance at the midpoint.",
      round: null,
      mandatory: false,
      delegatable: false,
      resolved: false,
      data: {},
    },
    {
      id: `best-fairest-${seasonYear}`,
      type: "CLUB_EVENT",
      date: new Date(seasonYear, 8, 20),
      title: "Best & Fairest Awards",
      description: `${clubName} club champion awards night.`,
      round: null,
      mandatory: false,
      delegatable: false,
      resolved: false,
      data: {},
    },
  ];
}

// --- Master event list ---

export function generateAllCalendarEvents(options = {}) {
  const {
    fixture,
    clubName,
    players: playerList = [],
    playerFitness = {},
    seasonYear = 2027,
    assistantManagedTraining = true,
    userTrainingSchedule = [],
    delegationSettings = {},
    roundHistory = [],
    calendarYear = seasonYear,
    draftCompleted = false,
    postSeasonMatches = [],
  } = options;

  const completedRounds = roundHistory.map((entry) => entry.round);
  const matchEvents = generateMatchEvents(fixture, clubName, completedRounds);
  const postSeasonMatchEvents = postSeasonMatches
    .filter((match) => match.home === clubName || match.away === clubName)
    .map((match) => ({
      id: `match-${seasonYear}-${match.stage}-${match.code}-${clubName}`,
      type: "MATCH",
      date: parseFixtureDate(match.date),
      title: `${match.home} vs ${match.away}`,
      description: `${match.label} · Finals`,
      round: match.code,
      mandatory: true,
      delegatable: false,
      resolved: Boolean(match.resolved),
      data: { match: { ...match, homeTeam: match.home, awayTeam: match.away } },
    }));
  const trainingEvents = generateTrainingEvents(matchEvents, {
    assistantManaged: assistantManagedTraining,
    userTrainingSchedule,
    players: playerList,
    playerFitness,
    startDate: new Date(seasonYear, 2, 15),
    endDate: new Date(seasonYear, 8, 30),
  });
  const contractEvents = generateContractEvents(playerList, clubName, seasonYear);
  const tradeEvents = generateTradeEvents(calendarYear);
  const draftEvents = generateDraftEvents(calendarYear, draftCompleted);
  const clubEvents = generateClubEvents(seasonYear, clubName);

  return [...matchEvents, ...postSeasonMatchEvents, ...trainingEvents, ...contractEvents, ...tradeEvents, ...draftEvents, ...clubEvents]
    .sort((a, b) => {
      const da = a.date?.getTime?.() ?? 0;
      const db = b.date?.getTime?.() ?? 0;
      return da - db;
    });
}

// Choose the next date that should interrupt Continue according to the user's flow setting.
export function getNextProgressEvent(events, currentDate, progressionMode = "BALANCED", delegationSettings = {}) {
  const now = currentDate instanceof Date ? currentDate : parseFixtureDate(currentDate);
  if (!now) return null;
  const futureEvents = events
    .filter((event) => !event.resolved && event.date && event.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (progressionMode === "DAILY") return null;
  if (progressionMode === "OPTIMIZED") {
    return futureEvents.find((event) =>
      isMandatoryStop(event, delegationSettings) || ["TRADE", "DRAFT"].includes(event.type),
    ) ?? null;
  }
  return futureEvents.find((event) => ["MATCH", "CONTRACT", "TRADE", "DRAFT", "CLUB_EVENT"].includes(event.type)) ?? null;
}

// --- Progression logic ---

// Find the next unresolved event from a sorted event list, given a current date.
export function getNextEvent(events, currentDate) {
  const now = currentDate instanceof Date ? currentDate.getTime() : 0;
  return events
    .filter((e) => !e.resolved && (e.date?.getTime?.() ?? 0) >= now)
    .sort((a, b) => (a.date?.getTime?.() ?? 0) - (b.date?.getTime?.() ?? 0))[0] ?? null;
}

// Determine if the next event is a mandatory stop (requires user action).
// Matches are ALWAYS mandatory stops. Non-delegated events are mandatory.
export function isMandatoryStop(event, delegationSettings = {}) {
  if (!event) return false;
  if (event.type === "MATCH") return true; // Matches are never delegatable
  if (!event.mandatory) return false;
  if (event.delegatable && delegationSettings[event.type.toLowerCase()]) return false;
  if (event.delegated) return false;
  return true;
}

// Map event types to screen names for navigation.
export function getScreenForEvent(event) {
  if (!event) return "CALENDAR";
  switch (event.type) {
    case "MATCH":
      return "MATCH_DAY";
    case "TRAINING":
      return "TRAINING";
    case "CONTRACT":
      return "FINANCES";
    case "TRADE":
      return "RECRUITMENT";
    case "DRAFT":
      return "RECRUITMENT";
    case "CLUB_EVENT":
      return "CALENDAR";
    default:
      return "CALENDAR";
  }
}

// Event type styling
export const eventTypeInfo = {
  MATCH: { label: "Match", color: "#ea580c", bgColor: "#431407", icon: "stadium" },
  TRAINING: { label: "Training", color: "#3b82f6", bgColor: "#1e1b4b", icon: "whistle" },
  CONTRACT: { label: "Contract", color: "#f59e0b", bgColor: "#422006", icon: "file" },
  TRADE: { label: "Trade", color: "#8b5cf6", bgColor: "#2e1065", icon: "exchange" },
  DRAFT: { label: "Draft", color: "#22c55e", bgColor: "#052e16", icon: "list" },
  CLUB_EVENT: { label: "Club Event", color: "#64748b", bgColor: "#1e293b", icon: "calendar" },
};

export function getEventTypeInfo(type) {
  return eventTypeInfo[type] ?? eventTypeInfo.CLUB_EVENT;
}
