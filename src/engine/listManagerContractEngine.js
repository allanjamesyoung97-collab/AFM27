import { getCareerClub, getPlayerMood, updateContractRecord } from './contractEngine.js';
import { getCareerPlayer } from './developmentEngine.js';
import { applyMoodToPlayer, adjustLeaveDesire, evaluateOffer, generateCounterOffer } from './negotiationEngine.js';
import { buildClubNegotiationContext } from './clubAdministrationEngine.js';
import { buildSalarySchedule, getYearlySalaries, validateContractStructure } from './contractStructure.js';
import { checkClubCommitments } from './transactionRules.js';
import { addDays } from './simulationClock.js';

const roundSalary = (value) => Math.round(Number(value) / 5000) * 5000;
const managerBonus = (rating) => Math.max(-3, Math.min(7, (Number(rating) - 65) * 0.28));

export function createContractDelegation({ playerId, years, openingSalary, maxSalary, role, structure = 'EVEN', date }) {
  const opening = roundSalary(openingSalary);
  const ceiling = roundSalary(maxSalary);
  if (!playerId || !Number.isInteger(Number(years)) || years < 1 || years > 6
    || !Number.isFinite(opening) || !Number.isFinite(ceiling) || opening <= 0 || ceiling < opening || !role) {
    throw new Error('Set 1–6 years, a playing role, and a maximum salary at least as high as the opening offer.');
  }
  return {
    playerId: String(playerId), years: Number(years), openingSalary: opening,
    maxSalary: ceiling, role, structure, status: 'ACTIVE', attempts: 0,
    nextActionOn: addDays(date, 1), createdOn: date, lastOfferSalary: null,
  };
}

function finish(instruction, status, date, message, extra = {}) {
  return { ...instruction, ...extra, status, completedOn: date, nextActionOn: null, message };
}

