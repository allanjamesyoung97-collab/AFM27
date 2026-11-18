import { getMinimumSalary, getConfiguredSalaryCap, getConfiguredCapAllowance, getActiveCapBank, isSalaryCapEnforced } from './salaryCap.js';
import { actualContractExtras, projectedContractExtras } from './contractComponents.js';

export const MAX_TRADE_ASSETS = 3;
export function validTradePackage(pack = {}) {
  const ids = [...(pack.players ?? []).map(p => `player:${p.id}`), ...(pack.picks ?? []).map(p => `pick:${p.id ?? p}`)];
  return ids.length > 0 && ids.length <= MAX_TRADE_ASSETS && new Set(ids).size === ids.length;
}

// Delisted contracted players still incur their salary; retirees do not.
export function getClubPlayerPayments(players, contracts, club, offset = 0, seasonState = null) {
  return players.reduce((payroll, player) => {
    const record = contracts[String(player.id)] ?? contracts[player.id] ?? {};
    const currentClub = Object.prototype.hasOwnProperty.call(record, "club") ? record.club : player.club;
    if (record.retired) return payroll;
    const retained = record.formerClubLiability?.club === club
      ? Number(record.formerClubLiability.yearlySalaries?.[offset] ?? 0) : 0;
    if (currentClub !== club) return payroll + Math.max(0, Number.isFinite(retained) ? retained : 0);
    const years = Number(record.yearsRemaining ?? player.contract?.yearsRemaining ?? 0);
    if (offset >= years) return payroll + Math.max(0, Number.isFinite(retained) ? retained : 0);
    const salary = Number((record.yearlySalaries ?? player.contract?.yearlySalaries)?.[offset] ?? record.salary ?? player.contract?.salary ?? 0);
    const terms = { ...(player.contract ?? {}), ...record };
    const extras = record.delisted ? 0 : seasonState && offset === 0
      ? actualContractExtras(terms, seasonState, player.id, club)
      : projectedContractExtras(terms);
    return payroll + Math.max(0, Number.isFinite(salary) ? salary : 0) + extras + Math.max(0, Number.isFinite(retained) ? retained : 0);
  }, 0);
}

export function checkClubCommitments(players, contracts, club, seasonYear, reserve = 0, administrationState = {}) {
  if (!isSalaryCapEnforced(administrationState)) return { ok: true, capEnforced: false };
  let remainingBank = administrationState.salaryCapBank ?? [];
  for (let offset = 0; offset < 10; offset += 1) {
    const year = Number(seasonYear) + offset;
    let payroll = getClubPlayerPayments(players, contracts, club, offset);
    if (offset < 2) payroll += reserve * Math.max(150000, getMinimumSalary(year));
    const baseCap = getConfiguredSalaryCap(year, administrationState);
    const cap = baseCap + getConfiguredCapAllowance(year, remainingBank, administrationState);
    if (payroll > cap) return { ok: false, reason: `${club} would exceed the ${year} salary cap by $${Math.round(payroll - cap).toLocaleString()}.` };
    let used = Math.max(0, payroll - baseCap);
    remainingBank = getActiveCapBank(remainingBank, year).map((entry) => {
      const amount = Math.min(used, entry.amount);
      used -= amount;
      return { ...entry, amount: entry.amount - amount };
    }).filter((entry) => entry.amount > 0);
  }
  return { ok: true };
}
