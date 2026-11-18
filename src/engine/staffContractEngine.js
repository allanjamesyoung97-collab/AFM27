import { getEconomyFactor } from './salaryCap.js';
import { FOOTBALL_DEPARTMENT_BASE_SPEND, getStaffBudgetStatus } from './clubAdministrationEngine.js';

const money = (value) => Math.max(0, Math.round(Number(value) || 0));

export function staffContractFitsCap(administration, proposedStaff, year) {
  const payroll = (administration?.staff ?? []).reduce((sum, person) => sum + money(person.salary), 0);
  const finance = { expenses: { footballDepartment: Math.round(FOOTBALL_DEPARTMENT_BASE_SPEND * getEconomyFactor(year)) + payroll } };
  return getStaffBudgetStatus(finance, administration, year, proposedStaff);
}

export function staffYearsRemaining(person) {
  return Math.max(0, Math.round(Number(person?.contractYearsRemaining ?? 2)));
}

export function staffSigningCost(person) {
  return money(person?.salary * 0.1);
}

export function staffSeverance(person) {
  return money(Number(person?.salary ?? 0) * staffYearsRemaining(person) * 0.25);
}

export function staffPoachingCompensation(person) {
  return staffYearsRemaining(person) > 1
    ? money(person.salary * (staffYearsRemaining(person) - 1) * 0.25)
    : 0;
}

/** Upfront cash required when a signing displaces an existing staff member. */
export function staffAppointmentCosts(candidate, salary, outgoing = null, fromClub = false) {
  const signingFee = staffSigningCost({ salary });
  const poachingCompensation = fromClub ? staffPoachingCompensation(candidate) : 0;
  const replacementSeverance = outgoing ? staffSeverance(outgoing) : 0;
  return { signingFee, poachingCompensation, replacementSeverance,
    total: signingFee + poachingCompensation + replacementSeverance };
}

export function staffMinimumOffer(person, changingClubs = false) {
  const base = money(person?.salary);
  const premium = changingClubs ? (staffYearsRemaining(person) > 1 ? 1.22 : 1.12) : 1.03;
  return Math.ceil(base * premium / 5000) * 5000;
}

/** The terms a staff member opens with: their asking salary and the length of deal they prefer. */
export function staffDesiredTerms(person, changingClubs = false) {
  const salary = staffMinimumOffer(person, changingClubs);
  const seed = [...String(person?.id ?? '')].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rating = Number(person?.rating ?? 0);
  const years = rating >= 80 ? 3 : (seed % 2 === 0 ? 2 : 3);
  return { salary, years };
}

export function signStaff(person, salary, years, date) {
  return {
    ...person,
    salary: money(salary),
    contractYearsRemaining: Math.max(1, Math.min(5, Math.round(Number(years) || 1))),
    contractSignedAt: date,
  };
}

export function advanceStaffContracts(admin, nextYear) {
  if (!admin || Number(admin.staffContractsAdvancedFor) >= Number(nextYear)) return admin;
  const continuing = [];
  const expired = [];
  for (const person of admin.staff ?? []) {
    const remaining = staffYearsRemaining(person) - 1;
    if (remaining > 0) continuing.push({ ...person, contractYearsRemaining: remaining });
    else expired.push({ ...person, contractYearsRemaining: 0, marketOrigin: 'released' });
  }
  return {
    ...admin,
    staff: continuing,
    staffPool: [...(admin.staffPool ?? []), ...expired],
    staffContractsAdvancedFor: nextYear,
  };
}

export function advanceAIStaffContracts(admin, nextYear) {
  if (!admin || Number(admin.staffContractsAdvancedFor) >= Number(nextYear)) return admin;
  let retained = [...(admin.staff ?? [])];
  for (const person of admin.staff ?? []) {
    if (staffYearsRemaining(person) > 1 || Number(person.rating ?? 0) < 70
      || money(admin.cashBalance) < money(person.salary) * 2) continue;
    // The rollover below consumes one year, leaving two seasons on the new deal.
    const renewed = signStaff(person, Math.ceil(money(person.salary) * 1.03 / 5000) * 5000, 3, `${nextYear - 1}-10-01`);
    const proposed = retained.map((member) => member.id === person.id ? renewed : member);
    if (!staffContractFitsCap({ ...admin, staff: retained }, proposed, nextYear).allowed) continue;
    retained = proposed;
  }
  return advanceStaffContracts({ ...admin, staff: retained }, nextYear);
}

export function replaceStaffInRole(roster, newcomer) {
  const sameRole = roster.filter((person) => person.role === newcomer.role);
  const outgoing = newcomer.role === 'Development Coach'
    ? sameRole.length >= 3 ? [...sameRole].sort((a, b) => Number(a.rating) - Number(b.rating))[0] : null
    : sameRole[0] ?? null;
  return {
    staff: [...roster.filter((person) => person !== outgoing), newcomer],
    outgoing,
  };
}

export function resolveStaffPoach(season, clubName, matchOffer, date) {
  const home = season.clubAdministration;
  const offer = home?.pendingStaffPoach;
  if (!offer) return season;
  const person = (home.staff ?? []).find((candidate) => String(candidate.id) === String(offer.staffId));
  if (!person) {
    const cleared = { ...home, pendingStaffPoach: null };
    return { ...season, clubAdministration: cleared, leagueAdministration: { ...season.leagueAdministration, [clubName]: cleared } };
  }
  const clearedHome = { ...home, pendingStaffPoach: null };
  const year = Number(season.seasonYear ?? String(date).slice(0, 4));
  if (matchOffer) {
    const renewed = signStaff(person, offer.salary, offer.years, date);
    if (!staffContractFitsCap(home, home.staff.map((item) => item === person ? renewed : item), year).allowed) return season;
    const updated = { ...clearedHome, staff: home.staff.map((item) => item === person ? renewed : item) };
    return { ...season, clubAdministration: updated, leagueAdministration: { ...season.leagueAdministration, [clubName]: updated } };
  }
  const destination = season.leagueAdministration?.[offer.fromClub];
  if (!destination) return { ...season, clubAdministration: clearedHome, leagueAdministration: { ...season.leagueAdministration, [clubName]: clearedHome } };
  const compensation = staffPoachingCompensation(person);
  const signed = signStaff(person, offer.salary, offer.years, date);
  const replacement = replaceStaffInRole(destination.staff ?? [], signed);
  const costs = staffAppointmentCosts(person, signed.salary, replacement.outgoing, true);
  if (!staffContractFitsCap(destination, replacement.staff, year).allowed || money(destination.cashBalance) < costs.total) {
    return { ...season, clubAdministration: clearedHome, leagueAdministration: { ...season.leagueAdministration, [clubName]: clearedHome } };
  }
  const updatedHome = { ...clearedHome, staff: home.staff.filter((item) => item !== person), cashBalance: money(home.cashBalance) + compensation };
  return {
    ...season,
    clubAdministration: updatedHome,
    leagueAdministration: {
      ...(season.leagueAdministration ?? {}),
      [clubName]: updatedHome,
      [offer.fromClub]: {
        ...destination,
        staff: replacement.staff,
        cashBalance: money(destination.cashBalance) - costs.total,
        commercial: replacement.outgoing ? { ...destination.commercial, boardSatisfaction: Math.max(0, Number(destination.commercial?.boardSatisfaction ?? 70) - 2) } : destination.commercial,
        staffPool: replacement.outgoing ? [...(destination.staffPool ?? []), { ...replacement.outgoing, marketOrigin: 'released' }] : destination.staffPool,
      },
    },
  };
}
