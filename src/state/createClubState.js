import { clubMetrics }
  from "../data/clubMetrics";

export function createClubState(
  options = {}
) {
  const {
    clubId = null,

    cashBalance = 35000000,

    annualRevenue = 89400000,

    annualExpenses = 76200000,

    memberships = 106423
  } = options;

  const metrics =
    clubMetrics.reduce(
      (
        currentMetrics,
        metric
      ) => {
        currentMetrics[
          metric.id
        ] =
          metric.defaultValue;

        return currentMetrics;
      },
      {}
    );

  return {
    clubId,

    finances: {
      cashBalance,
      annualRevenue,
      annualExpenses
    },

    metrics,

    facilities: [],

    sponsorships: [],

    staff: [],

    contracts: [],

    boardGoals: [],

    memberships: {
      current:
        memberships,
      target:
        memberships + 5000
    },

    modifiers: [],

    history: {
      seasons: [],
      achievements: []
    },

    createdAt:
      Date.now()
  };
}