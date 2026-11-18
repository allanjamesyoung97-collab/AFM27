// Contract structure: a contract is a schedule of salaries, one per remaining season,
// so a deal can be even, front-loaded or back-loaded.
//
//   schedule[0] is the salary for the CURRENT season (what counts against this year's cap),
//   schedule[1] is next season, and so on. A contract with no stored schedule is flat.
//
// This module is pure and has no dependency on the other engines, so the negotiation
// engine, contract engine and screen can all share it.

import { getConfiguredMaximumSalary, getMinimumSalary } from "./salaryCap.js";

const roundTo = (value, step) => Math.round(value / step) * step;
const SALARY_STEP = 5_000;

// How far a single season may stray from the deal's average. Stops contracts being used
// to park money in years where it does not count.
export const STRUCTURE_LIMITS = { minShareOfAverage: 0.75, maxShareOfAverage: 1.5 };

export const STRUCTURE_PRESETS = {
  EVEN: "EVEN",
  FRONT_LOADED: "FRONT_LOADED",
  BACK_LOADED: "BACK_LOADED",
};

export const STRUCTURE_LABELS = {
  EVEN: "Even",
  FRONT_LOADED: "Front-loaded",
  BACK_LOADED: "Back-loaded",
  SINGLE: "Single year",
};

// The salary for each remaining season of a saved contract.
export function getYearlySalaries(contract = {}) {
  const years = Number(contract.yearsRemaining);
  const length = Number.isFinite(years) && years >= 1 ? Math.round(years) : 1;
  const stored = Array.isArray(contract.yearlySalaries) ? contract.yearlySalaries.map(Number).filter(Number.isFinite) : [];
  const fallback = Number(contract.salary) || 0;
  if (!stored.length) return Array.from({ length }, () => fallback);
  return Array.from({ length }, (_, index) => stored[Math.min(index, stored.length - 1)]);
}

// Salary due in the season `offset` seasons from now; 0 once the deal has ended.
export function getSalaryInSeason(contract = {}, offset = 0) {
  const years = Number(contract.yearsRemaining);
  const length = Number.isFinite(years) ? Math.max(0, Math.round(years)) : 1;
  if (offset >= Math.max(1, length)) return 0;
  return getYearlySalaries(contract)[offset] ?? 0;
}

export function getScheduleAverage(schedule = []) {
  return schedule.length ? schedule.reduce((sum, value) => sum + Number(value || 0), 0) / schedule.length : 0;
}

export function getScheduleTotal(schedule = []) {
  return schedule.reduce((sum, value) => sum + Number(value || 0), 0);
}

// Relative weights (mean 1) for a preset or a custom list of weights.
function weightsFor(shape, years) {
  if (years <= 1) return [1];
  let raw;
  if (Array.isArray(shape) && shape.length) {
    raw = Array.from({ length: years }, (_, index) => {
      // Resample a custom shape across a different number of years.
      const position = (index / (years - 1)) * (shape.length - 1);
      const low = Math.floor(position);
      const high = Math.min(shape.length - 1, low + 1);
      return shape[low] + (shape[high] - shape[low]) * (position - low);
    });
  } else if (shape === STRUCTURE_PRESETS.FRONT_LOADED) {
    const first = 1 + Math.min(0.5, (years - 1) * 0.25);
    raw = [first, ...Array.from({ length: years - 1 }, () => (years - first) / (years - 1))];
  } else if (shape === STRUCTURE_PRESETS.BACK_LOADED) {
    const last = 1 + Math.min(0.5, (years - 1) * 0.25);
    raw = [...Array.from({ length: years - 1 }, () => (years - last) / (years - 1)), last];
  } else {
    raw = Array.from({ length: years }, () => 1);
  }
  const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  return raw.map((value) => value / mean);
}

export { weightsFor as getShapeWeights };

