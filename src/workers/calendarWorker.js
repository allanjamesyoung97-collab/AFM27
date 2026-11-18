import { advanceWorld } from '../engine/worldSimulationEngine.js';
import { generateFixture } from '../engine/fixtureGenerator.js';
import { scheduleFixtureAcrossWeekend } from '../engine/fixtureScheduler.js';
let cancelled = false;
self.onmessage = async ({ data }) => {
  if (data.type === 'CANCEL') { cancelled = true; return; }
  if (data.type !== 'ADVANCE') return;
  cancelled = false;
  try {
    const result = await advanceWorld(data.world, data.command, {
      ...data.context, makeFixture: year => scheduleFixtureAcrossWeekend(generateFixture(year)),
      cancelled: () => cancelled, onProgress: progress => self.postMessage({ type: 'PROGRESS', progress }),
    });
    self.postMessage({ type: 'COMPLETE', result });
  } catch (error) { self.postMessage({ type: 'ERROR', message: error instanceof Error ? error.message : String(error) }); }
};