/** Process user instructions once per in-game day. All terms stay within the manager's limits. */
export function processListManagerExtensions(season, players, clubName, date) {
  const administration = season.clubAdministration;
  const instructions = administration?.contractDelegations ?? {};
  const due = Object.values(instructions).filter((item) => item?.status === 'ACTIVE' && item.nextActionOn <= date);
  if (!due.length) return [];

  const listManager = [...(administration.staff ?? [])]
    .filter((person) => person.role === 'List Manager')
    .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))[0];
  const rating = Number(listManager?.rating ?? 0);
  const clubContext = buildClubNegotiationContext({ administrationState: administration, seasonState: season, clubName,
    players: players.filter((player) => getCareerClub(player, season.playerContracts) === clubName) });
  const nextInstructions = { ...instructions };
  const outcomes = [];

  for (const instruction of due) {
    const id = String(instruction.playerId);
    const original = players.find((player) => String(player.id) === id);
    const record = season.playerContracts?.[id] ?? original?.contract ?? {};
    const complete = (status, message, extra = {}) => {
      nextInstructions[id] = finish(instruction, status, date, message, extra);
      outcomes.push({ playerId: id, playerName: original?.name ?? 'Player', status, message });
    };
    if (!original || getCareerClub(original, season.playerContracts) !== clubName || record.retired || record.delisted) {
      complete('CANCELLED', 'The player is no longer on your list.');
      continue;
    }
    if (!listManager) {
      complete('PAUSED', 'Hire a List Manager to continue this negotiation.');
      continue;
    }
    if (Number(record.lastExtendedYear) === Number(season.seasonYear)) {
      complete('CANCELLED', 'The player has already extended this season.');
      continue;
    }
    const negotiation = record.negotiation ?? {};
    // Delegated talks are handled by the List Manager and never consume (or wait on) the player's manual negotiation rounds or cooldown.

    const player = applyMoodToPlayer(getCareerPlayer(original, season.playerDevelopment, season.seasonYear, season.playerContracts), getPlayerMood(record));
    const currentYears = Math.max(0, Math.round(Number(record.yearsRemaining ?? original.contract?.yearsRemaining ?? 0)));
    const existingSchedule = currentYears ? getYearlySalaries({ yearsRemaining: currentYears, salary: record.salary ?? original.contract?.salary, yearlySalaries: record.yearlySalaries }) : [];
    const offeredSalary = instruction.attempts === 0 ? instruction.openingSalary : Math.min(instruction.maxSalary,
      Math.max(instruction.openingSalary, instruction.nextOfferSalary ?? instruction.openingSalary + 5000));
    const extensionSchedule = buildSalarySchedule(offeredSalary, instruction.years, instruction.structure, { seasonYear: Number(season.seasonYear) + currentYears });
    const structure = validateContractStructure(extensionSchedule, { seasonYear: Number(season.seasonYear) + currentYears, administrationState: administration });
    if (!structure.ok) {
      complete('FAILED', structure.errors[0] ?? 'The proposed contract structure is invalid.');
      continue;
    }
    const yearlySalaries = [...existingSchedule, ...extensionSchedule];
    const terms = {
      salary: yearlySalaries[0], yearlySalaries, yearsRemaining: yearlySalaries.length,
      role: instruction.role, signedSeason: season.seasonYear, lastExtendedYear: season.seasonYear,
    };
    const proposedContracts = { ...(season.playerContracts ?? {}), [id]: { ...record, ...terms } };
    const cap = checkClubCommitments(players, proposedContracts, clubName, season.seasonYear, 0, administration);
    if (!cap.ok) {
      complete('CAP_BLOCKED', cap.reason);
      continue;
    }

    const offer = { salary: offeredSalary, yearlySalaries: extensionSchedule, years: instruction.years,
      role: instruction.role, clubName, promises: [] };
    const evaluation = evaluateOffer(player, offer, {
      seasonYear: season.seasonYear, clubContext, deterministic: true,
      demandIncrease: Number(negotiation.demandIncrease ?? 0) + Number(negotiation.agentHostility ?? 0) * 0.001,
    });
    const negotiatedScore = evaluation.score + managerBonus(rating);
    const attempts = Number(instruction.attempts ?? 0) + 1;
    if (negotiatedScore >= 80) {
      season.playerContracts = { ...season.playerContracts, [id]: updateContractRecord(record, {
        terms,
        mood: adjustLeaveDesire(player, record, -20, { clubContext, seasonYear: season.seasonYear }),
        negotiation: { ...negotiation, counterOffer: null,
          agentHostility: Math.max(0, Number(negotiation.agentHostility ?? 0) - 10) },
      }) };
      complete('SIGNED', `${listManager.name} secured a ${instruction.years}-year extension for ${player.name} at $${offeredSalary.toLocaleString()} per year, added to the existing ${currentYears}-year deal.`,
        { attempts, agreedSalary: offeredSalary, agreedYears: instruction.years, managerRating: rating });
      continue;
    }

    const counter = generateCounterOffer(player, offer, { seasonYear: season.seasonYear });
    const nextSalary = Math.min(instruction.maxSalary,
      roundSalary(Math.max(offeredSalary + 5000, counter.salary * (0.9 - (rating - 65) * 0.0015))));
    if (attempts >= 3 || offeredSalary >= instruction.maxSalary || nextSalary <= offeredSalary) {
      complete('FAILED', `${player.name} did not accept terms within your $${instruction.maxSalary.toLocaleString()} salary limit and ${instruction.years}-year term.`,
        { attempts, lastOfferSalary: offeredSalary, playerCounter: counter });
    } else {
      nextInstructions[id] = { ...instruction, attempts, lastOfferSalary: offeredSalary,
        nextOfferSalary: nextSalary, playerCounter: counter, nextActionOn: addDays(date, 3),
        message: `${player.name}'s agent countered. ${listManager.name} will return with an offer within your limits.` };
      outcomes.push({ playerId: id, playerName: player.name, status: 'COUNTER', message: nextInstructions[id].message });
    }
  }
  season.clubAdministration = { ...administration, contractDelegations: nextInstructions };
  if (season.leagueAdministration?.[clubName]) season.leagueAdministration[clubName] = season.clubAdministration;
  return outcomes;
}