import { simulateSeasonRound } from "../engine/seasonEngine.js";

self.onmessage = ({ data }) => {
  try {
    const roundData = simulateSeasonRound(data.ladder, data.fixtureRound, data.options);
    self.postMessage({ ok: true, roundData });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
