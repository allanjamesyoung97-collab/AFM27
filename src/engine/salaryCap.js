// Salary cap and economy scaling.
//
// The cap, the minimum spend, the minimum salary and the league's money flows all grow
// by the same rate every season (5%), so a contract signed in a later year is worth more
// in absolute dollars but the same share of the cap.

export const BASE_SEASON = 2027;
export const BASE_SALARY_CAP = 18_440_000;
export const CAP_GROWTH_RATE = 0.05;
export const MINIMUM_SPEND_RATIO = 0.95;
export const MAXIMUM_BANKED_SPEND_RATIO = 1.05;
export const BANK_LIFETIME_SEASONS = 4;
export const BASE_MINIMUM_SALARY = 125_000;
// No single player may earn more than this share of the cap.
export const MAXIMUM_SALARY_SHARE = 0.11;

const seasonOf = (seasonYear) => {
  const year = Number(seasonYear);
  return Number.isFinite(year) ? year : BASE_SEASON;
};

// 1.0 in the base season, 1.05 a year later, and so on.
export function getEconomyFactor(seasonYear = BASE_SEASON) {
  return (1 + CAP_GROWTH_RATE) ** (seasonOf(seasonYear) - BASE_SEASON);
}

export function getSalaryCap(seasonYear = BASE_SEASON) {
  return Math.round((BASE_SALARY_CAP * getEconomyFactor(seasonYear)) / 10_000) * 10_000;
}

// Fantasy careers may override the league cap. The stored amount is anchored to
// the season in which it was set, then follows the same annual economy growth.
export function isSalaryCapEnforced(administration = {}) {
  return administration?.fantasySalaryCapEnabled !== false;
}

export function getConfiguredSalaryCap(seasonYear = BASE_SEASON, administration = {}) {
  const custom = Number(administration?.fantasySalaryCapAmount);
  const customSeason = Number(administration?.fantasySalaryCapSeason ?? seasonYear);
  if (!Number.isFinite(custom) || custom <= 0) return getSalaryCap(seasonYear);
  return Math.round((custom * getEconomyFactor(seasonYear)) / getEconomyFactor(customSeason) / 10_000) * 10_000;
}

export function getMinimumSpend(seasonYear = BASE_SEASON) {
  return Math.round(getSalaryCap(seasonYear) * MINIMUM_SPEND_RATIO);
}

export function getConfiguredMinimumSpend(seasonYear = BASE_SEASON, administration = {}) {
  return Math.round(getConfiguredSalaryCap(seasonYear, administration) * MINIMUM_SPEND_RATIO);
}

export function getMinimumSalary(seasonYear = BASE_SEASON) {
  return Math.round((BASE_MINIMUM_SALARY * getEconomyFactor(seasonYear)) / 1000) * 1000;
}

export function getMaximumSalary(seasonYear = BASE_SEASON) {
  return Math.round((getSalaryCap(seasonYear) * MAXIMUM_SALARY_SHARE) / 1000) * 1000;
}

export function getConfiguredMaximumSalary(seasonYear = BASE_SEASON, administration = {}) {
  if (!isSalaryCapEnforced(administration)) return 500_000_000;
  return Math.max(getMinimumSalary(seasonYear), Math.round((getConfiguredSalaryCap(seasonYear, administration) * MAXIMUM_SALARY_SHARE) / 1000) * 1000);
}

// A bank entry can be spent in any of the following four seasons. The bank is
// money under a previous cap, not cash in the club's account.
export function getActiveCapBank(bank = [], seasonYear = BASE_SEASON) {
  const year = seasonOf(seasonYear);
  return (Array.isArray(bank) ? bank : [])
    .filter((entry) => Number(entry.seasonYear) < year && year - Number(entry.seasonYear) <= BANK_LIFETIME_SEASONS)
    .map((entry) => ({ seasonYear: Number(entry.seasonYear), amount: Math.max(0, Math.round(Number(entry.amount) || 0)) }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => a.seasonYear - b.seasonYear);
}

export function getCapAllowance(seasonYear = BASE_SEASON, bank = []) {
  const cap = getSalaryCap(seasonYear);
  const banked = getActiveCapBank(bank, seasonYear).reduce((sum, entry) => sum + entry.amount, 0);
  return Math.min(banked, Math.round(cap * (MAXIMUM_BANKED_SPEND_RATIO - 1)));
}

export function getConfiguredCapAllowance(seasonYear = BASE_SEASON, bank = [], administration = {}) {
  const cap = getConfiguredSalaryCap(seasonYear, administration);
  const banked = getActiveCapBank(bank, seasonYear).reduce((sum, entry) => sum + entry.amount, 0);
  return Math.min(banked, Math.round(cap * (MAXIMUM_BANKED_SPEND_RATIO - 1)));
}

export function getEffectiveSalaryCap(seasonYear = BASE_SEASON, bank = []) {
  return getSalaryCap(seasonYear) + getCapAllowance(seasonYear, bank);
}

export function getConfiguredEffectiveSalaryCap(seasonYear = BASE_SEASON, bank = [], administration = {}) {
  return getConfiguredSalaryCap(seasonYear, administration) + getConfiguredCapAllowance(seasonYear, bank, administration);
}

// Show future commitments against the same bank-consumption rule as transaction
// checks. It does not assume an underspend that has not yet occurred.
export function projectCapCommitments(commitments = [], seasonYear = BASE_SEASON, bank = [], administration = {}) {
  let remaining = bank;
  return commitments.map((value, index) => {
    const year = seasonOf(seasonYear) + index;
    const committed = Math.max(0, Number(value) || 0);
    const base = getConfiguredSalaryCap(year, administration);
    const cap = base + getConfiguredCapAllowance(year, remaining, administration);
    let toUse = Math.max(0, committed - base);
    remaining = getActiveCapBank(remaining, year).map((entry) => {
      const used = Math.min(entry.amount, toUse);
      toUse -= used;
      return { ...entry, amount: entry.amount - used };
    }).filter((entry) => entry.amount > 0);
    const capEnforced = isSalaryCapEnforced(administration);
    return { year, committed, cap, share: capEnforced ? committed / cap : 0, overCap: capEnforced && committed > cap, capEnforced };
  });
}

// Settle once guaranteed pay, earned match payments and award bonuses are known.
// A floor shortfall is paid out to players, so only the unused 5% can be banked.
export function settleSalaryCapSeason({ seasonYear, playerPayments = 0, bank = [], administration = {} } = {}) {
  const year = seasonOf(seasonYear);
  const cap = getConfiguredSalaryCap(year, administration);
  const spend = Math.max(0, Math.round(Number(playerPayments) || 0));
  const minimum = getConfiguredMinimumSpend(year, administration);
  const shortfall = Math.max(0, minimum - spend);
  const active = getActiveCapBank(bank, year);
  const overspend = Math.max(0, spend - cap);
  const allowance = getConfiguredCapAllowance(year, bank, administration);
  if (overspend > allowance) return { ok: false, reason: 'Combined payments exceed the available cap allowance.', cap, spend, shortfall, allowance, bank: active };
  let toUse = overspend;
  const remaining = active.map((entry) => {
    const used = Math.min(entry.amount, toUse);
    toUse -= used;
    return { ...entry, amount: entry.amount - used };
  }).filter((entry) => entry.amount > 0);
  const newBank = Math.max(0, cap - Math.max(spend, minimum));
  return {
    ok: true, cap, spend, minimum, shortfall, allowance,
    bankedThisSeason: newBank,
    bank: [...remaining, ...(newBank ? [{ seasonYear: year, amount: newBank }] : [])],
  };
}
