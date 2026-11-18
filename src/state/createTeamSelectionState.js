export function createTeamSelectionState() {
  return {
    selectedSide: {
      BP1: null,
      FB: null,
      BP2: null,

      HB1: null,
      CHB: null,
      HB2: null,

      W1: null,
      C: null,
      W2: null,

      HF1: null,
      CHF: null,
      HF2: null,

      FP1: null,
      FF: null,
      FP2: null,

      R: null,
      RR: null,
      ROV: null,

      INT1: null,
      INT2: null,
      INT3: null,
      INT4: null,
      INT5: null
    },

    emergencies: [
      null,
      null,
      null
    ],

    captain: null,

    viceCaptain: null,

    selectionResponsibility: "COACH",

    confirmedForRound: null,

    selectionHistory: [],

    customSelections: [null, null],

    selectionStrategy:
      "BEST_AVAILABLE"
  };
}
