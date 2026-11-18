import { advanceWorld } from './worldSimulationEngine.js';
// One worker per continuation request keeps cancellation and ownership explicit.
export function runCalendarSimulation(world, command, context, { onProgress, signal } = {}) {
  if (typeof Worker === 'undefined') return advanceWorld(world, command, { ...context, onProgress, cancelled: () => signal?.aborted });
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/calendarWorker.js', import.meta.url), { type: 'module' });
    const cancel = () => worker.postMessage({ type: 'CANCEL' });
    const close = () => { signal?.removeEventListener('abort', cancel); worker.terminate(); };
    let settled = false;
    const runOnMainThread = async (reason) => {
      if (settled) return;
      close();
      try {
        // The worker receives a structured clone, so the caller's committed world
        // remains untouched. Retrying here is safe if the worker failed to start,
        // load a module, or ran out of resources partway through a checkpoint.
        const result = await advanceWorld(world, command, {
          ...context,
          onProgress,
          cancelled: () => signal?.aborted,
        });
        settled = true;
        resolve(result);
      } catch (error) {
        settled = true;
        const detail = error instanceof Error ? error.message : String(error);
        reject(new Error(`Calendar worker failed (${reason}). Main-thread recovery also failed: ${detail}`));
      }
    };
    signal?.addEventListener('abort', cancel);
    worker.onmessage = ({ data }) => {
      if (data.type === 'PROGRESS') onProgress?.(data.progress);
      if (data.type === 'COMPLETE' && !settled) { settled = true; close(); resolve(data.result); }
      if (data.type === 'ERROR' && !settled) { settled = true; close(); reject(new Error(data.message)); }
    };
    worker.onerror = event => {
      event.preventDefault?.();
      const location = event.filename ? ` at ${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}` : '';
      void runOnMainThread(`${event.message || 'unexpected worker shutdown'}${location}`);
    };
    worker.onmessageerror = () => void runOnMainThread('the worker returned data that could not be read');
    const { makeFixture, cancelled, onProgress: ignored, ...serializableContext } = context;
    try {
      worker.postMessage({ type: 'ADVANCE', world, command, context: serializableContext });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      void runOnMainThread(`the worker could not receive the simulation state: ${detail}`);
    }
    if (signal?.aborted) cancel();
  });
}
