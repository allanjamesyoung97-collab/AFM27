import { normalizePositionCode } from '../data/positionGroups.js';
import { calculateOverall } from './playerRatingGenerator.js';

export const TRAINABLE_POSITIONS = ['BP', 'HB', 'KPD', 'MID', 'WING', 'HF', 'FF', 'KPF', 'RUC'];
const family = (role) => ({ BP: 'DEF', HB: 'DEF', KPD: 'DEF', MID: 'MID', WING: 'MID', HF: 'FWD', FF: 'FWD', KPF: 'FWD', RUC: 'RUC' })[role];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function positionTrainingDuration(player, target) {
  const role = normalizePositionCode(target);
  const listed = (player.positions ?? []).map(normalizePositionCode);
  if (!TRAINABLE_POSITIONS.includes(role) || listed.includes(role)) return 0;
  const base = Number(player.overall ?? 60);
  const roleRating = player.attributes ? calculateOverall(player.attributes, role) : base;
  const sameLine = listed.some((position) => family(position) === family(role));
  const gap = clamp(base - roleRating, 0, 40);
  // Familiar adjacent roles can take six weeks; major role changes can take two years.
  return Math.round(clamp((sameLine ? 42 : 180) + gap * (sameLine ? 9 : 16), 42, 730));
}

export function advancePositionTraining(player, state, fitness = {}, session = null) {
  const training = state?.positionTraining;
  if (!training?.target) return state;
  const learnedPositions = [...new Set([...(state.learnedPositions ?? []), ...(training.complete ? [training.target] : [])])];
  if (training.complete) return { ...state, learnedPositions, trainingFocus: state.trainingFocus === 'Position Training' ? 'Balanced' : state.trainingFocus };
  const requiredDays = Number(training.requiredDays) || positionTrainingDuration(player, training.target);
  if (!requiredDays) return { ...state, learnedPositions: [...new Set([...learnedPositions, training.target])], trainingFocus: 'Balanced', positionTraining: { ...training, complete: true, progress: 1 } };
  const healthy = !fitness.injury?.weeksRemaining && fitness.trainingProgram !== 'REST';
  const multiplier = healthy ? (session ? 1.3 : 0.45) * (fitness.trainingProgram === 'LIGHT_TRAINING' ? 0.7 : 1) : 0;
  const progress = clamp(Number(training.progress ?? 0) + multiplier / requiredDays, 0, 1);
  return { ...state, learnedPositions: progress >= 1 ? [...new Set([...learnedPositions, training.target])] : learnedPositions, trainingFocus: progress >= 1 ? 'Balanced' : 'Position Training', positionTraining: { ...training, requiredDays, progress, complete: progress >= 1 } };
}
