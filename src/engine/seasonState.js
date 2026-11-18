import { generateFixture } from "./fixtureGenerator.js";
import { scheduleFixtureAcrossWeekend } from "./fixtureScheduler.js";
import { initialLadder } from "../data/clubData.js";

const cloneInitialLadder = () => initialLadder.map((club) => ({
  ...club,
  form: [...(club.form ?? [])],
}));

export function createInitialSeasonState() {
  return {
    seasonYear: 2027,
    seasonHasStarted: false,
    round: 1,
    ladder: cloneInitialLadder(),
    roundHistory: [],
    selectedResultsRound: "ROUND_1",
    fixture: scheduleFixtureAcrossWeekend(generateFixture()),
    phase: "OFFSEASON",
    offseasonStep: 0,
    wildcardResults: [],
    wildcardSeeds: null,
    finalsWeek: 0,
    finalsHistory: [],
    finalsPrizePayments: [],
    premier: null,
    seasonArchive: [],
    retirementHistory: [],
    tradePeriodTransactions: [],
    generatedPlayers: [],
    draftHistory: [],
    rolloverCompletedForYear: null,
  };
}
