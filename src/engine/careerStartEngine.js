import { createClock } from './simulationClock.js';

export const CAREER_STARTS = {
AFTER_GF: { label: 'After the GF', date: '2026-10-01' },
PRESEASON: { label: 'Preseason', date: '2027-02-01' },
};

export function createCareerStartState(initialSeason, start = 'AFTER_GF', seed = `career-${Date.now()}`) {
const option = CAREER_STARTS[start] ?? CAREER_STARTS.AFTER_GF;
const preseason = start === 'PRESEASON';
return {
...initialSeason,
calendarClock: createClock(option.date, seed),
phase: preseason ? 'PRESEASON' : 'OFFSEASON',
seasonHasStarted: preseason,
offseasonStep: preseason ? 3 : 0,
...(preseason ? { communityFixtures: [], communityResults: [] } : {}),
};
}

// A February start begins after the opening trade and national draft windows.
// The initial player lists are the starting rosters; no 2026 draft is pending.
export function completedOpeningDraftState() {
return {
draftYear: 2026, initial: true, kind: 'NATIONAL', draftOrder: [],
pickOwners: [], availableProspects: [], picks: [], pickIndex: 0,
totalPicks: 0, completed: true,
};
}

// Tasmania career: the manager takes over the expansion club before it has a list or a fixture.
// The 2026 offseason and the 2027 season are simulated for the 18 existing clubs, then control passes to the manager on
// the day Tasmania's concession signing window opens (ahead of free agency and the trade period).
export const TASMANIA_CAREER = {
id: 'TASMANIA_EXPANSION',
clubName: 'Tasmania',
label: 'Tasmania expansion career',
startDate: '2026-10-01',
handoverDate: '2027-10-01',
firstSeason: 2027,
entrySeason: 2028,
};

export function createTasmaniaCareerStartState(initialSeason, seed = `career-${Date.now()}`) {
// Start straight after the 2026 Grand Final so the 2026 draft and trade period are played out
// (drafted players join their clubs) before the 2027 season is simulated.
const base = createCareerStartState(initialSeason, 'AFTER_GF', seed);
return {
...base,
expansionCareer: {
clubName: TASMANIA_CAREER.clubName,
stage: 'SIMULATING',
startDate: TASMANIA_CAREER.startDate,
handoverDate: TASMANIA_CAREER.handoverDate,
concessionSignings: [],
},
};
}