// Builds a schedule with the given average annual value. The total is preserved exactly
// (any rounding difference goes on the largest season) and no season falls below the
// minimum salary.
export function buildSalarySchedule(averageAnnual, years, shape = STRUCTURE_PRESETS.EVEN, { seasonYear } = {}) {
  const length = Math.max(1, Math.round(Number(years) || 1));
  const average = Math.max(0, Number(averageAnnual) || 0);
  const total = roundTo(average * length, SALARY_STEP);
  const weights = weightsFor(shape, length);
  const schedule = weights.map((weight) => roundTo(average * weight, SALARY_STEP));

  // Floors, then put the difference on the largest season.
  const floors = schedule.map((_, index) => getMinimumSalary(seasonYear === undefined ? undefined : Number(seasonYear) + index));
  const floored = schedule.map((value, index) => Math.max(value, floors[index]));
  const drift = total - getScheduleTotal(floored);
  if (drift) {
    const largest = floored.indexOf(Math.max(...floored));
    floored[largest] = Math.max(floors[largest], floored[largest] + drift);
  }
  return floored;
}

// The shape (weights with mean 1) of an existing schedule, for reuse at a new average or length.
export function getScheduleShape(schedule = []) {
  const average = getScheduleAverage(schedule);
  return average > 0 ? schedule.map((value) => value / average) : schedule.map(() => 1);
}

// Even, front-loaded or back-loaded. The slope compares the first and last season.
export function describeStructure(schedule = []) {
  if (schedule.length <= 1) return "SINGLE";
  const average = getScheduleAverage(schedule);
  if (!average) return "EVEN";
  const slope = (schedule[0] - schedule[schedule.length - 1]) / average;
  if (Math.abs(slope) < 0.06) return "EVEN";
  return slope > 0 ? "FRONT_LOADED" : "BACK_LOADED";
}

// Average salary weighted towards earlier seasons: money now is worth more to a player
// than the same money later, and later seasons may never be paid (injury, delisting,
// retirement). A flat schedule returns its own value, so even deals are unaffected.
export function getPresentValueAverage(schedule = [], discountRate = 0.08) {
  if (!schedule.length) return 0;
  const factor = 1 / (1 + Math.max(0, discountRate));
  let weighted = 0;
  let weightSum = 0;
  schedule.forEach((value, index) => {
    const weight = factor ** index;
    weighted += Number(value || 0) * weight;
    weightSum += weight;
  });
  return weighted / weightSum;
}

// Rules for a structured deal. Returns { ok, errors, average, bounds }.
export function validateContractStructure(schedule = [], { seasonYear, administrationState = {} } = {}) {
  const errors = [];
  const average = getScheduleAverage(schedule);
  const bounds = [];
  schedule.forEach((value, index) => {
    const year = seasonYear === undefined ? undefined : Number(seasonYear) + index;
    const floor = Math.max(getMinimumSalary(year), Math.ceil((average * STRUCTURE_LIMITS.minShareOfAverage) / 1000) * 1000);
    const ceiling = Math.min(getConfiguredMaximumSalary(year, administrationState), Math.floor((average * STRUCTURE_LIMITS.maxShareOfAverage) / 1000) * 1000);
    bounds.push({ min: floor, max: ceiling });
    if (value < getMinimumSalary(year)) errors.push(`Year ${index + 1} is below the minimum salary.`);
    else if (value > getConfiguredMaximumSalary(year, administrationState)) errors.push(`Year ${index + 1} is above the maximum salary.`);
    else if (schedule.length > 1 && value < average * STRUCTURE_LIMITS.minShareOfAverage - 1) errors.push(`Year ${index + 1} is under ${Math.round(STRUCTURE_LIMITS.minShareOfAverage * 100)}% of the average.`);
    else if (schedule.length > 1 && value > average * STRUCTURE_LIMITS.maxShareOfAverage + 1) errors.push(`Year ${index + 1} is over ${Math.round(STRUCTURE_LIMITS.maxShareOfAverage * 100)}% of the average.`);
  });
  return { ok: errors.length === 0, errors, average, bounds };
}

// Payroll already committed in the season `offset` seasons from now, given every
// player's contract. Used to show how a structure uses future cap space.
export function getCommittedPayroll(contracts = [], offset = 0) {
  return contracts.reduce((sum, contract) => sum + getSalaryInSeason(contract, offset), 0);
}
