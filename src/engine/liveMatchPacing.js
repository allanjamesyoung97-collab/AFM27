// One visible action advances enough match time to keep the number of
// possession chains, shots and scoring events within a full-match range.
export const MATCH_ACTION_INTERVAL_MS = 500;
export const MATCH_ACTION_ANIMATION_MS = MATCH_ACTION_INTERVAL_MS;
// Shots (set shot, kick and result) get a little longer so the kick reads clearly.
export const MATCH_SHOT_INTERVAL_MS = 2600;
export const MATCH_SHOT_ANIMATION_MS = MATCH_SHOT_INTERVAL_MS;
// Match speed divides the interval between actions (and the animation length).
// The Match Centre applies a 2x floor so its displayed 1x setting is still brisk.
export const MATCH_PLAYBACK_BASE_SPEED = 2;
export const MAX_LIVE_PRESENTATION_SPEED = 16;
// Goal celebrations speed up with the match but never become unreadably short.
export const MAX_GOAL_PRESENTATION_SPEED = 3;
export const MIN_ACTION_DELAY_MS = 40;
// Each action is one disposal (or a contest). A real match has about 750 disposals in 80 minutes, so an action
// covers 3-5 seconds. At 7-10 seconds a match only had room for about 565 actions, which capped disposals at
// roughly a third of real totals.
export const MATCH_ACTION_SECONDS_MIN = 3;
export const MATCH_ACTION_SECONDS_RANGE = 3;
// The shot is animated before its result is celebrated. Keep the goal banner
// and halo on screen long enough to read at every match speed.
export const GOAL_FLASH_DELAY_MS = 2300;
export const GOAL_FLASH_END_MS = 3650;
export const GOAL_RESET_START_MS = 3100;
export const GOAL_RESET_MS = 500;
export const GOAL_CELEBRATION_MS = 3800;

export function nextMatchActionSeconds(secondsRemaining, random = Math.random) {
  return Math.min(
    Math.max(0, Number(secondsRemaining) || 0),
    MATCH_ACTION_SECONDS_MIN + Math.floor(random() * MATCH_ACTION_SECONDS_RANGE),
  );
}

// Shared by the action scheduler and oval: distance determines hang time.
export function actionTiming(action) {
  if (action?.kind === 'setup') return {duration:action.duration ?? 4000, release:0, arrival:1};
  if (action?.phase === 5 || action?.kind === 'shot') return {duration: MATCH_SHOT_ANIMATION_MS, release: .43, arrival: .85};
  const distance = Math.max(0, Number(action?.travelDistance ?? action?.distance ?? 0));
  if (action?.kind === 'kick') {
    const settle = action.protectedZone ? 1000 : 450;
    const flight = 550 + Math.min(65,distance)*35;
    const duration = settle + flight + 180;
    return {duration, release:settle/duration, arrival:(settle+flight)/duration};
  }
  if (action?.kind === 'handball') return {duration:350+Math.min(18,distance)*18, release:.12, arrival:.9};
  if (action?.mark || action?.freeKick) return {duration:4000,release:0,arrival:.25};
  return {duration:1000,release:0,arrival:.9};
}
