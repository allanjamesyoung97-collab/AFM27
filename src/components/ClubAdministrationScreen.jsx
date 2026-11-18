import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { players } from "../data/players.js";
import { clubProfiles } from "../data/clubProfiles.js";
import {
evaluateOffer,
generateCounterOffer,
adjustLeaveDesire,
applyMoodToPlayer,
createPromises,
resolveLeaveDesire,
getLeaveDesireLevel,
getLocationContentment,
getLocationLabel,
getOutcomeLabel,
negotiationOutcomes,
summarizeEvaluation,
} from "../engine/negotiationEngine.js";
import { calculateMarketValue } from "../engine/contractValueEngine.js";
import { getConfiguredMaximumSalary, getMinimumSalary, projectCapCommitments } from "../engine/salaryCap.js";
import { checkClubCommitments } from "../engine/transactionRules.js";
import {
STRUCTURE_LABELS,
buildSalarySchedule,
describeStructure,
getSalaryInSeason,
getScheduleAverage,
getScheduleShape,
getYearlySalaries,
validateContractStructure,
} from "../engine/contractStructure.js";
import { playingRoles, promiseTypes } from "../data/playerPersonalities.js";
import {
CONTRACT_STATUS,
getContractStatus,
formatContractDuration,
getPlayerMood,
updateContractRecord,
} from "../engine/contractEngine.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { gamesForPlayerInSeason, normalizeContractComponents, projectedContractExtras } from "../engine/contractComponents.js";
import PotentialStars from "./PotentialStars.jsx";
import JobMarketTab from "./JobMarketTab.jsx";
import { createContractDelegation } from "../engine/listManagerContractEngine.js";
import { dayKey } from "../engine/simulationClock.js";
import { getJobMarket } from "../engine/jobMarketEngine.js";
import {
AFL_MEMBERSHIP_BASELINES,
MAX_FACILITY_LEVEL,
calculateBoardReview,
getStaffBudgetStatus,
calculateClubFinances,
calculateMembershipGrowth,
createClubAdministrationState,
createBoardObjectives,
boardObjectiveChoices,
proposeBoardObjectives,
generateSponsorshipOffers,
buildSponsorCounter,
describeSponsorIncentive,
getSponsorCounterAvailability,
incentiveMaxValue,
SPONSOR_COUNTER_REQUESTS,
SPONSOR_PACKAGES,
sponsorTerminationFee,
getAccruedCashState,
getFacilityDefinitions,
getFacilityUpgradeCost,
getFacilityUpgradeDays,
getFacilityRunningCost,
startFacilityProject,
toDayString,
daysBetweenKeys,
getStaffBonuses,
getStaffRoleImpactLabel,
upgradeStaffRoster,
normalizeStaffPool,
uniqueStaffNames,
checkPayrollChange,
buildClubNegotiationContext,
} from "../engine/clubAdministrationEngine.js";
import { signStaff, staffYearsRemaining, staffMinimumOffer, staffDesiredTerms, staffSeverance, staffPoachingCompensation, staffAppointmentCosts, replaceStaffInRole, resolveStaffPoach, staffContractFitsCap } from "../engine/staffContractEngine.js";

function StaffRating({ rating }) {
const score = Math.max(0, Math.min(100, Number(rating) || 0));
const tier = score >= 85 ? { label: "Elite", color: "#a78bfa", background: "#302047" }
: score >= 75 ? { label: "Strong", color: "#34d399", background: "#123b34" }
: score >= 65 ? { label: "Solid", color: "#60a5fa", background: "#173453" }
: score >= 55 ? { label: "Developing", color: "#fbbf24", background: "#463518" }
: { label: "Below standard", color: "#fb7185", background: "#4b2030" };
return <span title={`Staff rating ${score} of 100: ${tier.label}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 8, border: `1px solid ${tier.color}`, background: tier.background, color: tier.color, fontWeight: 800, whiteSpace: "nowrap" }}>
<span style={{ fontSize: 18 }}>{score}</span><span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>{tier.label}</span>
</span>;
}

// Breakdown of a sponsorship package: signing payment, guaranteed fee and any incentives.
function SponsorTerms({ offer }) {
const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString()}`;
const years = Number(offer.remainingYears ?? offer.years ?? 1);
const incentives = offer.incentives ?? [];
const upfront = Number(offer.upfrontPayment ?? 0);
const maxAnnual = incentives.reduce((sum, incentive) => sum + incentiveMaxValue(incentive), 0);
const row = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 };
return (
<div style={{ display: "grid", gap: 6, margin: "8px 0" }}>
{upfront > 0 && <div style={row}><span>On signing</span><strong style={{ color: "#38bdf8" }}>{money(upfront)}</strong></div>}
<div style={row}><span>Guaranteed fee</span><strong>{money(offer.annualValue)} / year</strong></div>
{incentives.length > 0 && (
<div style={{ padding: 8, background: "#0f172a", borderRadius: 8, display: "grid", gap: 5 }}>
<div style={{ ...row, color: "#fbbf24" }}><span>Season bonuses</span><strong>up to {money(maxAnnual)} / year</strong></div>
{incentives.map((incentive) => {
const text = describeSponsorIncentive(incentive);
return <div key={incentive.id} style={{ fontSize: 12, color: "#94a3b8" }}><strong style={{ color: "#cbd5e1" }}>{text.label}:</strong> {text.detail}</div>;
})}
</div>
)}
{offer.guaranteedTotal != null && (
<div style={{ fontSize: 12, color: "#94a3b8", display: "grid", gap: 2 }}>
<div style={row}><span>Guaranteed over {offer.years} year{offer.years === 1 ? "" : "s"}</span><span>{money(offer.guaranteedTotal)}</span></div>
{incentives.length > 0 && <div style={row}><span>Typical with bonuses</span><span>{money(offer.expectedTotalValue)}</span></div>}
{incentives.length > 0 && <div style={row}><span>Maximum</span><span>{money(offer.maxTotalValue)}</span></div>}
</div>
)}
</div>
);
}

// Viewport rectangle of the page's <main> area, kept current while `active`, so overlays can
// sit centred in the content area rather than across the whole window (navigation stays clear).
function useMainAreaBounds(active) {
const [bounds, setBounds] = useState(null);
useLayoutEffect(() => {
if (!active || typeof document === "undefined") { setBounds(null); return undefined; }
const mainEl = document.querySelector("main");
if (!mainEl) { setBounds(null); return undefined; }
const measure = () => {
const rect = mainEl.getBoundingClientRect();
setBounds({ top: Math.max(0, rect.top), left: Math.max(0, rect.left), right: Math.max(0, window.innerWidth - rect.right), bottom: 0 });
};
measure();
window.addEventListener("resize", measure);
window.addEventListener("scroll", measure, true);
const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
observer?.observe(mainEl);
const asideEl = document.querySelector("aside");
if (asideEl) observer?.observe(asideEl);
return () => {
window.removeEventListener("resize", measure);
window.removeEventListener("scroll", measure, true);
observer?.disconnect();
};
}, [active]);
return bounds;
}

export default function ClubAdministrationScreen({
club,
leagueClubs = [],
players: playerPool = players,
seasonState = {},
currentDate,
playerContracts = {},
clubAdministration,
initialTab = "OVERVIEW",
initialPlayerId = null,
availableTabs = ["OVERVIEW", "CONTRACTS", "STAFF", "FACILITIES", "COMMERCIAL", "BOARD", "JOB_MARKET"],
hideTabs = false,
title = "Club Administration",
activeTab: controlledTab,
onTabChange,
onPlayerContractsChange = () => {},
onAdministrationStateChange = () => {},
onStaffMarketChange,
onAcademyAction,
onApplyForJob = () => {},
}) {
const selectedClubName = typeof club === "string" ? club : club?.name;
const objectiveYear = seasonState.phase === "OFFSEASON" && seasonState.seasonHasStarted ? Number(seasonState.seasonYear) + 1 : Number(seasonState.seasonYear ?? 2027);

const clubPlayers = useMemo(
() => playerPool
.map((player) => getCareerPlayer(player, seasonState?.playerDevelopment, Number(seasonState?.seasonYear ?? 2027), playerContracts))
.filter((player) => player.club === selectedClubName),
[playerPool, selectedClubName, playerContracts, seasonState?.playerDevelopment, seasonState?.seasonYear]
);
const delistedPlayers = useMemo(
() => playerPool.filter((player) => {
const record = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
return record.delisted && record.club === selectedClubName;
}),
[playerPool, selectedClubName, playerContracts]
);

const [boardProposal, setBoardProposal] = useState({});
const [boardNegotiationMessage, setBoardNegotiationMessage] = useState("");
const [localTab, setLocalTab] = useState(() => availableTabs.includes(initialTab) ? initialTab : availableTabs[0]);
const tab = controlledTab ?? localTab;
const [negotiationOpen, setNegotiationOpen] = useState(false);
// Keep the negotiation popup inside the main content area so the navigation pane and header stay visible and usable.
const [negotiationBounds, setNegotiationBounds] = useState(null);
useLayoutEffect(() => {
if (!negotiationOpen || typeof document === "undefined") { setNegotiationBounds(null); return undefined; }
const mainEl = document.querySelector("main");
if (!mainEl) { setNegotiationBounds(null); return undefined; }
const measure = () => {
const rect = mainEl.getBoundingClientRect();
const top = Math.max(0, rect.top);
setNegotiationBounds({ top, left: Math.max(0, rect.left), right: Math.max(0, window.innerWidth - rect.right), bottom: 0 });
};
measure();
window.addEventListener("resize", measure);
window.addEventListener("scroll", measure, true);
const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
observer?.observe(mainEl);
const asideEl = document.querySelector("aside");
if (asideEl) observer?.observe(asideEl);
return () => {
window.removeEventListener("resize", measure);
window.removeEventListener("scroll", measure, true);
observer?.disconnect();
};
}, [negotiationOpen]);
const setTab = (nextTab) => {
setLocalTab(nextTab);
if (nextTab !== "NEGOTIATION") setNegotiationOpen(false);
onTabChange?.(nextTab);
};
const topRef = useRef(null);
const staffMarketRef = useRef(null);
const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId);
const [contractSort, setContractSort] = useState("YEARS_ASC");
const [staffRoleFilter, setStaffRoleFilter] = useState("ALL");
const [staffSort, setStaffSort] = useState("OVERALL_DESC");
const [staffMarketTab, setStaffMarketTab] = useState("FREE");
const [staffOfferTarget, setStaffOfferTarget] = useState(null);
const [staffOfferSalary, setStaffOfferSalary] = useState(0);
const [staffOfferYears, setStaffOfferYears] = useState(2);
const [staffPositionTarget, setStaffPositionTarget] = useState(null);
const [pendingStaffFire, setPendingStaffFire] = useState(null);
const [negotiationMessage, setNegotiationMessage] = useState("");
// Flash notification for staff signings that fall through: shown over the page, then fades away.
const [staffFlash, setStaffFlash] = useState(null);
const flashStaffNotice = (text, kind = "error") => {
setNegotiationMessage("");
setStaffFlash({ text, kind, id: Date.now() });
};
const staffFlashBounds = useMainAreaBounds(Boolean(staffFlash));
useEffect(() => {
if (!staffFlash) return undefined;
const timer = setTimeout(() => setStaffFlash(null), 6000);
return () => clearTimeout(timer);
}, [staffFlash]);
const [pendingDelist, setPendingDelist] = useState(null);
const [delegationPlayerId, setDelegationPlayerId] = useState(null);
const [delegationYears, setDelegationYears] = useState(2);
const [delegationRole, setDelegationRole] = useState("BEST_22");
const [delegationOpeningSalary, setDelegationOpeningSalary] = useState(0);
const [delegationMaxSalary, setDelegationMaxSalary] = useState(0);
const [delegationStructure, setDelegationStructure] = useState("EVEN");
const [delegationError, setDelegationError] = useState("");
const [lastEvaluation, setLastEvaluation] = useState(null);
const [lastCounter, setLastCounter] = useState(null);
const [counterRevisionAvailable, setCounterRevisionAvailable] = useState(false);
const [counterRevisionUsed, setCounterRevisionUsed] = useState(false);
const contractStates = playerContracts;
const setContractStates = onPlayerContractsChange;
const seasonYear = Number(seasonState.seasonYear ?? 2027);
const recentlySigned = (playerId) => {
const signedAt = playerContracts?.[String(playerId)]?.lastSignedAt;
const signed = new Date(signedAt ?? "");
const today = new Date(currentDate ?? "");
if (!signedAt || Number.isNaN(signed.getTime()) || Number.isNaN(today.getTime())) return false;
const availableFrom = new Date(signed);
availableFrom.setMonth(availableFrom.getMonth() + 3);
return today >= signed && today < availableFrom;
};
const contractReport = seasonState.contractReport ?? null;
const initialAdministration = createClubAdministrationState(
typeof club === "string" ? { name: club } : club,
clubPlayers,
seasonYear,
playerContracts,
);
const administration = clubAdministration
? {
...initialAdministration,
...clubAdministration,
facilities: { ...initialAdministration.facilities, ...(clubAdministration.facilities ?? {}) },
staff: upgradeStaffRoster(clubAdministration.staff ?? initialAdministration.staff, clubAdministration.staff ? [] : initialAdministration.staff, selectedClubName),
staffPool: normalizeStaffPool(clubAdministration.staffPool ?? initialAdministration.staffPool, selectedClubName, clubAdministration.staffPoolLastRefreshedAt ?? initialAdministration.staffPoolLastRefreshedAt, true, (clubAdministration.staff ?? initialAdministration.staff).map((person) => person.id)),
commercial: {
...initialAdministration.commercial,
...(clubAdministration.commercial ?? {}),
...(!(clubAdministration.commercial?.membershipBaselineYear)
? { memberships: AFL_MEMBERSHIP_BASELINES[selectedClubName] ?? clubAdministration.commercial?.memberships ?? initialAdministration.commercial.memberships, membershipBaselineYear: 2025 }
: {}),
},
}
: initialAdministration;
const facilities = administration.facilities ?? {};
const commercial = administration.commercial ?? {};
const staff = upgradeStaffRoster(administration.staff ?? [], [], selectedClubName);
const staffPositions = (() => {
const positions = initialAdministration.staff.map((position, index, allPositions) => ({
key: `${position.role}:${allPositions.slice(0, index).filter((item) => item.role === position.role).length}`,
role: position.role,
originalId: position.id,
person: null,
}));
const assigned = new Set();
for (const position of positions) {
const person = staff.find((member) => !assigned.has(String(member.id))
&& (member.staffPositionKey === position.key || String(member.id) === String(position.originalId)));
if (person) { position.person = person; assigned.add(String(person.id)); }
}
for (const position of positions) {
if (position.person) continue;
const person = staff.find((member) => member.role === position.role && !assigned.has(String(member.id)));
if (person) { position.person = person; assigned.add(String(person.id)); }
}
return positions;
})();
const listManager = staff.filter((person) => person.role === "List Manager")
.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))[0];
const contractDelegations = administration.contractDelegations ?? {};
const staffPool = normalizeStaffPool(administration.staffPool ?? [], selectedClubName, administration.staffPoolLastRefreshedAt ?? `${seasonYear - 1}-10-01`, true, staff.map((person) => person.id));
const rawRivalStaff = Object.entries(seasonState.leagueAdministration ?? {}).flatMap(([clubName, clubState]) =>
clubName === selectedClubName ? [] : (clubState?.staff ?? []).map((person) => ({ ...person, fromClub: clubName })));
const employedStaffIds = new Set([...staff, ...rawRivalStaff].map((person) => String(person.id)));
const availableStaffById = new Map();
for (const candidate of staffPool) if (!employedStaffIds.has(String(candidate.id))) availableStaffById.set(String(candidate.id), { ...candidate, marketSourceClub: selectedClubName });
for (const [clubName, clubState] of Object.entries(seasonState.leagueAdministration ?? {})) {
if (clubName === selectedClubName) continue;
for (const candidate of clubState?.staffPool ?? []) if (!employedStaffIds.has(String(candidate.id))) {
availableStaffById.set(String(candidate.id), { ...candidate, marketSourceClub: clubName });
}
}
// Nobody in the league shares a full name: your staff keep theirs, then rivals, then the market.
const [, rivalStaff, openMarketStaff] = uniqueStaffNames([staff, rawRivalStaff, [...availableStaffById.values()]]);
const marketCandidates = staffMarketTab === "FREE" ? openMarketStaff : rivalStaff;
const staffRoles = [...new Set([...staffPositions.map((position) => position.role), ...openMarketStaff.map((person) => person.role), ...rivalStaff.map((person) => person.role)])].sort((a, b) => a.localeCompare(b));
// Rating gain over whoever the candidate would replace (lowest-rated Development Coach once all three are filled).
const staffUpgradeFor = (candidate) => {
const roleStaff = staff.filter((person) => person.role === candidate.role);
const incumbent = candidate.role === "Development Coach"
? [...roleStaff].sort((a, b) => Number(a.rating ?? 0) - Number(b.rating ?? 0))[0]
: roleStaff[0];
return Number(candidate.rating) - Number(incumbent?.rating ?? 60);
};
const visibleStaffPool = marketCandidates
.filter((person) => staffRoleFilter === "ALL" || person.role === staffRoleFilter)
.sort((a, b) => staffSort === "UPGRADE_DESC"
? staffUpgradeFor(b) - staffUpgradeFor(a) || Number(b.rating) - Number(a.rating) || a.name.localeCompare(b.name)
: staffSort === "POSITION_ASC"
? a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
: staffSort === "OVERALL_ASC"
? Number(a.rating) - Number(b.rating)
: Number(b.rating) - Number(a.rating));
const staffPoolLastRefresh = administration.staffPoolLastRefreshedAt ?? `${seasonYear - 1}-10-01`;
const staffDaysToRefresh = (() => {
const last = new Date(`${String(staffPoolLastRefresh).slice(0, 10)}T00:00:00`);
const today = new Date(currentDate ?? new Date());
last.setHours(0, 0, 0, 0);
today.setHours(0, 0, 0, 0);
const elapsed = Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86_400_000));
return Math.max(0, 28 - (elapsed % 28));
})();
const facilityDefinitions = getFacilityDefinitions(facilities, { rosterSize: clubPlayers.length, staff });
const finance = calculateClubFinances({
club: typeof club === "string" ? { name: club } : club,
// Delisted players remain on the books until their contract expires.
roster: [...clubPlayers, ...delistedPlayers.filter((player) => {
const record = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
return Number(record.yearsRemaining ?? player.contract?.yearsRemaining ?? 1) > 0 && Number(record.salary ?? player.contract?.salary ?? 0) > 0;
})],
playerContracts,
administrationState: administration,
seasonState,
});
const staffBudget = getStaffBudgetStatus(finance, administration, objectiveYear);
const budgetForOffer = (person, salary, renewing = false) => {
const proposed = signStaff(person, salary, 1, currentDate);
const proposedStaff = renewing
? staff.map((member) => String(member.id) === String(person.id) ? proposed : member)
: replaceStaffInRole(staff, proposed).staff;
return getStaffBudgetStatus(finance, administration, objectiveYear, proposedStaff);
};
const finalsPrizeMoney = (seasonState.finalsPrizePayments ?? [])
.filter((payment) => payment.club === selectedClubName && Number(payment.seasonYear) === seasonYear)
.reduce((total, payment) => total + Number(payment.amount ?? 0), 0);

useEffect(() => {
if (Number(administration.boardObjectives?.seasonYear) === objectiveYear) return;
updateAdministration((current) => ({
...current,
boardObjectives: createBoardObjectives(
typeof club === "string" ? { name: club } : club,
clubPlayers,
objectiveYear,
{ cashBalance: current.cashBalance },
),
}));
}, [administration.boardObjectives?.seasonYear, objectiveYear, selectedClubName]);

useEffect(() => {
if (Number(commercial.seasonYear) === seasonYear) return;
updateAdministration((current) => {
const previousSponsor = current.commercial?.activeSponsor;
const activeSponsor = previousSponsor
? { ...previousSponsor, remainingYears: Number(previousSponsor.remainingYears ?? previousSponsor.years ?? 1) - 1 }
: null;
const continuingSponsor = activeSponsor?.remainingYears > 0 ? activeSponsor : null;
const { memberships: nextMemberships } = calculateMembershipGrowth({
memberships: current.commercial?.memberships,
sponsor: continuingSponsor,
supporterSatisfaction: current.commercial?.supporterSatisfaction,
ticketPrice: current.commercial?.ticketPrice,
ladder: seasonState.ladder,
clubName: selectedClubName,
fanExperienceLevel: current.facilities?.matchdayFanExperience,
});
const offers = generateSponsorshipOffers(club, clubPlayers, seasonYear, {
cashBalance: finance.cashBalance,
memberships: nextMemberships,
reputation: Number(current.commercial?.reputation ?? clubProfiles[String(club?.name ?? "").replace(/\s+/g, "_").toUpperCase()]?.footballPrestige ?? 70),
recentSuccess: finance.recentSuccess * 100,
premiershipWindow: Number(current.commercial?.reputation ?? clubProfiles[String(club?.name ?? "").replace(/\s+/g, "_").toUpperCase()]?.footballPrestige ?? 70),
});
return {
...current,
commercial: {
...current.commercial,
seasonYear,
memberships: nextMemberships,
activeSponsor: continuingSponsor,
offers,
counterOffers: {},
},
};
});
}, [seasonYear, club?.id, commercial.seasonYear]);

function updateAdministration(update) {
onAdministrationStateChange((previous) => {
const current = previous
? {
...administration,
...previous,
facilities: { ...administration.facilities, ...(previous.facilities ?? {}) },
staff: upgradeStaffRoster(previous.staff ?? administration.staff, [], selectedClubName),
staffPool: normalizeStaffPool(previous.staffPool ?? administration.staffPool, selectedClubName, previous.staffPoolLastRefreshedAt ?? administration.staffPoolLastRefreshedAt, true, (previous.staff ?? administration.staff).map((person) => person.id)),
commercial: {
...administration.commercial,
...(previous.commercial ?? {}),
...(!(previous.commercial?.membershipBaselineYear)
? { memberships: AFL_MEMBERSHIP_BASELINES[selectedClubName] ?? administration.commercial.memberships, membershipBaselineYear: 2025 }
: {}),
},
}
: administration;
const accrued = getAccruedCashState(current, finance, seasonState);
return typeof update === "function" ? update(accrued) : update;
});
}

function syncCashBeforePayrollChange() {
updateAdministration((current) => current);
}

// Describes this club to the negotiation engine: coaching staff, live ladder, reputation
// and facilities all feed into how players score offers and how likely they are to leave.
const negotiationContext = useMemo(
() => buildClubNegotiationContext({ administrationState: administration, seasonState, clubName: selectedClubName, players: clubPlayers }),
[administration, seasonState, selectedClubName, clubPlayers]
);

// The negotiation engine reads the club's context from context.clubContext.
const leaveContext = useMemo(() => ({ clubContext: negotiationContext, seasonYear }), [negotiationContext, seasonYear]);

// Build contract rows from player data + personality.
const contracts = useMemo(
() =>
clubPlayers.map((player) => {
const state = contractStates[player.id] ?? {};
const baseSalary =
state.salary ?? player.contract?.salary ?? 0;
const baseYears =
state.yearsRemaining ?? state.years ?? player.contract?.yearsRemaining ?? null;

const { marketValue } = calculateMarketValue(player, { seasonYear });

const staffBonuses = getStaffBonuses(staff);
const seniorCoachRating = staffBonuses.seniorCoachRating;
// Display only: the engine applies the coach modifier itself through negotiationContext.
const coachRelationship = Math.max(0, Math.min(100,
Number(player.personality?.relationships?.seniorCoach ?? 50) + staffBonuses.coachRelationshipModifier));
// Stored mood (broken promises, relationship changes) is folded into the player here.
const playerWithStaff = applyMoodToPlayer(player, getPlayerMood(state));
const leaveDesire = resolveLeaveDesire(playerWithStaff, state, leaveContext);
const oldNegotiation = state.negotiation ?? {};
const currentDateMs = Date.parse(currentDate ?? "");
const retryDateMs = Date.parse(oldNegotiation.cooldownUntilDate ?? "");
const dateCooldownActive = Number.isFinite(currentDateMs) && Number.isFinite(retryDateMs) && currentDateMs < retryDateMs;
const dateCooldownExpired = Number.isFinite(currentDateMs) && Number.isFinite(retryDateMs) && currentDateMs >= retryDateMs;
const sameSeason = Number(oldNegotiation.seasonYear) === seasonYear;
const negotiation = {
...oldNegotiation,
seasonYear,
counterRevisionUsed: sameSeason && !dateCooldownExpired ? Boolean(oldNegotiation.counterRevisionUsed) : false,
roundsUsed: dateCooldownActive ? Number(oldNegotiation.roundsUsed ?? 0) : dateCooldownExpired ? 0 : sameSeason ? Number(oldNegotiation.roundsUsed ?? 0) : 0,
cooldownUntilDate: dateCooldownExpired ? null : oldNegotiation.cooldownUntilDate,
cooldownUntilRound: sameSeason ? Number(oldNegotiation.cooldownUntilRound ?? 0) : 0,
demandIncrease: sameSeason ? Number(oldNegotiation.demandIncrease ?? 0) : Math.max(0, Number(oldNegotiation.demandIncrease ?? 0) * 0.5),
agentHostility: sameSeason ? Number(oldNegotiation.agentHostility ?? 0) : Math.max(0, Number(oldNegotiation.agentHostility ?? 0) - 10),
};
const demand = Math.round((marketValue * (1 + Number(negotiation.demandIncrease ?? 0) + Number(negotiation.agentHostility ?? 0) * 0.001)) / 5000) * 5000;
const leaveLevel = getLeaveDesireLevel(leaveDesire);
const schedule = getYearlySalaries({ yearsRemaining: baseYears, salary: baseSalary, yearlySalaries: state.yearlySalaries });

const personality = player.personality ?? {};
const agent = personality.agent ?? {};

return {
playerId: player.id,
player: player.name,
playerObj: player,
playerWithStaff,
salary: baseSalary,
yearlySalaries: state.yearlySalaries,
schedule,
structure: describeStructure(schedule),
locationContentment: getLocationContentment(player, player.club),
years: baseYears,
contractStatus: getContractStatus({ yearsRemaining: baseYears }),
marketValue,
demand,
negotiation,
coachRelationship,
seniorCoachRating,
leaveDesire,
leaveLevel,
personality,
agent,
status: player.contract?.status ?? "Active",
};
}),
[clubPlayers, contractStates, staff, seasonYear, negotiationContext, leaveContext]
);

const playerPayments = finance.playerPayments;
const capSpace = finance.remainingCap;
const sortedContracts = useMemo(() => [...contracts].sort((a, b) => {
if (contractSort === "SALARY_DESC") return Number(b.salary ?? 0) - Number(a.salary ?? 0) || a.player.localeCompare(b.player);
if (contractSort === "SALARY_ASC") return Number(a.salary ?? 0) - Number(b.salary ?? 0) || a.player.localeCompare(b.player);
const aYears = a.years == null ? Number.POSITIVE_INFINITY : Number(a.years);
const bYears = b.years == null ? Number.POSITIVE_INFINITY : Number(b.years);
return aYears - bYears || a.player.localeCompare(b.player);
}), [contracts, contractSort]);

const tabs = availableTabs;

const boardObjectiveCategories = boardObjectiveChoices(typeof club === "string" ? { name: club } : club, clubPlayers, objectiveYear, administration);
const boardObjectivesFinalized = Number(administration.boardObjectives?.seasonYear) === objectiveYear && Boolean(administration.boardObjectives?.negotiated);
const boardReview = calculateBoardReview({ finance, seasonState, club: typeof club === "string" ? { name: club } : club, administrationState: administration, roster: clubPlayers });
const boardScore = boardReview.score;
const boardGrade = boardScore >= 90 ? "A+" : boardScore >= 82 ? "A" : boardScore >= 74 ? "B" : boardScore >= 64 ? "C" : "D";

const cardStyle = {
background: "#0f172a",
border: "1px solid #334155",
borderRadius: "16px",
padding: "20px",
};

const tabStyle = (currentTab) => ({
padding: "10px 14px",
border: "none",
borderRadius: "10px",
cursor: "pointer",
background: tab === currentTab ? "#ea580c" : "#1e293b",
color: "white",
fontWeight: "bold",
transition: "background 0.2s ease",
});

const gradeColour = (grade) => {
if (grade.includes("A")) return "#22c55e";
if (grade.includes("B")) return "#f59e0b";
return "#ef4444";
};

// --- Offer form state ---
// The offer is a schedule of salaries, one per season (this season first). The average
// annual value and the number of years are derived from it.
const [offerSchedule, setOfferSchedule] = useState(() => {
const first = contracts.find((c) => c.playerId === initialPlayerId);
return first
? buildSalarySchedule(Math.round(first.demand / 5000) * 5000, 1, "EVEN", { seasonYear })
: [0];
});
const offerYears = offerSchedule.length;
const offerSalary = getScheduleAverage(offerSchedule);
const scheduleOptions = { seasonYear };
const setOfferAverage = (average) => setOfferSchedule((current) => buildSalarySchedule(average, current.length, getScheduleShape(current), scheduleOptions));
const changeOfferYears = (years) => setOfferSchedule((current) => buildSalarySchedule(getScheduleAverage(current), years, getScheduleShape(current), scheduleOptions));
const applyStructurePreset = (preset) => setOfferSchedule((current) => buildSalarySchedule(getScheduleAverage(current), current.length, preset, scheduleOptions));
const setOfferYear = (index, value) => setOfferSchedule((current) => current.map((salary, i) => (i === index ? value : salary)));
const [offerRole, setOfferRole] = useState("BEST_22");
const [offerPromises, setOfferPromises] = useState([]);
const [offerComponents, setOfferComponents] = useState(() => normalizeContractComponents());
const changeComponent = (group, key, value) => setOfferComponents((current) => ({ ...current,
[group]: { ...current[group], [key]: Math.max(0, Number(value) || 0) },
}));

const selectedContract = contracts.find((c) => c.playerId === selectedPlayerId);
const getExtensionTerms = (extensionSchedule) => {
const currentYears = Math.max(0, Math.round(Number(selectedContract?.years ?? 0)));
const currentSchedule = currentYears > 0
? getYearlySalaries({ yearsRemaining: currentYears, salary: selectedContract?.salary, yearlySalaries: selectedContract?.yearlySalaries })
: [];
const yearlySalaries = [...currentSchedule, ...extensionSchedule];
return {
salary: yearlySalaries[0] ?? extensionSchedule[0] ?? 0,
yearlySalaries,
yearsRemaining: yearlySalaries.length,
existingYears: currentYears,
extensionYears: extensionSchedule.length,
};
};

const delistPlayer = (contractRow) => {
setPendingDelist(contractRow);
};

const confirmDelistPlayer = () => {
if (!pendingDelist) return;
const contractRow = pendingDelist;
const isOutOfContract = contractRow.contractStatus === CONTRACT_STATUS.OUT_OF_CONTRACT;
const capTreatment = isOutOfContract
? "Their salary will be removed from the cap."
: "Their current salary will continue to count against the cap until the contract expires.";
setContractStates((previous) => ({
...previous,
[String(contractRow.playerId)]: {
...(previous[String(contractRow.playerId)] ?? {}),
club: selectedClubName,
delisted: true,
...(isOutOfContract ? { salary: 0, yearsRemaining: 0 } : {}),
},
}));
setNegotiationMessage(`${contractRow.player} has been delisted. ${capTreatment}`);
setPendingDelist(null);
};
const selectedPlayer = selectedContract?.playerWithStaff;

function openDelegation(contractRow) {
const existing = contractDelegations[String(contractRow.playerId)];
const opening = Math.max(getMinimumSalary(seasonYear), Math.min(getConfiguredMaximumSalary(seasonYear, administration), Math.round(contractRow.demand * 0.92 / 5000) * 5000));
const ceiling = Math.max(opening, Math.min(getConfiguredMaximumSalary(seasonYear, administration), Math.round(contractRow.demand * 1.12 / 5000) * 5000));
setDelegationPlayerId(String(contractRow.playerId));
setDelegationYears(existing?.years ?? 2);
setDelegationRole(existing?.role ?? "BEST_22");
setDelegationOpeningSalary(existing?.openingSalary ?? opening);
setDelegationMaxSalary(existing?.maxSalary ?? ceiling);
setDelegationStructure(existing?.structure ?? "EVEN");
setDelegationError("");
}

function saveDelegation() {
if (!listManager) return setDelegationError("Hire a List Manager before assigning contract talks.");
try {
const instruction = createContractDelegation({
playerId: delegationPlayerId, years: Number(delegationYears),
openingSalary: Number(delegationOpeningSalary), maxSalary: Number(delegationMaxSalary),
role: delegationRole, structure: delegationStructure,
date: dayKey(currentDate ?? new Date()),
});
if (instruction.maxSalary > getConfiguredMaximumSalary(seasonYear, administration)) throw new Error("The maximum offer exceeds the salary limit for this season.");
updateAdministration((current) => ({ ...current,
contractDelegations: { ...(current.contractDelegations ?? {}), [instruction.playerId]: instruction },
}));
setNegotiationMessage(`${listManager.name} will begin talks within your salary, role and contract-length limits as the calendar advances.`);
setDelegationPlayerId(null);
setDelegationError("");
} catch (error) {
setDelegationError(error.message);
}
}

function cancelDelegation(playerId) {
updateAdministration((current) => ({ ...current, contractDelegations: {
...(current.contractDelegations ?? {}),
[String(playerId)]: { ...(current.contractDelegations?.[String(playerId)] ?? {}), status: "CANCELLED", nextActionOn: null, message: "You ended these delegated talks." },
} }));
}

// Initialize offer form when a player is selected.
useEffect(() => {
if (selectedContract) {
setOfferComponents(normalizeContractComponents(selectedContract.playerObj?.contract ?? {}));
setOfferSchedule(buildSalarySchedule(
Math.round(selectedContract.demand / 5000) * 5000,
1,
"EVEN",
scheduleOptions,
));
setOfferRole("BEST_22");
setOfferPromises([]);
setLastEvaluation(null);
setLastCounter(selectedContract.negotiation.counterOffer ?? null);
setCounterRevisionAvailable(Boolean(selectedContract.negotiation.counterOffer) && !selectedContract.negotiation.counterRevisionUsed);
setCounterRevisionUsed(Boolean(selectedContract.negotiation.counterRevisionUsed));
}
}, [selectedPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

function handleEvaluate() {
if (!selectedPlayer) return;
if (recentlySigned(selectedPlayer.id)) {
setNegotiationMessage("This player signed within the past three months and cannot negotiate another contract yet.");
setTab("CONTRACTS");
return;
}
const negotiation = selectedContract.negotiation;
const currentRound = Number(seasonState.round ?? 1);
const currentTime = Date.parse(currentDate ?? "");
const retryTime = Date.parse(negotiation.cooldownUntilDate ?? "");
const dateCooldownActive = Number.isFinite(currentTime) && Number.isFinite(retryTime) && currentTime < retryTime;
if (dateCooldownActive && !counterRevisionAvailable) {
setNegotiationMessage(`The agent has closed negotiations for 12 weeks. You can try again from ${new Date(retryTime).toLocaleDateString()}.`);
return;
}
if (currentRound < Number(negotiation.cooldownUntilRound ?? 0) && !counterRevisionAvailable) {
setNegotiationMessage(`The player's agent will not negotiate again until Round ${negotiation.cooldownUntilRound}.`);
return;
}
if (Number(negotiation.roundsUsed ?? 0) >= 3 && !counterRevisionAvailable) {
setNegotiationMessage("You have used all three negotiation rounds this season. Try again next season.");
return;
}

const structureCheck = validateContractStructure(offerSchedule, { seasonYear, administrationState: administration });
if (!structureCheck.ok) {
setNegotiationMessage(structureCheck.errors[0]);
return;
}
// Only this season's salary counts against this season's cap.
const extensionTerms = getExtensionTerms(offerSchedule);
const components = normalizeContractComponents(offerComponents);
const oldExtras = projectedContractExtras(selectedContract.playerObj?.contract ?? {});
const payrollCheck = checkPayrollChange({ playerPayments, currentSalary: selectedContract.salary + oldExtras, newSalary: extensionTerms.salary + projectedContractExtras(components), seasonYear, administrationState: administration });
if (!payrollCheck.ok) {
setNegotiationMessage(`This year's salary would put player payments at ${formatMoney(payrollCheck.projected)}, above the ${formatMoney(payrollCheck.salaryCap)} salary cap.`);
return;
}
const futureCheck = checkClubCommitments(playerPool, { ...playerContracts, [String(selectedPlayer.id)]: { ...(playerContracts[String(selectedPlayer.id)] ?? {}), ...extensionTerms, ...components } }, selectedClubName, seasonYear, 0, administration);
if (!futureCheck.ok) {
setNegotiationMessage(futureCheck.reason);
return;
}

const offer = {
salary: offerSalary,
yearlySalaries: offerSchedule,
years: offerYears,
role: offerRole,
clubName: selectedClubName,
promises: offerPromises,
...components,
};

const evaluationContext = {
demandIncrease: Number(negotiation.demandIncrease ?? 0) + Number(negotiation.agentHostility ?? 0) * 0.001,
clubContext: negotiationContext,
seasonYear,
};
const evaluation = evaluateOffer(selectedPlayer, offer, evaluationContext);
if (counterRevisionAvailable) {
setCounterRevisionAvailable(false);
setCounterRevisionUsed(true);
}
const nextNegotiation = {
...negotiation,
pendingOffer: null,
counterRevisionUsed: Boolean(negotiation.counterRevisionUsed || counterRevisionAvailable),
seasonYear,
roundsUsed: Number(negotiation.roundsUsed ?? 0) + 1,
lastAttemptRound: currentRound,
...(Number(negotiation.roundsUsed ?? 0) + 1 >= 3 ? { cooldownUntilDate: new Date((Number.isFinite(currentTime) ? currentTime : Date.now()) + 84 * 24 * 60 * 60 * 1000).toISOString() } : {}),
};
// fields: { terms, mood, negotiation }. Terms (salary, years, role, promises) and mood
// (leave-desire delta, relationship changes) are stored separately on the record.
const saveNegotiation = (fields = {}) => setContractStates((prev) => ({
...prev,
[selectedPlayer.id]: updateContractRecord(prev[selectedPlayer.id], { negotiation: nextNegotiation, ...fields }),
}));

setLastEvaluation(evaluation);

const outcomeInfo = getOutcomeLabel(evaluation.outcome);

if (evaluation.outcome === negotiationOutcomes.ACCEPT) {
// Accept — update contract state.
saveNegotiation({
terms: {
salary: extensionTerms.salary,
yearlySalaries: extensionTerms.yearlySalaries,
yearsRemaining: extensionTerms.yearsRemaining,
role: offerRole,
promises: createPromises(offerPromises, { seasonYear, round: currentRound, years: offerYears }),
signedSeason: seasonYear,
lastExtendedYear: seasonYear,
...components,
conditionalBaselineSeason: seasonYear,
conditionalBaselineGames: gamesForPlayerInSeason(seasonState, selectedPlayer.id),
conditionalBonusStartSeason: ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase) ? seasonYear + 1 : seasonYear,
triggerActivated: false,
triggerSeasonsCount: 0,
triggerGamesPreviousSeason: 0,
triggerStartSeason: ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase) ? seasonYear + 1 : seasonYear,
lastSignedAt: new Date(currentDate ?? Date.now()).toISOString(),
},
mood: adjustLeaveDesire(selectedPlayer, contractStates[selectedPlayer.id] ?? {}, -20, leaveContext),
negotiation: { ...nextNegotiation, counterOffer: null, demandIncrease: 0, agentHostility: Math.max(0, Number(negotiation.agentHostility ?? 0) - 15), cooldownUntilRound: 0, cooldownUntilDate: null },
});
syncCashBeforePayrollChange();
setNegotiationMessage(`${selectedPlayer.name} ${outcomeInfo.message}! ${extensionTerms.existingYears ? `The ${offerYears}-year extension has been added to their existing deal (${extensionTerms.yearsRemaining} years remaining).` : `They have signed a ${offerYears}-year contract.`} Score: ${evaluation.score}/100${payrollCheck.belowMinimum ? ` Player payments are below the ${formatMoney(payrollCheck.minimumSpend)} minimum spend; restore compliance before the season ends.` : ""}`);
setLastCounter(null);
setSelectedPlayerId(null);
setTab("CONTRACTS");
} else if (nextNegotiation.roundsUsed >= 3) {
saveNegotiation({ negotiation: { ...nextNegotiation, counterOffer: null } });
setLastCounter(null);
setSelectedPlayerId(null);
setNegotiationMessage(`${selectedPlayer.name} has used all three negotiation rounds. Talks can resume after the cooldown.`);
setTab("CONTRACTS");
} else if (evaluation.outcome === negotiationOutcomes.COUNTER) {
const counter = generateCounterOffer(selectedPlayer, offer, evaluationContext);
if (counter.salary < selectedContract.demand) {
// The agent never asks for less than his current demand: rebuild the schedule at that average, keeping its shape.
counter.salary = selectedContract.demand;
counter.yearlySalaries = buildSalarySchedule(counter.salary, counter.years, getScheduleShape(counter.yearlySalaries), scheduleOptions);
}
saveNegotiation({ negotiation: { ...nextNegotiation, counterOffer: counter } });
setLastCounter(counter);
if (Array.isArray(counter.promises)) setOfferPromises(counter.promises);
if (!counterRevisionUsed) setCounterRevisionAvailable(true);
setNegotiationMessage(
`${selectedPlayer.name}'s agent countered: $${counter.salary.toLocaleString()}/year average for ${counter.years} years (${STRUCTURE_LABELS[describeStructure(counter.yearlySalaries)].toLowerCase()}). Score: ${evaluation.score}/100.`
);
} else if (evaluation.outcome === negotiationOutcomes.CONSIDER) {
const dueDate = new Date(currentDate ?? Date.now());
dueDate.setDate(dueDate.getDate() + 3);
const pendingOffer = {
submittedOn: dayKey(currentDate ?? new Date()),
dueDate: dayKey(dueDate),
score: evaluation.score,
clubName: selectedClubName,
terms: {
salary: extensionTerms.salary,
yearlySalaries: extensionTerms.yearlySalaries,
yearsRemaining: extensionTerms.yearsRemaining,
role: offerRole,
promises: createPromises(offerPromises, { seasonYear, round: currentRound, years: offerYears }),
signedSeason: seasonYear,
lastExtendedYear: seasonYear,
...components,
},
};
saveNegotiation({ negotiation: { ...nextNegotiation, counterOffer: null, pendingOffer } });
setLastCounter(null);
setNegotiationMessage(
`${selectedPlayer.name} is considering your offer until ${dueDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}. You can improve or withdraw it before they respond.`
);
} else {
// Reject — salary demands increase.
const updatedDemand = Math.round((selectedContract.marketValue * (1 + Number(negotiation.demandIncrease ?? 0) + 0.08 + (Number(negotiation.agentHostility ?? 0) + 15) * 0.001)) / 5000) * 5000;
setOfferAverage(updatedDemand);
saveNegotiation({
mood: adjustLeaveDesire(selectedPlayer, contractStates[selectedPlayer.id] ?? {}, +10, leaveContext),
negotiation: {
...nextNegotiation,
demandIncrease: Number(negotiation.demandIncrease ?? 0) + 0.08,
agentHostility: Math.min(60, Number(negotiation.agentHostility ?? 0) + 15),
cooldownUntilRound: currentRound + 2,
counterOffer: null,
},
});
setLastCounter(null);
setNegotiationMessage(
`${selectedPlayer.name} ${outcomeInfo.message}. Score: ${evaluation.score}/100 — relationship strained.`
);
}
}

function handleAcceptCounter() {
if (!lastCounter || !selectedPlayer) return;
if (recentlySigned(selectedPlayer.id)) {
setNegotiationMessage("This player signed within the past three months and cannot negotiate another contract yet.");
setTab("CONTRACTS");
return;
}

const counterSchedule = lastCounter.yearlySalaries?.length ? lastCounter.yearlySalaries : Array.from({ length: lastCounter.years }, () => lastCounter.salary);
const extensionTerms = getExtensionTerms(counterSchedule);
const components = normalizeContractComponents(offerComponents);
const counterOffer = {
clubName: selectedClubName,
salary: lastCounter.salary,
yearlySalaries: counterSchedule,
years: lastCounter.years,
role: lastCounter.role ?? offerRole,
promises: offerPromises,
...components,
};
const counterEvaluation = evaluateOffer(selectedPlayer, counterOffer, {
demandIncrease: Number(selectedContract?.negotiation?.demandIncrease ?? 0) + Number(selectedContract?.negotiation?.agentHostility ?? 0) * 0.001,
clubContext: negotiationContext,
seasonYear,
deterministic: true,
});
if (counterEvaluation.outcome !== negotiationOutcomes.ACCEPT) {
setNegotiationMessage(`${selectedPlayer.name}'s proposed terms no longer meet their acceptance threshold (${counterEvaluation.score}/100). You can revise the offer or reject these terms.`);
return;
}
const oldExtras = projectedContractExtras(selectedContract.playerObj?.contract ?? {});
const payrollCheck = checkPayrollChange({ playerPayments, currentSalary: selectedContract.salary + oldExtras, newSalary: extensionTerms.salary + projectedContractExtras(components), seasonYear, administrationState: administration });
if (!payrollCheck.ok) {
setNegotiationMessage(`The counter-offer would put player payments at ${formatMoney(payrollCheck.projected)}, above the ${formatMoney(payrollCheck.salaryCap)} salary cap.`);
return;
}
const futureCheck = checkClubCommitments(playerPool, { ...playerContracts, [String(selectedPlayer.id)]: { ...(playerContracts[String(selectedPlayer.id)] ?? {}), ...extensionTerms, ...components } }, selectedClubName, seasonYear, 0, administration);
if (!futureCheck.ok) {
setNegotiationMessage(futureCheck.reason);
return;
}

const counterMood = adjustLeaveDesire(selectedPlayer, contractStates[selectedPlayer.id] ?? {}, -15, leaveContext);
setContractStates((prev) => ({
...prev,
[selectedPlayer.id]: updateContractRecord(prev[selectedPlayer.id], {
terms: {
salary: extensionTerms.salary,
yearlySalaries: extensionTerms.yearlySalaries,
yearsRemaining: extensionTerms.yearsRemaining,
role: lastCounter.role ?? offerRole,
promises: createPromises(offerPromises, { seasonYear, round: Number(seasonState.round ?? 1), years: lastCounter.years }),
signedSeason: seasonYear,
lastExtendedYear: seasonYear,
...components,
conditionalBaselineSeason: seasonYear,
conditionalBaselineGames: gamesForPlayerInSeason(seasonState, selectedPlayer.id),
conditionalBonusStartSeason: ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase) ? seasonYear + 1 : seasonYear,
triggerActivated: false,
triggerSeasonsCount: 0,
triggerGamesPreviousSeason: 0,
triggerStartSeason: ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase) ? seasonYear + 1 : seasonYear,
lastSignedAt: new Date(currentDate ?? Date.now()).toISOString(),
},
mood: counterMood,
negotiation: { ...selectedContract.negotiation, counterOffer: null, pendingOffer: null },
}),
}));
syncCashBeforePayrollChange();
setNegotiationMessage(
`${selectedPlayer.name} accepted the counter-offer: ${extensionTerms.existingYears ? `${lastCounter.years}-year extension added to the current deal (${extensionTerms.yearsRemaining} years remaining).` : `a ${lastCounter.years}-year contract signed.`}${payrollCheck.belowMinimum ? ` Player payments are below the ${formatMoney(payrollCheck.minimumSpend)} minimum spend; restore compliance before the season ends.` : ""}`
);
setLastCounter(null);
setCounterRevisionAvailable(false);
setLastEvaluation(null);
setSelectedPlayerId(null);
setTab("CONTRACTS");
}

function handleRequestPlayerCounter() {
if (!selectedPlayer || !lastEvaluation || lastCounter || counterRevisionUsed) return;
const offer = { clubName: selectedClubName, salary: offerSalary, years: offerYears,
yearlySalaries: offerSchedule, role: offerRole, promises: offerPromises, ...normalizeContractComponents(offerComponents) };
const counter = generateCounterOffer(selectedPlayer, offer, {
deterministic: true,
demandIncrease: Number(selectedContract?.negotiation?.demandIncrease ?? 0) + Number(selectedContract?.negotiation?.agentHostility ?? 0) * 0.001,
clubContext: negotiationContext,
seasonYear,
});
if (!counter.acceptable) {
const reasons = counter.shortfalls?.length ? ` The player ${counter.shortfalls.join(" and ")}.` : "";
setNegotiationMessage(`${selectedPlayer.name}'s agent cannot find acceptable terms within a reasonable salary range.${reasons} Improve the role, add suitable promises or incentives, or adjust the contract and try again.`);
return;
}
const schedule = counter.yearlySalaries?.length
? counter.yearlySalaries
: buildSalarySchedule(counter.salary, counter.years, "EVEN", scheduleOptions);
setOfferSchedule(schedule);
setOfferRole(counter.role ?? offerRole);
if (Array.isArray(counter.promises)) setOfferPromises(counter.promises);
setLastCounter(counter);
setCounterRevisionAvailable(true);
setContractStates((previous) => ({ ...previous,
[selectedPlayer.id]: updateContractRecord(previous[selectedPlayer.id], {
negotiation: { ...(previous[selectedPlayer.id]?.negotiation ?? {}), counterOffer: counter, pendingOffer: null },
}),
}));
setNegotiationMessage(`${selectedPlayer.name} has proposed ${formatMoney(counter.salary)}/year for ${counter.years} years. Their terms score ${counter.evaluationScore}/100 against the same factors used for your offers; you can revise them or accept the counter.`);
}

function handleRejectPlayerCounter() {
if (!selectedPlayer || !lastCounter) return;
setLastCounter(null);
setCounterRevisionAvailable(false);
setContractStates((previous) => ({ ...previous,
[selectedPlayer.id]: updateContractRecord(previous[selectedPlayer.id], {
negotiation: { ...(previous[selectedPlayer.id]?.negotiation ?? {}), counterOffer: null },
}),
}));
setNegotiationMessage(`${selectedPlayer.name}'s requested terms were declined. You can revise your offer while negotiations remain open.`);
}

function handleWithdrawPendingOffer() {
if (!selectedPlayer || !selectedContract?.negotiation?.pendingOffer) return;
setContractStates((previous) => ({ ...previous,
[selectedPlayer.id]: updateContractRecord(previous[selectedPlayer.id], {
negotiation: { ...(previous[selectedPlayer.id]?.negotiation ?? {}), pendingOffer: null },
}),
}));
setNegotiationMessage(`You withdrew the offer to ${selectedPlayer.name}.`);
}

function upgradeFacility(facilityName) {
const facility = getFacilityDefinitions(facilities, { rosterSize: clubPlayers.length, staff }).find((item) => item.name === facilityName);
if (!facility || facility.level >= MAX_FACILITY_LEVEL) return;
if (administration.facilityProjects?.[facility.id]) {
setNegotiationMessage(`${facilityName} already has an upgrade under way.`);
return;
}
const nextCost = getFacilityUpgradeCost(facility);
if (finance.cashBalance < nextCost) {
setNegotiationMessage("Insufficient cash available.");
return;
}
const startDate = toDayString(seasonState.calendarClock?.date ?? currentDate);
const started = startFacilityProject({}, facility, startDate).facilityProjects[facility.id];
updateAdministration((current) => ({
...startFacilityProject(current, facility, startDate),
cashBalance: Math.round(finance.cashBalance - nextCost),
lastAccruedRound: Math.max(0, Number(seasonState.round ?? 1) - 1),
lastAccruedSeason: Number(seasonState.seasonYear ?? 2027),
}));
setNegotiationMessage(`${facilityName} upgrade to level ${facility.level + 1} started. It will be ready on ${started.completesAt} (${started.days} days).`);
}

function acceptSponsorshipOffer(offer) {
if (commercial.activeSponsor) return;
const comparable = (item) => Number(item.expectedTotalValue ?? item.totalValue ?? item.annualValue * item.years);
const bestOffer = (commercial.offers ?? []).reduce((best, item) => Math.max(best, comparable(item)), 0);
const belowExpectation = comparable(offer) < bestOffer * 0.88;
const upfront = Math.max(0, Number(offer.upfrontPayment ?? 0));
// Bonuses only count over full seasons: a deal signed once the season is under way starts earning them next year.
const incentivesStartSeason = Number(seasonState.round ?? 1) > 1 ? seasonYear + 1 : seasonYear;
const supporterSatisfaction = Math.max(0, Math.min(100,
Number(commercial.supporterSatisfaction ?? 68) + Number(offer.sentiment ?? 0)));
const boardSatisfaction = Math.max(0, Math.min(100,
Number(commercial.boardSatisfaction ?? 70) + (belowExpectation ? -8 : 2) + (offer.type === "controversial" ? -3 : 0)));
updateAdministration((current) => ({
...current,
cashBalance: Math.round(Number(current.cashBalance ?? 0) + upfront),
commercial: {
...current.commercial,
activeSponsor: { ...offer, remainingYears: offer.years, incentivesStartSeason },
offers: [],
counterOffers: {},
supporterSatisfaction,
boardSatisfaction,
reputation: Math.max(0, Math.min(100, Number(current.commercial?.reputation ?? 70) + Number(offer.reputation ?? 0))),
},
}));
const startsLater = (offer.incentives ?? []).length > 0 && incentivesStartSeason > seasonYear;
setNegotiationMessage(`Deal signed with ${offer.name}${upfront ? `; ${formatMoney(upfront)} received on signing` : ""}.${belowExpectation ? " The board expected a higher-value offer." : ""}${startsLater ? ` Season bonuses start from ${incentivesStartSeason}.` : ""}`);
}

function requestSponsorCounter(offer, request) {
if (commercial.activeSponsor || commercial.counterOffers?.[offer.offerId]) return;
const counter = buildSponsorCounter(offer, request, { reputation: Number(commercial.reputation ?? 65) });
if (!counter) return;
updateAdministration((current) => ({
...current,
commercial: { ...current.commercial, counterOffers: { ...(current.commercial?.counterOffers ?? {}), [offer.offerId]: counter } },
}));
}

function terminateSponsor() {
const sponsor = commercial.activeSponsor;
if (!sponsor) return;
const terminationFee = sponsorTerminationFee(sponsor);
const replacementOffers = generateSponsorshipOffers(club, clubPlayers, seasonYear, {
cashBalance: finance.cashBalance,
memberships: commercial.memberships,
reputation: commercial.reputation,
recentSuccess: finance.recentSuccess * 100,
premiershipWindow: Number(commercial.reputation ?? clubProfiles[String(typeof club === "string" ? club : club?.name ?? "").replace(/\s+/g, "_").toUpperCase()]?.footballPrestige ?? 70),
midSeason: Number(seasonState.round ?? 1) > 1,
});
updateAdministration((current) => ({
...current,
cashBalance: Math.round(finance.cashBalance - terminationFee),
lastAccruedRound: Math.max(0, Number(seasonState.round ?? 1) - 1),
lastAccruedSeason: seasonYear,
commercial: {
...current.commercial,
activeSponsor: null,
offers: replacementOffers,
counterOffers: {},
supporterSatisfaction: Math.max(0, Math.min(100, Number(current.commercial?.supporterSatisfaction ?? 68) + (sponsor.type === "controversial" ? 4 : 0))),
boardSatisfaction: Math.max(0, Number(current.commercial?.boardSatisfaction ?? 70) - 8),
},
}));
setNegotiationMessage(`Partnership ended. Early termination cost: ${formatMoney(terminationFee)}; board confidence falls.`);
}

function updateTicketPrice(value) {
const ticketPrice = Math.max(25, Math.min(100, Number(value)));
const priceDelta = ticketPrice - Number(commercial.ticketPrice ?? 48);
updateAdministration((current) => ({
...current,
commercial: {
...current.commercial,
ticketPrice,
supporterSatisfaction: Math.max(0, Math.min(100, Number(current.commercial?.supporterSatisfaction ?? 68) - Math.round(priceDelta * 0.35))),
},
}));
}

// A rival matches any offer under 135% of the player's current salary, provided it can afford and fit the deal.
function rivalMatchInfo(person, fromClub, salary, years) {
const threshold = Math.ceil(Number(person.salary ?? 0) * 1.35 / 5000) * 5000;
const rival = fromClub ? seasonState.leagueAdministration?.[fromClub] : null;
if (!fromClub || !rival) return { threshold, wouldMatch: false, canDefend: false };
const canDefend = Number(rival.cashBalance ?? 0) >= Number(person.salary ?? 0) * 2
&& staffContractFitsCap(rival, (rival.staff ?? []).map((member) => String(member.id) === String(person.id) ? signStaff(member, salary, years, currentDate) : member), objectiveYear).allowed;
return { threshold, canDefend, wouldMatch: salary < threshold && canDefend };
}

function openStaffOffer(person, fromClub = null, renewing = false) {
setStaffOfferTarget({ person, fromClub, renewing });
const desired = staffDesiredTerms(person, Boolean(fromClub));
setStaffOfferSalary(desired.salary);
setStaffOfferYears(desired.years);
}

function renderStaffOfferPanel() {
if (!staffOfferTarget) return null;
const { person, fromClub, renewing } = staffOfferTarget;
const desired = staffDesiredTerms(person, Boolean(fromClub));
const salary = Math.round(Number(staffOfferSalary)) || 0;
const years = Math.round(Number(staffOfferYears)) || desired.years;
const meetsTerms = salary >= desired.salary;
const match = fromClub && !renewing ? rivalMatchInfo(person, fromClub, salary, years) : null;
const outgoing = renewing ? null : replaceStaffInRole(staff, person).outgoing;
const costs = renewing ? null : staffAppointmentCosts(person, salary, outgoing, Boolean(fromClub));
const canPay = !costs || Number(administration.cashBalance ?? finance.cashBalance) >= costs.total;
const offerBudget = budgetForOffer(person, salary, renewing);
const stepButton = { width: 34, height: 34, border: "1px solid #334155", borderRadius: 8, background: "#1e293b", color: "white", fontSize: 18, fontWeight: 800, cursor: "pointer" };
return <div style={{ marginTop: 12, padding: 14, background: "#0f172a", border: "1px solid #ea580c", borderRadius: 10, textAlign: "left" }}>
<p style={{ margin: "0 0 6px", color: "#e2e8f0" }}>
{fromClub ? `To move from ${fromClub} ${person.name} wants at least ` : `${person.name} wants at least `}
<strong>{formatMoney(desired.salary)}</strong> a year on a <strong>{desired.years}-season</strong> deal.
</p>
<p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 13 }}>
{fromClub
? (costs.poachingCompensation ? `${formatMoney(costs.poachingCompensation)} compensation is payable to ${fromClub}.` : "Out of contract: no compensation to their former club.")
: renewing ? "Renewing carries no signing fee." : "Unattached: no payment to another club."}
{costs && ` Signing fee ${formatMoney(costs.signingFee)}.`}
{outgoing && ` Releasing ${outgoing.name} costs ${formatMoney(costs.replacementSeverance)} in severance and reduces board satisfaction by 2 points.`}
{costs && ` Total upfront cost: ${formatMoney(costs.total)}.`}
</p>
<div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<button type="button" aria-label="Decrease salary" style={stepButton} onClick={() => setStaffOfferSalary(Math.max(0, salary - 5000))}>−</button>
<strong style={{ minWidth: 92, textAlign: "center", fontSize: 18, color: meetsTerms ? "#f8fafc" : "#fbbf24" }}>{formatMoney(salary)}</strong>
<button type="button" aria-label="Increase salary" style={stepButton} onClick={() => setStaffOfferSalary(salary + 5000)}>+</button>
</div>
<div style={{ display: "flex", gap: 4, padding: 3, border: "1px solid #334155", borderRadius: 9, background: "#1e293b" }}>
{[1, 2, 3, 4, 5].map((option) => <button key={option} type="button" onClick={() => setStaffOfferYears(option)} aria-pressed={years === option} style={{ padding: "7px 10px", border: 0, borderRadius: 7, background: years === option ? "#ea580c" : "transparent", color: "white", fontWeight: 700, cursor: "pointer" }}>{option} season{option === 1 ? "" : "s"}</button>)}
</div>
</div>
{match && (
<div style={{ margin: "10px 0 0", fontSize: 13 }}>
<p style={{ margin: 0, color: match.wouldMatch ? "#fb7185" : "#34d399" }}>
{match.wouldMatch
? `${fromClub} would match this offer and keep ${person.name}.`
: match.canDefend ? `${fromClub} cannot match this offer, so ${person.name} would join you.` : `${fromClub} cannot afford to match, so ${person.name} would join you.`}
</p>
<p style={{ margin: "4px 0 0", color: "#94a3b8" }}>
{match.canDefend || match.wouldMatch
? `${fromClub} can match any offer below ${formatMoney(match.threshold)} a year.`
: `${fromClub} lacks the cash or cap room to defend ${person.name}.`}
{match.canDefend && salary < match.threshold && <> <button type="button" onClick={() => setStaffOfferSalary(match.threshold)} style={{ marginLeft: 6, padding: "3px 8px", border: "1px solid #334155", borderRadius: 6, background: "#1e293b", color: "#f8fafc", cursor: "pointer", fontSize: 12 }}>Set to {formatMoney(match.threshold)}</button></>}
</p>
</div>
)}
{!meetsTerms && <p style={{ margin: "10px 0 0", color: "#fbbf24", fontSize: 13 }}>Below the {formatMoney(desired.salary)} they are asking for. They will not sign for less.</p>}
{!canPay && <p style={{ margin: "10px 0 0", color: "#fb7185", fontSize: 13 }}>The club needs {formatMoney(costs.total)} in cash to complete this appointment.</p>}
<p style={{ margin: "10px 0 0", color: offerBudget.allowed ? "#34d399" : "#fb7185", fontSize: 13 }}>
Projected counted spend: {formatMoney(offerBudget.counted)} / {formatMoney(offerBudget.cap)} · {offerBudget.room >= 0 ? `${formatMoney(offerBudget.room)} room` : `${formatMoney(-offerBudget.room)} over cap`}
</p>
<div style={{ display: "flex", gap: 8, marginTop: 12 }}>
<button type="button" onClick={() => submitStaffOffer()} disabled={!meetsTerms || !offerBudget.allowed || !canPay} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: meetsTerms && offerBudget.allowed && canPay ? "#16a34a" : "#475569", color: "white", fontWeight: 800, cursor: meetsTerms && offerBudget.allowed && canPay ? "pointer" : "not-allowed" }}>{renewing ? "Renew contract" : fromClub ? "Make the approach" : "Sign contract"}</button>
<button type="button" onClick={() => setStaffOfferTarget(null)} style={{ padding: "9px 12px", border: "1px solid #334155", borderRadius: 8, background: "#1e293b", color: "white", cursor: "pointer" }}>Cancel</button>
</div>
</div>;
}

function submitStaffOffer() {
const target = staffOfferTarget;
if (!target) return;
const { person, fromClub, renewing } = target;
const salary = Math.round(Number(staffOfferSalary));
const years = Math.round(Number(staffOfferYears));
const minimum = staffMinimumOffer(person, Boolean(fromClub));
if (!Number.isFinite(salary) || salary < minimum || years < 1 || years > 5) {
flashStaffNotice(`${person.name} wants at least ${formatMoney(minimum)} a year and a deal of one to five years, so they have not signed.`);
return;
}
const offerBudget = budgetForOffer(person, salary, renewing);
if (!offerBudget.allowed) {
flashStaffNotice(`${person.name} has not signed: this contract would put counted football department spending ${formatMoney(-offerBudget.room)} above the ${formatMoney(offerBudget.cap)} soft cap.`);
return;
}
const outgoing = renewing ? null : replaceStaffInRole(staff, person).outgoing;
const costs = renewing ? null : staffAppointmentCosts(person, salary, outgoing, Boolean(fromClub));
if (costs && Number(administration.cashBalance ?? finance.cashBalance) < costs.total) {
flashStaffNotice(`${person.name} has not signed: you need ${formatMoney(costs.total)} in club cash to complete this appointment${outgoing ? `, including ${formatMoney(costs.replacementSeverance)} severance for ${outgoing.name}` : ""}.`);
return;
}
const compensation = costs?.poachingCompensation ?? 0;
const signingCost = costs?.signingFee ?? 0;
const replacementSeverance = costs?.replacementSeverance ?? 0;
const targetPosition = !renewing && (staffPositions.find((position) => position.key === staffPositionTarget && position.role === person.role && !position.person)
?? (outgoing ? staffPositions.find((position) => String(position.person?.id) === String(outgoing.id)) : null)
?? staffPositions.find((position) => position.role === person.role && !position.person));
const signed = { ...signStaff(person, salary, years, currentDate),
...(!renewing && targetPosition ? { staffPositionKey: targetPosition.key } : {}) };
const rivalCanMatch = rivalMatchInfo(person, fromClub, salary, years).wouldMatch;
if (renewing) {
updateAdministration((current) => ({ ...current, staff: current.staff.map((item) => item.id === person.id ? signed : item) }));
} else if (fromClub && onStaffMarketChange) {
onStaffMarketChange((previous) => {
const home = previous.clubAdministration ?? administration;
const other = previous.leagueAdministration?.[fromClub];
if (!other?.staff?.some((item) => item.id === person.id)) return previous;
// A rival that matches retains the staff member on the matched contract terms.
if (rivalCanMatch) {
const rival = previous.leagueAdministration?.[fromClub];
if (!rival?.staff?.some((item) => String(item.id) === String(person.id))) return previous;
const updatedRival = {
...rival,
staff: rival.staff.map((item) => String(item.id) === String(person.id) ? signStaff(item, salary, years, currentDate) : item),
};
return {
...previous,
leagueAdministration: { ...(previous.leagueAdministration ?? {}), [fromClub]: updatedRival },
};
}
const replacement = replaceStaffInRole(home.staff ?? [], signed);
const updatedHome = {
...home,
cashBalance: Math.round(Number(home.cashBalance ?? finance.cashBalance) - compensation - signingCost - replacementSeverance),
staff: replacement.staff,
staffPool: replacement.outgoing ? [...(home.staffPool ?? []), { ...replacement.outgoing, contractYearsRemaining: 0, marketOrigin: "released" }] : home.staffPool,
commercial: replacement.outgoing ? { ...home.commercial, boardSatisfaction: Math.max(0, Number(home.commercial?.boardSatisfaction ?? 70) - 2) } : home.commercial,
};
return {
...previous,
clubAdministration: updatedHome,
leagueAdministration: {
...(previous.leagueAdministration ?? {}),
[selectedClubName]: updatedHome,
[fromClub]: { ...other, cashBalance: Number(other.cashBalance ?? 0) + compensation, staff: other.staff.filter((item) => item.id !== person.id) },
},
};
});
} else if (onStaffMarketChange) {
onStaffMarketChange((previous) => {
const home = previous.clubAdministration ?? administration;
const sourceClub = person.marketSourceClub ?? selectedClubName;
const source = sourceClub === selectedClubName ? home : previous.leagueAdministration?.[sourceClub];
if (!source?.staffPool?.some((item) => item.id === person.id)) return previous;
const replacement = replaceStaffInRole(home.staff ?? [], signed);
const updatedHome = {
...home,
cashBalance: Math.round(Number(home.cashBalance ?? finance.cashBalance) - signingCost - replacementSeverance),
staff: replacement.staff,
commercial: replacement.outgoing ? { ...home.commercial, boardSatisfaction: Math.max(0, Number(home.commercial?.boardSatisfaction ?? 70) - 2) } : home.commercial,
staffPool: [
...(home.staffPool ?? []).filter((item) => item.id !== person.id),
...(replacement.outgoing ? [{ ...replacement.outgoing, contractYearsRemaining: 0, marketOrigin: "released" }] : []),
],
};
return {
...previous,
clubAdministration: updatedHome,
leagueAdministration: {
...(previous.leagueAdministration ?? {}),
[selectedClubName]: updatedHome,
...(sourceClub !== selectedClubName ? { [sourceClub]: { ...source, staffPool: source.staffPool.filter((item) => item.id !== person.id) } } : {}),
},
};
});
} else {
updateAdministration((current) => {
const replacement = replaceStaffInRole(current.staff ?? [], signed);
return {
...current,
cashBalance: Math.round(Number(current.cashBalance ?? finance.cashBalance) - signingCost - replacementSeverance),
staff: replacement.staff,
commercial: replacement.outgoing ? { ...current.commercial, boardSatisfaction: Math.max(0, Number(current.commercial?.boardSatisfaction ?? 70) - 2) } : current.commercial,
staffPool: [
...(current.staffPool ?? []).filter((item) => item.id !== person.id),
...(replacement.outgoing ? [{ ...replacement.outgoing, marketOrigin: "released" }] : []),
],
};
});
}
setStaffOfferTarget(null);
setStaffPositionTarget(null);
if (rivalCanMatch) {
flashStaffNotice(`${fromClub} matched your ${formatMoney(salary)}/year offer. ${person.name} remains there on the improved ${years}-season contract. Offer at least ${formatMoney(rivalMatchInfo(person, fromClub, salary, years).threshold)} a year to beat a match.`);
return;
}
flashStaffNotice(`${person.name} ${renewing ? "renewed" : "signed"} for ${years} seasons at ${formatMoney(salary)} a year${compensation ? `; ${formatMoney(compensation)} compensation paid to ${fromClub}` : ""}${outgoing ? `; ${outgoing.name} released for ${formatMoney(replacementSeverance)} severance` : ""}.`, "success");
}

function fireStaff(person) {
if (!(administration.staff ?? []).some((member) => String(member.id) === String(person.id))) {
setPendingStaffFire(null);
return;
}
const severance = staffSeverance(person);
if (Number(administration.cashBalance ?? 0) < severance) {
setNegotiationMessage(`You need ${formatMoney(severance)} in club cash to release ${person.name}.`);
setPendingStaffFire(null);
return;
}
updateAdministration((current) => ({
...current,
cashBalance: Math.max(0, Number(current.cashBalance ?? 0) - severance),
staff: (current.staff ?? []).filter((member) => member.id !== person.id),
staffPool: normalizeStaffPool([...(current.staffPool ?? []), { ...person, contractYearsRemaining: 0, marketOrigin: "released" }], selectedClubName, current.staffPoolLastRefreshedAt ?? currentDate, false),
commercial: { ...current.commercial, boardSatisfaction: Math.max(0, Number(current.commercial?.boardSatisfaction ?? 70) - 2) },
}));
setPendingStaffFire(null);
if (String(staffOfferTarget?.person?.id) === String(person.id)) setStaffOfferTarget(null);
setNegotiationMessage(`${person.name} has left the football department. Severance: ${formatMoney(severance)}.`);
}

function openStaffMarketForRole(role, positionKey) {
setStaffRoleFilter(role);
setStaffPositionTarget(positionKey);
setStaffMarketTab(openMarketStaff.some((person) => person.role === role) ? "FREE" : "RIVAL");
setStaffOfferTarget(null);
requestAnimationFrame(() => staffMarketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

// Open the player's negotiation as a modal over the Contracts tab.
function openNegotiation(playerId) {
if (recentlySigned(playerId)) {
setNegotiationMessage("This player signed within the past three months and cannot negotiate another contract yet.");
setTab("CONTRACTS");
return;
}
setSelectedPlayerId(playerId);
setTab("CONTRACTS");
setNegotiationOpen(true);
setNegotiationMessage("");
requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function togglePromise(promiseId) {
setOfferPromises((prev) =>
prev.includes(promiseId) ? prev.filter((p) => p !== promiseId) : [...prev, promiseId]
);
}

function formatMoney(value) {
return `$${Number(value ?? 0).toLocaleString()}`;
}

const selectedEvalSummary = lastEvaluation ? summarizeEvaluation(lastEvaluation) : null;

// Offer checks for the negotiation panel.
const structureCheck = validateContractStructure(offerSchedule, { seasonYear, administrationState: administration });
const offerPayrollCheck = selectedContract
? checkPayrollChange({ playerPayments, currentSalary: selectedContract.salary + projectedContractExtras(selectedContract.playerObj?.contract ?? {}), newSalary: getExtensionTerms(offerSchedule).salary + projectedContractExtras(offerComponents), seasonYear, administrationState: administration })
: null;
const counterSchedulePreview = lastCounter ? (lastCounter.yearlySalaries?.length ? lastCounter.yearlySalaries : [lastCounter.salary]) : null;
const counterCheck = lastCounter && selectedContract
? checkPayrollChange({ playerPayments, currentSalary: selectedContract.salary + projectedContractExtras(selectedContract.playerObj?.contract ?? {}), newSalary: getExtensionTerms(counterSchedulePreview).salary + projectedContractExtras(offerComponents), seasonYear, administrationState: administration })
: null;
const proposedContractSchedule = selectedContract ? getExtensionTerms(offerSchedule).yearlySalaries : [];
const futureCap = selectedContract
? projectCapCommitments(proposedContractSchedule.map((salary, index) => {
const others = contracts
.filter((c) => c.playerId !== selectedContract.playerId)
.reduce((sum, c) => sum + (index < Number(c.years ?? 0) ? getSalaryInSeason({ yearsRemaining: c.years, salary: c.salary, yearlySalaries: c.yearlySalaries }, index) + projectedContractExtras(c.playerObj?.contract ?? {}) : 0), 0);
return others + salary + projectedContractExtras(offerComponents);
}), seasonYear, administration.salaryCapBank, administration)
: [];
const submitBlocked = !selectedContract
|| !counterRevisionAvailable && Number(selectedContract.negotiation.roundsUsed ?? 0) >= 3
&& (() => { const current = Date.parse(currentDate ?? ""); const retry = Date.parse(selectedContract.negotiation.cooldownUntilDate ?? ""); return !(Number.isFinite(current) && Number.isFinite(retry) && current >= retry); })()
|| !counterRevisionAvailable && Number(seasonState.round ?? 1) < Number(selectedContract.negotiation.cooldownUntilRound ?? 0)
|| !counterRevisionAvailable && (() => { const current = Date.parse(currentDate ?? ""); const retry = Date.parse(selectedContract.negotiation.cooldownUntilDate ?? ""); return Number.isFinite(current) && Number.isFinite(retry) && current < retry; })()
|| !structureCheck.ok
|| !offerPayrollCheck?.ok
|| futureCap.some((year) => year.overCap);
const pendingFireSeverance = pendingStaffFire ? staffSeverance(pendingStaffFire) : 0;
const pendingFireBudget = pendingStaffFire
? getStaffBudgetStatus(finance, administration, objectiveYear, staff.filter((person) => String(person.id) !== String(pendingStaffFire.id)))
: null;

return (
<>
{staffFlash && (
<div
style={{ position: "fixed", zIndex: 10001, ...(staffFlashBounds ?? { top: 0, left: 0, right: 0, bottom: 0 }), boxSizing: "border-box", display: "grid", placeItems: "center", padding: 16, pointerEvents: "none" }}
>
<div
key={staffFlash.id}
role={staffFlash.kind === "success" ? "status" : "alert"}
aria-live={staffFlash.kind === "success" ? "polite" : "assertive"}
style={{ pointerEvents: "auto", width: "min(100%, 520px)", boxSizing: "border-box", display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 12, background: staffFlash.kind === "success" ? "#052e16" : "#451a1a", border: `1px solid ${staffFlash.kind === "success" ? "#22c55e" : "#ef4444"}`, color: staffFlash.kind === "success" ? "#bbf7d0" : "#fecaca", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", animation: "staffFlashIn 0.25s ease-out" }}
>
<style>{"@keyframes staffFlashIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }"}</style>
<div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}><strong style={{ display: "block", marginBottom: 2 }}>{staffFlash.kind === "success" ? "Signing complete" : "Signing unsuccessful"}</strong>{staffFlash.text}</div>
<button type="button" aria-label="Dismiss notification" onClick={() => setStaffFlash(null)} style={{ background: "transparent", border: 0, color: "inherit", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
</div>
</div>
)}
{pendingStaffFire && (
<div onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingStaffFire(null); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 20, background: "rgba(2, 6, 23, 0.78)", backdropFilter: "blur(5px)" }}>
<section role="alertdialog" aria-modal="true" aria-labelledby="fire-staff-dialog-title" aria-describedby="fire-staff-dialog-impact" onKeyDown={(event) => { if (event.key === "Escape") setPendingStaffFire(null); }} style={{ width: "min(100%, 500px)", padding: 24, border: "1px solid #fb7185", borderRadius: 16, background: "#0f172a", color: "#f8fafc", boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
<h3 id="fire-staff-dialog-title" style={{ margin: "0 0 8px", fontSize: 20 }}>Fire {pendingStaffFire.name}?</h3>
<p style={{ margin: "0 0 16px", color: "#cbd5e1" }}>{pendingStaffFire.role}</p>
<div id="fire-staff-dialog-impact" style={{ padding: 14, borderRadius: 10, background: "#1e293b", lineHeight: 1.6 }}>
<div><strong>Severance due now:</strong> {formatMoney(pendingFireSeverance)}</div>
<div><strong>Club cash after payment:</strong> {formatMoney(Math.max(0, Number(administration.cashBalance ?? 0) - pendingFireSeverance))}</div>
<div><strong>Board satisfaction:</strong> −2 points</div>
<div><strong>Annual staff payroll:</strong> −{formatMoney(pendingStaffFire.salary)}</div>
<div><strong>Soft cap room gained:</strong> {formatMoney(Math.max(0, Number(pendingFireBudget?.room ?? 0) - staffBudget.room))}</div>
</div>
<p style={{ color: "#94a3b8", lineHeight: 1.5 }}>The position will stay vacant until you fill it. Its coaching or club system effects may weaken: {getStaffRoleImpactLabel(pendingStaffFire.role)}.</p>
{Number(administration.cashBalance ?? 0) < pendingFireSeverance && <p style={{ color: "#fb7185" }}>The club does not have enough cash to pay severance.</p>}
<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
<button type="button" autoFocus onClick={() => setPendingStaffFire(null)} style={{ padding: "10px 16px", border: "1px solid #334155", borderRadius: 9, background: "#1e293b", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
<button type="button" disabled={Number(administration.cashBalance ?? 0) < pendingFireSeverance} onClick={() => fireStaff(pendingStaffFire)} style={{ padding: "10px 16px", border: 0, borderRadius: 9, background: Number(administration.cashBalance ?? 0) < pendingFireSeverance ? "#475569" : "#dc2626", color: "white", fontWeight: 800, cursor: Number(administration.cashBalance ?? 0) < pendingFireSeverance ? "not-allowed" : "pointer" }}>Fire Staff Member</button>
</div>
</section>
</div>
)}
{pendingDelist && (
<div
onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelist(null); }}
style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 20, background: "rgba(2, 6, 23, 0.78)", backdropFilter: "blur(5px)" }}
>
<section role="dialog" aria-modal="true" aria-labelledby="delist-dialog-title" style={{ width: "min(100%, 460px)", padding: 24, border: "1px solid #334155", borderRadius: 16, background: "#0f172a", color: "#f8fafc", boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
<div style={{ width: 42, height: 42, display: "grid", placeItems: "center", marginBottom: 14, borderRadius: 12, background: "#450a0a", color: "#fca5a5", fontSize: 22, fontWeight: 800 }}>!</div>
<h3 id="delist-dialog-title" style={{ margin: "0 0 8px", fontSize: 20 }}>Delist {pendingDelist.player}?</h3>
<p style={{ margin: "0 0 20px", color: "#94a3b8", lineHeight: 1.55 }}>
{pendingDelist.contractStatus === CONTRACT_STATUS.OUT_OF_CONTRACT
? "This player is out of contract, so their salary will be removed from the cap."
: "This player is still contracted. Their current salary will continue to count against the cap until the contract expires."}
</p>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
<button type="button" onClick={() => setPendingDelist(null)} style={{ padding: "10px 16px", border: "1px solid #334155", borderRadius: 9, background: "#1e293b", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
<button type="button" onClick={confirmDelistPlayer} style={{ padding: "10px 16px", border: 0, borderRadius: 9, background: "#dc2626", color: "white", fontWeight: 800, cursor: "pointer" }}>Delist Player</button>
</div>
</section>
</div>
)}
<div ref={topRef} style={{ scrollMarginTop: 12 }} />
<h2>{title}</h2>

{!hideTabs && <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
{tabs.map((currentTab) => (
<button key={currentTab} style={tabStyle(currentTab)} onClick={() => setTab(currentTab)}>
{currentTab === "JOB_MARKET" ? "JOB MARKET" : currentTab}
</button>
))}
</div>}

{tab === "OVERVIEW" && (
<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
{[
["Current cash balance", finance.cashBalance, "#22c55e"],
["Finals prize money this season", finalsPrizeMoney, "#eab308"],
["Income per round", finance.incomeTotalPerRound, "#38bdf8"],
["Expenses per round", finance.expensesTotalPerRound, "#fb7185"],
["Net income per round", finance.netIncomePerRound, finance.netIncomePerRound >= 0 ? "#22c55e" : "#ef4444"],
["Projected end-of-season balance", finance.projectedEndBalance, finance.projectedEndBalance >= 0 ? "#22c55e" : "#ef4444"],
].map(([label, value, color]) => (
<div key={label} style={cardStyle}>
<h3 style={{ marginTop: 0, fontSize: "0.9rem", color: "#94a3b8" }}>{label}</h3>
<strong style={{ fontSize: "1.45rem", color }}>{formatMoney(value)}</strong>
</div>
))}
</div>

<div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Projected cash balance by round</h3>
{(() => {
const firstRound = Math.max(1, Math.min(23, Number(seasonState.round ?? 1)));
const values = Array.from({ length: Math.max(2, 24 - firstRound) }, (_, index) => finance.cashBalance + finance.netIncomePerRound * index);
const min = Math.min(0, ...values);
const max = Math.max(1, ...values);
const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 760},${220 - ((value - min) / Math.max(1, max - min)) * 190}`).join(" ");
return <div style={{ overflowX: "auto" }}>
<svg viewBox="0 0 780 260" role="img" aria-label="Projected cash balance over remaining rounds" style={{ width: "100%", minWidth: 520, height: 250 }}>
<line x1="10" y1="220" x2="770" y2="220" stroke="#475569" strokeDasharray="4 5" />
<line x1="10" y1="25" x2="10" y2="220" stroke="#475569" />
<polyline points={points} transform="translate(10 0)" fill="none" stroke="#34d399" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
<text x="10" y="248" fill="#94a3b8" fontSize="13">Round {firstRound}</text>
<text x="700" y="248" fill="#94a3b8" fontSize="13">Round 23</text>
<text x="18" y="18" fill="#94a3b8" fontSize="13">{formatMoney(max)}</text>
<text x="18" y="215" fill="#94a3b8" fontSize="13">{formatMoney(min)}</text>
</svg>
</div>;
})()}
<p style={{ color: "#94a3b8", marginBottom: 0 }}>Projection assumes current income and spending continue at the same per-round rate.</p>
</div>

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 16 }}>
{[["Income mix", finance.income, "#38bdf8"], ["Expense mix", finance.expenses, "#fb7185"]].map(([title, sources, color]) => {
const total = Object.values(sources).reduce((sum, value) => sum + value, 0) || 1;
return <div key={title} style={cardStyle}>
<h3 style={{ marginTop: 0 }}>{title}</h3>
{Object.entries(sources).map(([source, value]) => {
const share = Math.round(value / total * 100);
return <div key={source} style={{ marginBottom: 12 }}>
<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
<span>{source === "aflDistribution" ? "AFL distribution" : source.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</span>
<strong>{share}% · {formatMoney(value)}</strong>
</div>
<div style={{ height: 7, background: "#1e293b", borderRadius: 8, marginTop: 5 }}>
<div style={{ width: `${share}%`, height: "100%", borderRadius: 8, background: color }} />
</div>
</div>;
})}
</div>;
})}
</div>

<div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
<span>Player payments: <strong>{formatMoney(playerPayments)}</strong></span>
<span>Salary cap: <strong>{finance.capEnforced ? formatMoney(finance.salaryCap) : "Unrestricted"}</strong></span>
{finance.capEnforced && <span>Banked allowance this year: <strong>{formatMoney(finance.capAllowance)}</strong></span>}
{finance.capEnforced && <span>Minimum spend: <strong>{formatMoney(finance.minimumSpend)}</strong></span>}
<span>Cap space: <strong style={{ color: capSpace >= 0 ? "#22c55e" : "#ef4444" }}>{finance.capEnforced ? formatMoney(capSpace) : "Unrestricted"}</strong></span>
</div>
</>
)}

{tab === "CONTRACTS" && (
<>
{clubPlayers.length > 44 && (
<div role="alert" style={{ ...cardStyle, border: "1px solid #ef4444", background: "#450a0a", marginBottom: 16 }}>
<strong style={{ color: "#fecaca" }}>List over limit: {clubPlayers.length}/44 players</strong>
<p style={{ margin: "6px 0 0", color: "#fee2e2" }}>Delist at least {clubPlayers.length - 44} player{clubPlayers.length - 44 === 1 ? "" : "s"} before the season can start.</p>
</div>
)}
<div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
<span>Salary cap {seasonYear}: <strong>{finance.capEnforced ? formatMoney(finance.salaryCap) : "Unrestricted"}</strong></span>
{finance.capEnforced && <span>Banked allowance: <strong>{formatMoney(finance.capAllowance)}</strong></span>}
<span>Available ceiling: <strong>{finance.capEnforced ? formatMoney(finance.effectiveSalaryCap) : "Unrestricted"}</strong></span>
<span>Current player payments: <strong>{formatMoney(playerPayments)}</strong></span>
<span>Combined cap spend: <strong>{formatMoney(finance.combinedPayments)}</strong></span>
<span>Remaining cap space: <strong style={{ color: capSpace >= 0 ? "#22c55e" : "#ef4444" }}>{finance.capEnforced ? formatMoney(capSpace) : "Unrestricted"}</strong></span>
{finance.capEnforced && <span>Minimum spend (95%): <strong>{formatMoney(finance.minimumSpend)}</strong></span>}
{finance.capEnforced && finance.combinedPayments < finance.minimumSpend && <span style={{ color: "#fbbf24" }}>Projected minimum-spend shortfall: <strong>{formatMoney(finance.minimumSpend - finance.combinedPayments)}</strong></span>}
{administration.lastCapSettlement?.shortfall > 0 && <span>Last season minimum-spend payment: <strong>{formatMoney(administration.lastCapSettlement.shortfall)}</strong></span>}
</div>
{finance.capEnforced && finance.salaryCapBank.length > 0 && (
<div style={{ ...cardStyle, marginBottom: 16 }}>
<strong>Banked underspend</strong>
<div style={{ color: "#94a3b8", marginTop: 6 }}>Unused cap may lift one season's ceiling by at most 5%. Each entry expires after four seasons.</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
{finance.salaryCapBank.map((entry) => <span key={entry.seasonYear}>{entry.seasonYear}: {formatMoney(entry.amount)} · expires after {entry.seasonYear + 4}</span>)}
</div>
</div>
)}
{contractReport?.freeAgency?.length > 0 && (() => {
const outcomeLabel = { RE_SIGNED: "Re-signed", RETAINED_AT_PREMIUM: "Kept at a premium", RETAINED_CAP_LIMITED: "Kept on current salary (cap)" };
const broken = (contractReport.promises ?? []).filter((item) => item.status === "BROKEN").length;
return <div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Free agency results · end of {contractReport.seasonYear}</h3>
<p style={{ color: "#94a3b8", marginTop: 0 }}>
{contractReport.freeAgency.length} of your players ran out of contract. Other clubs bid for them and the rest of the league extended {contractReport.extended} players.
{broken > 0 && ` ${broken} broken promise${broken === 1 ? "" : "s"} damaged relationships.`}
</p>
{contractReport.freeAgency.slice(0, 8).map((entry) => (
<div key={entry.playerId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #334155", fontSize: "0.85rem" }}>
<span><strong>{entry.name}</strong> · {outcomeLabel[entry.outcome] ?? entry.outcome}</span>
<span style={{ color: "#94a3b8" }}>{formatMoney(entry.salary)} · {entry.years}y{entry.bestRival ? ` · ${entry.bestRival.clubName} bid higher` : ""}</span>
</div>
))}
{contractReport.freeAgency.length > 8 && <small style={{ color: "#94a3b8" }}>…and {contractReport.freeAgency.length - 8} more.</small>}
</div>;
})()}
{/* Player list */}
<div style={cardStyle}>
<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
<h3 style={{ margin: 0 }}>Player Contracts</h3>
<label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 14 }}>
Sort by
<select
value={contractSort}
onChange={(event) => setContractSort(event.target.value)}
style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc" }}
>
<option value="YEARS_ASC">Years remaining (low to high)</option>
<option value="SALARY_DESC">Salary (high to low)</option>
<option value="SALARY_ASC">Salary (low to high)</option>
</select>
</label>
</div>

{negotiationMessage && (
<div
style={{
background: "#1e293b",
padding: "12px",
borderRadius: "10px",
marginBottom: "16px",
border: "1px solid #475569",
}}
>
{negotiationMessage}
</div>
)}

<div style={{ margin: "14px 0", padding: 14, border: "1px solid #334155", borderRadius: 10, background: "#111e32" }}>
<strong>List Manager · contract extensions</strong>
<div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
{listManager ? `${listManager.name} · ${listManager.rating} OVR. Give a player-specific brief; the manager negotiates on the daily calendar and reports the result. Delegated talks don't use up your negotiation rounds.` : "Hire a List Manager in Administration → Staff to delegate extensions."}
</div>
{delegationPlayerId && (() => {
const target = contracts.find((row) => String(row.playerId) === delegationPlayerId);
return target ? <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
<strong>Brief for {target.player}</strong>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
<label>Extension years
<select value={delegationYears} onChange={(event) => setDelegationYears(Number(event.target.value))} style={{ display: "block", width: "100%", padding: 8, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8 }}>
{[1, 2, 3, 4, 5, 6].map((years) => <option key={years} value={years}>{years} year{years === 1 ? "" : "s"}</option>)}
</select>
</label>
<label>Playing role
<select value={delegationRole} onChange={(event) => setDelegationRole(event.target.value)} style={{ display: "block", width: "100%", padding: 8, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8 }}>
{playingRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
</select>
</label>
<label>Opening salary / year
<input type="number" min={getMinimumSalary(seasonYear)} max={getConfiguredMaximumSalary(seasonYear, administration)} step="5000" value={delegationOpeningSalary} onChange={(event) => setDelegationOpeningSalary(Number(event.target.value))} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 8, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8 }} />
</label>
<label>Maximum salary / year
<input type="number" min={delegationOpeningSalary} max={getConfiguredMaximumSalary(seasonYear, administration)} step="5000" value={delegationMaxSalary} onChange={(event) => setDelegationMaxSalary(Number(event.target.value))} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 8, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8 }} />
</label>
<label>Salary structure
<select value={delegationStructure} onChange={(event) => setDelegationStructure(event.target.value)} style={{ display: "block", width: "100%", padding: 8, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8 }}>
<option value="EVEN">Even</option><option value="FRONT_LOADED">Front-loaded</option><option value="BACK_LOADED">Back-loaded</option>
</select>
</label>
</div>
<small style={{ color: "#94a3b8" }}>This extension is added after {Math.max(0, Number(target.years ?? 0))} existing contract year(s). The manager cannot exceed your limits or the club salary cap.</small>
{delegationError && <span role="alert" style={{ color: "#fca5a5" }}>{delegationError}</span>}
<div style={{ display: "flex", gap: 8 }}>
<button type="button" onClick={saveDelegation} disabled={!listManager} style={{ padding: "8px 12px", border: 0, borderRadius: 8, background: "#ea580c", color: "white", fontWeight: 700, cursor: "pointer" }}>Assign List Manager</button>
<button type="button" onClick={() => setDelegationPlayerId(null)} style={{ padding: "8px 12px", border: "1px solid #475569", borderRadius: 8, background: "#1e293b", color: "white", cursor: "pointer" }}>Cancel</button>
</div>
</div> : null;
})()}
</div>

{sortedContracts.map((c) => (
<div
key={c.playerId}
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
padding: "12px 0",
borderBottom: "1px solid #334155",
cursor: "pointer",
background: selectedPlayerId === c.playerId ? "#1e293b" : "transparent",
borderRadius: selectedPlayerId === c.playerId ? "8px" : "0",
paddingLeft: "8px",
paddingRight: "8px",
transition: "background 0.15s ease",
}}
role="button"
tabIndex={0}
onClick={() => openNegotiation(c.playerId)}
onKeyDown={(event) => {
if (event.key === "Enter" || event.key === " ") {
event.preventDefault();
openNegotiation(c.playerId);
}
}}
>
<div>
<strong>{c.player}</strong>
<div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
{formatContractDuration(c.years, { currentDate, seasonYear: seasonState.seasonYear })} | {formatMoney(c.salary)} guaranteed base this season
{c.schedule.length > 1 && c.structure !== "EVEN" && ` · ${STRUCTURE_LABELS[c.structure]} deal`}
</div>
{projectedContractExtras(c.playerObj?.contract ?? {}) > 0 && <div style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
Up to {formatMoney(projectedContractExtras(c.playerObj.contract))} in match payments and bonuses · maximum cap commitment {formatMoney(c.salary + projectedContractExtras(c.playerObj.contract))}
</div>}
<div style={{ fontSize: "0.8rem", color: "#64748b" }}>
Market: {formatMoney(c.marketValue)} | {c.status}
</div>
<div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
<span style={{ fontSize: "0.75rem", color: c.leaveDesire >= 80 ? "#ef4444" : c.leaveDesire >= 60 ? "#f97316" : c.leaveDesire >= 40 ? "#94a3b8" : c.leaveDesire >= 20 ? "#22c55e" : "#16a34a" }}>
{c.leaveDesire >= 80 ? "Extremely upset" : c.leaveDesire >= 60 ? "Upset" : c.leaveDesire >= 40 ? "Content" : c.leaveDesire >= 20 ? "Happy" : "Very happy"}
</span>
{c.contractStatus === CONTRACT_STATUS.FINAL_YEAR && (
<span style={{ fontSize: "0.75rem", color: "#f59e0b" }}>Final year</span>
)}
{recentlySigned(c.playerId) && <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>Recently signed · available after 3 months</span>}
{c.contractStatus === CONTRACT_STATUS.OUT_OF_CONTRACT && (
<span style={{ fontSize: "0.75rem", color: "#ef4444" }}>Out of contract</span>
)}
{c.contractStatus === CONTRACT_STATUS.UNKNOWN && (
<span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Contract end unknown</span>
)}
{c.personality.agent && (
<span style={{ fontSize: "0.75rem", color: "#8b5cf6" }}>
Agent: {c.personality.agent.label}
</span>
)}
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
<button
type="button"
disabled={recentlySigned(c.playerId)}
onClick={(event) => {
event.stopPropagation();
openNegotiation(c.playerId);
}}
style={{ padding: "6px 12px", border: "none", borderRadius: 8, background: "#ea580c", color: "white", fontWeight: "bold", cursor: recentlySigned(c.playerId) ? "not-allowed" : "pointer", opacity: recentlySigned(c.playerId) ? 0.5 : 1 }}
>
Negotiate
</button>
<button type="button" onClick={(event) => { event.stopPropagation(); openDelegation(c); }}
disabled={!listManager || Number(playerContracts[String(c.playerId)]?.lastExtendedYear) === seasonYear}
style={{ padding: "6px 12px", border: "1px solid #0d9488", borderRadius: 8, background: "#134e4a", color: "white", fontWeight: "bold", cursor: listManager && Number(playerContracts[String(c.playerId)]?.lastExtendedYear) !== seasonYear ? "pointer" : "not-allowed", opacity: listManager && Number(playerContracts[String(c.playerId)]?.lastExtendedYear) !== seasonYear ? 1 : 0.55 }}>
{Number(playerContracts[String(c.playerId)]?.lastExtendedYear) === seasonYear ? "Extended this season" : contractDelegations[String(c.playerId)]?.status === "ACTIVE" ? "Edit brief" : "Delegate extension"}
</button>
{contractDelegations[String(c.playerId)]?.status === "ACTIVE" && <button type="button" onClick={(event) => { event.stopPropagation(); cancelDelegation(c.playerId); }}
style={{ padding: "6px 12px", border: "1px solid #475569", borderRadius: 8, background: "#1e293b", color: "white", cursor: "pointer" }}>Stop talks</button>}
<button
type="button"
onClick={(event) => {
event.stopPropagation();
delistPlayer(c);
}}
style={{ padding: "6px 12px", border: "none", borderRadius: 8, background: "#dc2626", color: "white", fontWeight: "bold", cursor: "pointer" }}
>
Delist
</button>
</div>
{contractDelegations[String(c.playerId)] && <div style={{ marginTop: 6, color: contractDelegations[String(c.playerId)].status === "SIGNED" ? "#4ade80" : "#cbd5e1", fontSize: 12 }}>
List Manager: {contractDelegations[String(c.playerId)].status.toLowerCase().replaceAll("_", " ")} · {contractDelegations[String(c.playerId)].message ?? `Next discussion ${contractDelegations[String(c.playerId)].nextActionOn}`}
</div>}
</div>
<div style={{ textAlign: "right" }}>
<div style={{ fontSize: "0.9rem", color: "#f8fafc", fontWeight: 700 }}>AGE {c.playerObj.age ?? "—"}</div>
<div style={{ fontSize: "0.9rem", color: "#f8fafc", fontWeight: 700 }}>OVR {c.playerObj.overall ?? "—"}</div>
<div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>POT: <PotentialStars player={c.playerObj} size="0.9em" /></div>
</div>
</div>
))}
{delistedPlayers.length > 0 && (
<div style={{ borderTop: "1px solid #334155", marginTop: 12, paddingTop: 12 }}>
<h4 style={{ margin: "0 0 8px", color: "#fca5a5" }}>Delisted · retained salary counts against cap</h4>
{delistedPlayers.map((player) => {
const record = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
const rawYears = record.yearsRemaining ?? player.contract?.yearsRemaining;
const years = rawYears == null ? null : Number(rawYears);
const salary = Number(record.salary ?? player.contract?.salary ?? 0);
return <div key={player.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", color: "#cbd5e1", fontSize: 13 }}>
<span>{player.name} · {formatContractDuration(years, { currentDate, seasonYear: seasonState.seasonYear })}</span>
<strong>{formatMoney(years != null && years <= 0 ? 0 : salary)}</strong>
</div>;
})}
</div>
)}
</div>

</>
)}

{tab === "CONTRACTS" && negotiationOpen && (
<div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNegotiationOpen(false); }}
style={{ position: "fixed", zIndex: 1000, ...(negotiationBounds ?? { top: 0, left: 0, right: 0, bottom: 0 }), boxSizing: "border-box", display: "grid", placeItems: "center", padding: 16, background: "rgba(2, 6, 23, 0.6)" }}>
<section role="dialog" aria-modal="true" aria-label="Contract negotiation" onMouseDown={(event) => event.stopPropagation()}
style={{ width: "min(100%, 980px)", maxHeight: "100%", boxSizing: "border-box", overflowY: "auto", padding: "clamp(16px, 3vw, 28px)", border: "1px solid #475569", borderRadius: 18, background: "#0f172a", color: "#f8fafc", boxShadow: "0 24px 80px rgba(0,0,0,.55)" }}>
<>
<div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 16 }}>
<button
type="button"
onClick={() => setNegotiationOpen(false)}
style={{ padding: "8px 14px", border: "1px solid #334155", borderRadius: 10, background: "#1e293b", color: "white", fontWeight: "bold", cursor: "pointer" }}
>
Close
</button>
<span>Salary cap {seasonYear}: <strong>{finance.capEnforced ? formatMoney(finance.salaryCap) : "Unrestricted"}</strong></span>
<span>Banked allowance: <strong>{formatMoney(finance.capAllowance)}</strong></span>
<span>Player payments: <strong>{formatMoney(playerPayments)}</strong></span>
<span>Cap space: <strong style={{ color: capSpace >= 0 ? "#22c55e" : "#ef4444" }}>{finance.capEnforced ? formatMoney(capSpace) : "Unrestricted"}</strong></span>
</div>
{negotiationMessage && (
<div role="status" style={{ background: "#1e293b", padding: "12px", borderRadius: "10px", marginBottom: "16px", border: "1px solid #475569" }}>
{negotiationMessage}
</div>
)}
<div style={cardStyle}>
{selectedContract ? (
<>
<h3>Negotiate: {selectedContract.player}</h3>

{/* Player profile summary */}
<div style={{ marginBottom: "16px", padding: "12px", background: "#1e293b", borderRadius: "10px" }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.85rem" }}>
<div>Overall: <strong>{selectedPlayer.overall}</strong></div>
<div>Age: <strong>{selectedPlayer.age}</strong></div>
<div>Position: <strong>{selectedPlayer.positions?.join(", ")}</strong></div>
<div>Stage: <strong>{selectedContract.personality.careerStage}</strong></div>
<div>Greed: <strong>{selectedContract.personality.greed}</strong></div>
<div>Loyalty: <strong>{selectedContract.personality.loyalty}</strong></div>
<div>Ambition: <strong>{selectedContract.personality.ambition}</strong></div>
<div>Prem Desire: <strong>{selectedContract.personality.premiershipDesire}</strong></div>
<div>Location: <strong>{selectedContract.locationContentment}/100 · {getLocationLabel(selectedContract.locationContentment)}</strong></div>
<div>Coach Rel: <strong>{selectedContract.coachRelationship}</strong></div>
</div>
{selectedContract.personality.agent && (
<div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#8b5cf6" }}>
Agent: {selectedContract.personality.agent.label} — {selectedContract.personality.agent.description}
</div>
)}
</div>

{/* Market value */}
<div style={{ marginBottom: "12px", fontSize: "0.9rem" }}>
<div style={{ display: "flex", justifyContent: "space-between" }}>
<span>Market Value:</span>
<strong>{formatMoney(selectedContract.marketValue)}</strong>
</div>
<div style={{ display: "flex", justifyContent: "space-between" }}>
<span>Current Salary:</span>
<strong>{formatMoney(selectedContract.salary)}</strong>
</div>
<div style={{ display: "flex", justifyContent: "space-between" }}>
<span>Agent's current demand:</span>
<strong>{formatMoney(selectedContract.demand)}/yr</strong>
</div>
<div style={{ color: "#fbbf24", marginTop: 6 }}>
Negotiation rounds remaining: {Math.max(0, 3 - Number(selectedContract.negotiation.roundsUsed ?? 0))}/3
{Number(seasonState.round ?? 1) < Number(selectedContract.negotiation.cooldownUntilRound ?? 0) && ` · Cooldown until Round ${selectedContract.negotiation.cooldownUntilRound}`}
{(() => { const retry = Date.parse(selectedContract.negotiation.cooldownUntilDate ?? ""); return Number.isFinite(retry) && Date.parse(currentDate ?? "") < retry ? ` · 12-week reset on ${new Date(retry).toLocaleDateString()}` : ""; })()}
</div>
</div>

{selectedContract.negotiation.pendingOffer && (
<div role="status" style={{ marginBottom: 14, padding: 12, border: "1px solid #3b82f6", borderRadius: 10, background: "#10213c" }}>
<strong>Offer under consideration</strong>
<div style={{ marginTop: 5, color: "#cbd5e1", fontSize: 13 }}>
Response due {selectedContract.negotiation.pendingOffer.dueDate}. The player may accept or decline when the calendar advances.
</div>
<div style={{ display: "flex", gap: 8, marginTop: 10 }}>
<button type="button" onClick={handleWithdrawPendingOffer} style={{ padding: "7px 10px", border: "1px solid #64748b", borderRadius: 7, background: "transparent", color: "#e2e8f0", cursor: "pointer" }}>Withdraw offer</button>
<span style={{ alignSelf: "center", color: "#94a3b8", fontSize: 12 }}>Submit revised terms below to improve it.</span>
</div>
</div>
)}

{/* Offer form */}
<div style={{ marginBottom: "16px" }}>
<label htmlFor="offer-average" style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem" }}>
Average annual salary: {formatMoney(offerSalary)}
</label>
<input
id="offer-average"
type="range"
min={getMinimumSalary(seasonYear)}
max={getConfiguredMaximumSalary(seasonYear, administration)}
step="5000"
value={Math.min(getConfiguredMaximumSalary(seasonYear, administration), Math.max(getMinimumSalary(seasonYear), offerSalary))}
onChange={(e) => setOfferAverage(Number(e.target.value))}
style={{ width: "100%", marginBottom: "12px" }}
/>

<label htmlFor="offer-years" style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem" }}>
{Number(selectedContract.years ?? 0) > 0 ? "Extension length" : "Contract length"}: {offerYears} year(s) · {Math.max(0, Number(selectedContract.years ?? 0)) + offerYears} years total after signing
</label>
<input
id="offer-years"
type="range"
min="1"
max="6"
step="1"
value={offerYears}
onChange={(e) => changeOfferYears(Number(e.target.value))}
style={{ width: "100%", marginBottom: "12px" }}
/>

<div style={{ padding: 12, marginBottom: 12, background: "#1e293b", borderRadius: 10, display: "grid", gap: 9 }}>
<strong>Conditional payments and trigger</strong>
<small>Base salary above is guaranteed. Match payments are earned only for senior games played. Incentives count when the award is won.</small>
{[["matchPayments", "perMatch", "Payment per game ($)"], ["matchPayments", "startsAfter", "Games before payment starts"], ["matchPayments", "maxPaidMatches", "Maximum paid games"], ["performanceIncentives", "bestAndFairestTop3", "Club top 3 bonus ($)"], ["performanceIncentives", "bestAndFairestTop5", "Club top 5 bonus ($)"], ["performanceIncentives", "bestAndFairestTop10", "Club top 10 bonus ($)"], ["performanceIncentives", "brownlow", "Brownlow bonus ($)"], ["performanceIncentives", "coleman", "Coleman bonus ($)"], ["triggerClause", "gamesAcrossTwoSeasons", "Games over two seasons for an extra year"]].map(([group, key, label]) => (
<label key={`${group}-${key}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>{label}
<input type="number" min="0" step={key.includes("Games") || key === "startsAfter" ? "1" : "1000"} value={offerComponents[group][key]} onChange={(event) => changeComponent(group, key, event.target.value)} style={{ width: 110, padding: 6, background: "#0f172a", color: "white", border: "1px solid #475569", borderRadius: 6 }} />
</label>
))}
<small>Club finish uses coaches votes as the current Best and Fairest measure. Only the highest eligible top 3, 5 or 10 bonus is paid. Maximum conditional pay per season: {formatMoney(projectedContractExtras(offerComponents))}. A trigger adds one year at the final agreed base salary.</small>
</div>
{/* Contract structure: one salary per season */}
<div style={{ marginBottom: 12, padding: 12, background: "#1e293b", borderRadius: 10 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
<strong style={{ fontSize: "0.85rem" }}>Contract structure · {STRUCTURE_LABELS[describeStructure(offerSchedule)]}</strong>
<div style={{ display: "flex", gap: 6 }}>
{[["EVEN", "Even"], ["FRONT_LOADED", "Front-load"], ["BACK_LOADED", "Back-load"]].map(([preset, label]) => (
<button
key={preset}
type="button"
disabled={offerYears === 1}
onClick={() => applyStructurePreset(preset)}
style={{
padding: "4px 10px",
fontSize: "0.75rem",
borderRadius: 6,
border: "1px solid #334155",
background: offerYears > 1 && describeStructure(offerSchedule) === preset ? "#0c4a6e" : "#0f172a",
color: offerYears === 1 ? "#475569" : "#e2e8f0",
cursor: offerYears === 1 ? "not-allowed" : "pointer",
}}
>
{label}
</button>
))}
</div>
</div>

{offerYears === 1 ? (
<div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>A one-year deal has a single salary. Add years to front-load or back-load it.</div>
) : (
offerSchedule.map((salary, index) => {
const bounds = structureCheck.bounds[index];
return (
<div key={index} style={{ marginBottom: 8 }}>
<label htmlFor={`offer-year-${index}`} style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>
{seasonYear + Math.max(0, Number(selectedContract.years ?? 0)) + index} ({Number(selectedContract.years ?? 0) > 0 ? "extension" : "contract"} year {index + 1}): <strong>{formatMoney(salary)}</strong>
</label>
<input
id={`offer-year-${index}`}
type="range"
min={bounds.min}
max={Math.max(bounds.min, bounds.max)}
step="5000"
value={Math.min(Math.max(salary, bounds.min), Math.max(bounds.min, bounds.max))}
onChange={(e) => setOfferYear(index, Number(e.target.value))}
style={{ width: "100%" }}
/>
</div>
);
})
)}

{structureCheck.errors.map((error) => (
<div key={error} role="alert" style={{ color: "#ef4444", fontSize: "0.8rem" }}>{error}</div>
))}

<div style={{ marginTop: 8, fontSize: "0.78rem", color: "#94a3b8" }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 0.7fr", gap: 4, fontWeight: "bold", marginBottom: 2 }}>
<span>Season</span><span>Committed</span><span>Cap</span><span>Used</span>
</div>
{futureCap.map((row) => (
<div
key={row.year}
style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 0.7fr", gap: 4, color: row.share > 1 ? "#ef4444" : row.share > 0.97 ? "#f59e0b" : "#94a3b8" }}
>
<span>{row.year}</span><span>{formatMoney(row.committed)}</span><span>{row.capEnforced ? formatMoney(row.cap) : "Unrestricted"}</span><span>{row.capEnforced ? `${Math.round(row.share * 100)}%` : "—"}</span>
</div>
))}
<div style={{ marginTop: 4 }}>
Committed counts players already under contract for that season plus this offer. The cap grows about 5% a year, so back-loading frees room now and uses it later.
</div>
</div>
</div>

{offerPayrollCheck && !offerPayrollCheck.ok && (
<div role="alert" style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 12 }}>
This season's salary would put player payments at {formatMoney(offerPayrollCheck.projected)}, above the {formatMoney(offerPayrollCheck.salaryCap)} cap. Lower year 1 (back-loading helps).
</div>
)}

<label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem" }}>
Playing Role
</label>
<select
value={offerRole}
onChange={(e) => setOfferRole(e.target.value)}
style={{
width: "100%",
padding: "8px",
marginBottom: "12px",
background: "#1e293b",
color: "white",
border: "1px solid #334155",
borderRadius: "8px",
}}
>
{playingRoles.map((r) => (
<option key={r.id} value={r.id}>
{r.label}
</option>
))}
</select>

<label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem" }}>
Contract Promises (optional)
</label>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
{promiseTypes.map((p) => (
<button
key={p.id}
onClick={() => togglePromise(p.id)}
style={{
padding: "4px 10px",
fontSize: "0.75rem",
borderRadius: "6px",
border: offerPromises.includes(p.id)
? "1px solid #22c55e"
: "1px solid #334155",
background: offerPromises.includes(p.id) ? "#052e16" : "#1e293b",
color: offerPromises.includes(p.id) ? "#22c55e" : "#94a3b8",
cursor: "pointer",
}}
>
{p.label}
</button>
))}
</div>

<button
onClick={handleEvaluate}
disabled={submitBlocked}
style={{
width: "100%",
padding: "12px",
background: submitBlocked ? "#475569" : "#ea580c",
color: "white",
border: "none",
borderRadius: "10px",
fontWeight: "bold",
fontSize: "1rem",
cursor: submitBlocked ? "not-allowed" : "pointer",
}}
>
Submit Offer
</button>
</div>

{/* Evaluation result */}
{selectedEvalSummary && (
<div
style={{
padding: "12px",
background: "#1e293b",
borderRadius: "10px",
marginBottom: "12px",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginBottom: "8px",
}}
>
<span style={{ fontWeight: "bold" }}>Offer Score</span>
<span
style={{
fontSize: "1.5rem",
fontWeight: "bold",
color: getOutcomeLabel(lastEvaluation.outcome).color,
}}
>
{selectedEvalSummary.overallScore}/100
</span>
</div>
<div
style={{
padding: "6px 12px",
borderRadius: "6px",
background: getOutcomeLabel(lastEvaluation.outcome).color + "22",
color: getOutcomeLabel(lastEvaluation.outcome).color,
fontWeight: "bold",
textAlign: "center",
marginBottom: "10px",
}}
>
{getOutcomeLabel(lastEvaluation.outcome).label.toUpperCase()}
</div>
<div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "4px" }}>
{selectedEvalSummary.details.map((d, i) => (
<div key={i} style={{ color: "#94a3b8" }}>
{d}
</div>
))}
<div style={{ borderTop: "1px solid #334155", marginTop: 8, paddingTop: 8, color: "#94a3b8" }}>
<strong>Club Appeal</strong> reflects results, reputation and facilities. Winning, improving facilities and securing prestige sponsors can raise it.
</div>
<div style={{ color: "#94a3b8" }}>
<strong>Relationships</strong> reflects the senior coach, club, supporters and leadership group. Coach quality, suitable leaders and keeping player promises can improve it.
</div>
</div>
</div>
)}

{lastEvaluation && lastEvaluation.outcome !== negotiationOutcomes.ACCEPT && !lastCounter && !counterRevisionUsed && (
<button type="button" onClick={handleRequestPlayerCounter}
style={{ width: "100%", padding: 10, marginBottom: 12, border: "1px solid #f59e0b", borderRadius: 9,
background: "#292012", color: "#fbbf24", fontWeight: 800, cursor: "pointer" }}>
Request Player Counter
</button>
)}

{/* Counter-offer */}
{lastCounter && (
<div
style={{
padding: "12px",
background: "#1c1917",
borderRadius: "10px",
border: "1px solid #f59e0b",
}}
>
<h4 style={{ color: "#f59e0b", marginBottom: "8px" }}>Counter-Offer</h4>
<div style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
<div>
<strong>Average salary:</strong> {formatMoney(lastCounter.salary)}/yr
</div>
<div>
<strong>{Number(selectedContract.years ?? 0) > 0 ? "Extension years" : "Contract years"}:</strong> {lastCounter.years} · {Math.max(0, Number(selectedContract.years ?? 0)) + lastCounter.years} total after signing
</div>
{counterSchedulePreview.length > 1 && (
<div>
<strong>Structure:</strong> {STRUCTURE_LABELS[describeStructure(counterSchedulePreview)]} — {counterSchedulePreview.map((salary, index) => `${seasonYear + Math.max(0, Number(selectedContract.years ?? 0)) + index}: ${formatMoney(salary)}`).join(" · ")}
</div>
)}
<div>
<strong>Role:</strong> {playingRoles.find((r) => r.id === lastCounter.role)?.label ?? lastCounter.role}
</div>
</div>
{lastCounter.issues.length > 0 && (
<div style={{ fontSize: "0.8rem", color: "#fbbf24", marginBottom: "10px" }}>
{lastCounter.issues.map((issue, i) => (
<div key={i}>- {issue}</div>
))}
</div>
)}
{counterCheck && !counterCheck.ok && (
<div role="alert" style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 8 }}>
This counter would put player payments at {formatMoney(counterCheck.projected)}, above the {formatMoney(counterCheck.salaryCap)} cap this season.
</div>
)}
<button
onClick={handleAcceptCounter}
disabled={counterCheck ? !counterCheck.ok : false}
style={{
width: "100%",
padding: "10px",
background: counterCheck && !counterCheck.ok ? "#475569" : "#16a34a",
color: "white",
border: "none",
borderRadius: "8px",
fontWeight: "bold",
cursor: "pointer",
}}
>
Accept Counter-Offer
</button>
<button type="button" onClick={handleRejectPlayerCounter}
style={{ width: "100%", padding: 10, marginTop: 7, border: "1px solid #f59e0b", borderRadius: 8,
background: "transparent", color: "#fbbf24", fontWeight: 700, cursor: "pointer" }}>
Reject Player's Terms
</button>
</div>
)}
</>
) : (
<div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>
<p style={{ marginTop: 0 }}>Choose a player on the Contracts tab to start negotiating.</p>
<button type="button" onClick={() => setTab("CONTRACTS")} style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: "#ea580c", color: "white", fontWeight: "bold", cursor: "pointer" }}>
Go to Contracts
</button>
</div>
)}
</div>
</>
</section>
</div>
)}

{tab === "STAFF" && (
<>
{seasonState?.academies?.[selectedClubName] && (() => {
const academy = seasonState.academies[selectedClubName];
return <div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Academy Coach</h3>
{academy.coach && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><strong>{academy.coach.name}</strong><StaffRating rating={Math.min(100, Number(academy.coach.rating) <= 20 ? Number(academy.coach.rating) * 5 : Number(academy.coach.rating))} /><span style={{ color: "#94a3b8" }}>{academy.coach.specialty ?? "Player development"}</span></div>}
{(academy.coachMarket ?? []).map((candidate) => { const cost = Number(candidate.salary ?? 0) * Number(candidate.seasonsLeft ?? 1); const canAfford = Number(administration.cashBalance ?? 0) >= cost; return <div key={candidate.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid #334155" }}><div><strong>{candidate.name}</strong> · {candidate.specialty ?? "Player development"}<div style={{ color: "#94a3b8", fontSize: 12 }}>Rated {Math.min(100, Number(candidate.rating) <= 20 ? Number(candidate.rating) * 5 : Number(candidate.rating))}/100 · {formatMoney(candidate.salary)}/yr · {formatMoney(cost)} total</div></div><button type="button" disabled={!canAfford} onClick={() => onAcademyAction?.({ type: "HIRE_COACH", coachId: candidate.id })} style={{ padding: "8px 12px", border: 0, borderRadius: 8, background: canAfford ? "#ea580c" : "#475569", color: "white", fontWeight: 800, cursor: canAfford ? "pointer" : "not-allowed" }}>Appoint</button></div>; })}
</div>;
})()}
{administration.pendingStaffPoach && (() => {
const offer = administration.pendingStaffPoach;
const person = staff.find((item) => String(item.id) === String(offer.staffId));
const matchBudget = person ? budgetForOffer(person, offer.salary, true) : null;
const rival = seasonState.leagueAdministration?.[offer.fromClub];
const rivalOutgoing = person && rival ? replaceStaffInRole(rival.staff ?? [], person).outgoing : null;
const rivalCanFit = Boolean(person && rival && staffContractFitsCap(rival,
replaceStaffInRole(rival.staff ?? [], signStaff(person, offer.salary, offer.years, currentDate)).staff, objectiveYear).allowed
&& Number(rival.cashBalance ?? 0) >= staffAppointmentCosts(person, offer.salary, rivalOutgoing, true).total);
return person ? <div role="alert" style={{ ...cardStyle, marginBottom: 16, borderColor: "#f59e0b" }}>
<h3 style={{ marginTop: 0 }}>Rival club approach</h3>
<p>{offer.fromClub} have offered {person.name} {formatMoney(offer.salary)}/year for {offer.years} years. Respond by {offer.expiresAt}.</p>
<div style={{ display: "flex", gap: 8 }}>
<button type="button" disabled={!matchBudget.allowed} onClick={() => { onStaffMarketChange?.((previous) => resolveStaffPoach(previous, selectedClubName, true, currentDate)); setNegotiationMessage(`${person.name} will stay with your club on the matched terms.`); }} style={{ padding: "9px 12px", border: 0, borderRadius: 8, color: "white", background: matchBudget.allowed ? "#16a34a" : "#475569", fontWeight: 800, cursor: matchBudget.allowed ? "pointer" : "not-allowed" }}>Match offer</button>
<button type="button" onClick={() => { onStaffMarketChange?.((previous) => resolveStaffPoach(previous, selectedClubName, false, currentDate)); setNegotiationMessage(rivalCanFit ? `${person.name} has joined ${offer.fromClub}.` : `${offer.fromClub} can no longer afford or fit the offer. ${person.name} stays.`); }} style={{ padding: "9px 12px", border: 0, borderRadius: 8, color: "white", background: "#b91c1c", fontWeight: 800 }}>Let them go</button>
</div>
{!matchBudget.allowed && <p style={{ color: "#fb7185" }}>Matching would put counted spending {formatMoney(-matchBudget.room)} above the soft cap.</p>}
</div> : null;
})()}
<div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Football Department</h3>
<div style={{ padding: 16, marginBottom: 18, borderRadius: 12, border: `1px solid ${staffBudget.room < 0 ? "#fb7185" : "#334155"}`, background: "#0f172a" }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}><strong>{objectiveYear} football department soft cap</strong><strong style={{ color: staffBudget.room < 0 ? "#fb7185" : staffBudget.room < staffBudget.cap * 0.05 ? "#fbbf24" : "#34d399", fontSize: 19 }}>{staffBudget.room >= 0 ? `${formatMoney(staffBudget.room)} available` : `${formatMoney(-staffBudget.room)} over cap`}</strong></div>
<div role="progressbar" aria-label="Football department soft cap used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(staffBudget.counted / staffBudget.cap * 100))} style={{ height: 12, borderRadius: 8, background: "#334155", overflow: "hidden", margin: "12px 0 10px" }}><div style={{ width: `${Math.min(100, staffBudget.counted / staffBudget.cap * 100)}%`, height: "100%", background: staffBudget.room < 0 ? "#fb7185" : staffBudget.room < staffBudget.cap * 0.05 ? "#fbbf24" : "#34d399" }} /></div>
<div style={{ display: "flex", gap: "8px 22px", flexWrap: "wrap", color: "#cbd5e1", fontSize: 13 }}><span>Counted: <strong>{formatMoney(staffBudget.counted)}</strong></span><span>Limit: <strong>{formatMoney(staffBudget.cap)}</strong></span><span>Staff payroll: <strong>{formatMoney(staffBudget.payroll)}</strong></span><span>Other department costs: <strong>{formatMoney(staffBudget.otherSpend)}</strong></span><span>Concessions: <strong>−{formatMoney(staffBudget.concessions)}</strong></span></div>
<p style={{ color: "#94a3b8", fontSize: 12, margin: "8px 0 0" }}>Counted spend includes the rest of the football department and staff salaries, less eligible concessions. Offers show their projected cap impact before you sign. Existing overages can only stay level or fall.</p>
</div>
<p style={{ color: "#94a3b8" }}>Focus areas increase player attribute growth according to each coach's rating. Development and strategy staff also affect overall growth; performance affects recovery, and the list manager affects scouting and delegated contract terms.</p>
{negotiationMessage && <p role="status" style={{ color: "#fbbf24" }}>{negotiationMessage}</p>}
{staffPositions.map(({ key, role, person }) => (
<div key={key} style={{ padding: "16px 0", borderBottom: "1px solid #334155", textAlign: "left" }}>
<strong style={{ display: "block", color: "#f8fafc", fontSize: 16, lineHeight: 1.4 }}>{role}</strong>
<div style={{ color: person ? "#cbd5e1" : "#fbbf24", fontWeight: person ? 400 : 800, marginTop: 2 }}>{person?.name ?? "Vacant"}</div>
<div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>Affects: {getStaffRoleImpactLabel(role)}</div>
{person ? <>
<div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 12px", marginTop: 12 }}>
<StaffRating rating={person.rating} />
<span style={{ color: "#cbd5e1" }}>{formatMoney(person.salary)}/yr · {staffYearsRemaining(person)} year{staffYearsRemaining(person) === 1 ? "" : "s"} left</span>
<div style={{ display: "flex", gap: 8 }}>
<button type="button" onClick={() => openStaffOffer(person, null, true)} style={{ padding: "7px 10px", border: 0, borderRadius: 7, background: "#ea580c", color: "white", fontWeight: 700, cursor: "pointer" }}>Renew</button>
<button type="button" onClick={() => setPendingStaffFire(person)} style={{ padding: "7px 10px", border: 0, borderRadius: 7, background: "#b91c1c", color: "white", fontWeight: 700, cursor: "pointer" }}>Fire</button>
</div>
</div>
{staffOfferTarget?.renewing && String(staffOfferTarget.person.id) === String(person.id) && renderStaffOfferPanel()}
</> : <div style={{ marginTop: 12 }}>
<button type="button" onClick={() => openStaffMarketForRole(role, key)} style={{ padding: "8px 12px", border: 0, borderRadius: 8, background: "#ea580c", color: "white", fontWeight: 800, cursor: "pointer" }}>Fill Position</button>
</div>}
</div>
))}
</div>
<div ref={staffMarketRef} style={{ ...cardStyle, scrollMarginTop: 16 }}>
<h3 style={{ marginTop: 0, marginBottom: 4 }}>Staff market</h3>
<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
{[["FREE", "Unattached Staff"], ["RIVAL", "Rival Staff"]].map(([key, label]) => <button key={key} type="button" onClick={() => { setStaffMarketTab(key); setStaffOfferTarget(null); }} style={{ padding: "9px 12px", border: "1px solid #334155", borderRadius: 8, background: staffMarketTab === key ? "#ea580c" : "#1e293b", color: "white", fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
</div>
<p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px" }}>
{staffMarketTab === "FREE" ? `Unattached candidates refresh every 28 in-game days. Next refresh in ${staffDaysToRefresh} day${staffDaysToRefresh === 1 ? "" : "s"}.` : "Approach contracted staff at other clubs. Longer deals may require compensation to their current club."}
</p>
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
<label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
Role
<select value={staffRoleFilter} onChange={(event) => setStaffRoleFilter(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f8fafc" }}>
<option value="ALL">All roles</option>
{staffRoles.map((role) => <option key={role} value={role}>{role}</option>)}
</select>
</label>
<label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
Sort by
<select value={staffSort} onChange={(event) => setStaffSort(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f8fafc" }}>
<option value="UPGRADE_DESC">Biggest upgrade on current staff</option>
<option value="OVERALL_DESC">Overall (high to low)</option>
<option value="OVERALL_ASC">Overall (low to high)</option>
<option value="POSITION_ASC">Position (A–Z)</option>
</select>
</label>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
{visibleStaffPool.length === 0 && <p style={{ color: "#94a3b8" }}>No available staff match this role filter.</p>}
{visibleStaffPool.map((candidate) => {
const roleStaff = staff.filter((person) => person.role === candidate.role);
const incumbent = candidate.role === "Development Coach"
? [...roleStaff].sort((a, b) => Number(a.rating ?? 0) - Number(b.rating ?? 0))[0]
: roleStaff[0];
const bonus = candidate.rating - Number(incumbent?.rating ?? 60);
const isDevelopmentCoach = candidate.role === "Development Coach";
const developmentCoachAtCapacity = isDevelopmentCoach && roleStaff.length >= 3;
const developmentCoachCannotUpgrade = developmentCoachAtCapacity && bonus <= 0;
const outgoing = replaceStaffInRole(staff, candidate).outgoing;
const askingSalary = staffDesiredTerms(candidate, Boolean(candidate.fromClub)).salary;
const estimatedCosts = staffAppointmentCosts(candidate, askingSalary, outgoing, Boolean(candidate.fromClub));
const cannotAfford = Number(administration.cashBalance ?? finance.cashBalance) < estimatedCosts.total;
const askBudget = budgetForOffer(candidate, askingSalary);
const isOfferTarget = Boolean(staffOfferTarget && !staffOfferTarget.renewing
&& String(staffOfferTarget.person.id) === String(candidate.id)
&& (staffOfferTarget.fromClub ?? null) === (candidate.fromClub ?? null)
&& (staffOfferTarget.person.marketSourceClub ?? null) === (candidate.marketSourceClub ?? null));
return <article key={`${candidate.fromClub ?? candidate.marketSourceClub ?? "free"}:${candidate.id}`} style={{ padding: 14, background: "#1e293b", borderRadius: 10, border: `1px solid ${isOfferTarget ? "#ea580c" : "#334155"}`, gridColumn: isOfferTarget ? "1 / -1" : undefined }}>
<strong>{candidate.name}</strong>
<div>{candidate.role}{candidate.fromClub ? ` · ${candidate.fromClub}` : ""}</div>
<div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>Affects: {getStaffRoleImpactLabel(candidate.role)}</div>
<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><StaffRating rating={candidate.rating} /><span>{formatMoney(candidate.salary)}/yr</span></div>
{candidate.fromClub && <div style={{ color: "#94a3b8", fontSize: 12 }}>{staffYearsRemaining(candidate)} year{staffYearsRemaining(candidate) === 1 ? "" : "s"} remaining · compensation {formatMoney(staffPoachingCompensation(candidate))}</div>}
<div style={{ color: cannotAfford ? "#fb7185" : "#94a3b8", fontSize: 12, marginTop: 4 }}>Upfront cost from asking salary: {formatMoney(estimatedCosts.total)}{outgoing ? ` (includes ${formatMoney(estimatedCosts.replacementSeverance)} severance for ${outgoing.name})` : ""}</div>
{incumbent && <div style={{ color: bonus >= 0 ? "#34d399" : "#fbbf24", marginTop: 4 }}>{bonus >= 0 ? `+${bonus}` : bonus} rating vs {isDevelopmentCoach && developmentCoachAtCapacity ? `lowest-rated ${candidate.role}` : "current staff member"}</div>}
{isDevelopmentCoach && <div style={{ color: "#94a3b8", marginTop: 4 }}>{roleStaff.length}/3 positions filled</div>}
<button type="button" onClick={() => openStaffOffer(candidate, candidate.fromClub)} disabled={cannotAfford || developmentCoachCannotUpgrade || !askBudget.allowed} style={{ marginTop: 10, padding: "8px 12px", border: 0, borderRadius: 8, background: cannotAfford || developmentCoachCannotUpgrade || !askBudget.allowed ? "#475569" : "#ea580c", color: "white", fontWeight: 800, cursor: cannotAfford || developmentCoachCannotUpgrade || !askBudget.allowed ? "not-allowed" : "pointer" }}>{developmentCoachCannotUpgrade ? "Three positions filled" : cannotAfford ? "Not enough club cash" : !askBudget.allowed ? "No cap room" : candidate.fromClub ? "Make approach" : "Offer contract"}</button>
{isOfferTarget && renderStaffOfferPanel()}
</article>;
})}
</div>
</div>
</>
)}

{tab === "FACILITIES" && (
<div style={cardStyle}>
<h3>Facilities</h3>
{negotiationMessage && <p role="status" style={{ color: "#fbbf24" }}>{negotiationMessage}</p>}
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "16px" }}>
{facilityDefinitions.map((facility) => {
const nextCost = getFacilityUpgradeCost(facility);
const maxed = facility.level >= MAX_FACILITY_LEVEL;
const project = administration.facilityProjects?.[facility.id];
const todayKey = toDayString(seasonState.calendarClock?.date ?? currentDate);
const daysLeft = project ? Math.max(0, daysBetweenKeys(todayKey, project.completesAt)) : 0;
const progress = project ? Math.min(100, Math.max(0, Math.round(((project.days - daysLeft) / project.days) * 100))) : 0;
const runningNow = getFacilityRunningCost(facility.id, facility.level);
const runningNext = maxed ? runningNow : getFacilityRunningCost(facility.id, facility.level + 1);
const blocked = maxed || Boolean(project) || finance.cashBalance < nextCost;
return <div key={facility.id} style={{ padding: "16px", background: "#1e293b", borderRadius: "12px" }}>
<strong>{facility.name}</strong>
<div>Level {facility.level}</div>
<div style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "4px 0" }}>{facility.effect}</div>
<div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Running cost: {formatMoney(runningNow)}/yr</div>
{project ? <div style={{ marginTop: 8, padding: 10, background: "#0f172a", borderRadius: 8 }}>
<div><strong>Upgrading to level {project.toLevel}</strong></div>
<div style={{ height: 8, margin: "8px 0", borderRadius: 4, background: "#334155", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#ea580c" }} /></div>
<div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{daysLeft} day{daysLeft === 1 ? "" : "s"} left · ready {project.completesAt}</div>
</div> : <>
<div>Upgrade cost: {maxed ? "Maximum level" : formatMoney(nextCost)}</div>
{!maxed && <div style={{ marginTop: 8, padding: 10, background: "#0f172a", borderRadius: 8 }}>
<div><strong>Next level:</strong> {facility.nextEffect}</div>
<div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>Build time {getFacilityUpgradeDays(facility)} days · running cost rises to {formatMoney(runningNext)}/yr (+{formatMoney(runningNext - runningNow)})</div>
</div>}
</>}
<button
onClick={() => upgradeFacility(facility.name)}
disabled={blocked}
style={{
marginTop: "10px",
padding: "8px 16px",
background: blocked ? "#475569" : "#ea580c",
color: "white",
border: "none",
borderRadius: "8px",
cursor: blocked ? "not-allowed" : "pointer",
fontWeight: "bold",
}}
>
{maxed ? "Max level" : project ? "Upgrade in progress" : "Upgrade"}
</button>
</div>;
})}
</div>
<p style={{ color: "#94a3b8", marginBottom: 0 }}>Upgrades are paid for up front and only take effect once building is finished. Bigger upgrades cost more, take longer and add to yearly running costs, which are included in the live expenses forecast.</p>
</div>
)}

{tab === "COMMERCIAL" && (
<>
<div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Commercial performance</h3>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
<div><span>Members</span><div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{Number(commercial.memberships ?? 0).toLocaleString()}</div></div>
<div><span>Projected members next season</span><div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{finance.projectedMemberships.toLocaleString()}</div></div>
<div><span>Supporter satisfaction</span><div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{commercial.supporterSatisfaction ?? 0}/100</div></div>
<div><span>Club reputation</span><div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{commercial.reputation ?? 0}/100</div></div>
</div>
<div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #334155" }}>
<label htmlFor="ticket-price" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
<span>Average ticket price</span><strong>${Number(commercial.ticketPrice ?? 48)}</strong>
</label>
<input id="ticket-price" type="range" min="25" max="100" step="1" value={commercial.ticketPrice ?? 48} onChange={(event) => updateTicketPrice(event.target.value)} style={{ width: "100%" }} />
<small style={{ color: "#94a3b8" }}>Higher prices increase gate receipts but can slow membership growth and reduce supporter satisfaction.</small>
</div>
<p style={{ color: "#94a3b8" }}>Membership and sponsorship income are included in the live finance forecast.</p>
</div>

<div style={{ ...cardStyle, marginBottom: 16 }}>
<h3 style={{ marginTop: 0 }}>Current sponsorship</h3>
{commercial.activeSponsor ? (
<div style={{ padding: 14, background: "#1e293b", borderRadius: 10 }}>
<strong>{commercial.activeSponsor.name}</strong>
<div style={{ color: "#94a3b8", fontSize: 13 }}>{SPONSOR_PACKAGES[commercial.activeSponsor.packageType]?.label ?? "Guaranteed"} · {commercial.activeSponsor.remainingYears ?? commercial.activeSponsor.years} year(s) remaining · {formatMoney(commercial.activeSponsor.annualValue * (commercial.activeSponsor.remainingYears ?? commercial.activeSponsor.years))} guaranteed fees remaining</div>
<SponsorTerms offer={{ ...commercial.activeSponsor, guaranteedTotal: null }} />
{(commercial.activeSponsor.incentives ?? []).length > 0 && <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 6px" }}>Bonuses are assessed at the end of each season{Number(commercial.activeSponsor.incentivesStartSeason) > seasonYear ? `, starting with ${commercial.activeSponsor.incentivesStartSeason}` : ""}, and paid into club cash.</p>}
<p style={{ color: "#94a3b8", marginBottom: 0 }}>{commercial.activeSponsor.effect}</p>
<button type="button" onClick={terminateSponsor} style={{ marginTop: 10, padding: "8px 12px", border: 0, borderRadius: 8, background: "#dc2626", color: "white", fontWeight: 800, cursor: "pointer" }}>
End deal early · fee {formatMoney(sponsorTerminationFee(commercial.activeSponsor))}
</button>
</div>
) : <p style={{ color: "#94a3b8" }}>No sponsorship deal signed for {seasonYear}. Compare the offers below.</p>}
</div>

{commercial.lastSponsorSettlement && (
<div style={cardStyle}>
<h3 style={{ marginTop: 0 }}>Sponsor bonuses paid · {commercial.lastSponsorSettlement.seasonYear}</h3>
<p style={{ color: "#94a3b8", marginTop: 0 }}>{commercial.lastSponsorSettlement.sponsorName} paid <strong style={{ color: "#22c55e" }}>{formatMoney(commercial.lastSponsorSettlement.total)}</strong> in season bonuses.</p>
{commercial.lastSponsorSettlement.lines.map((line) => (
<div key={line.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "3px 0", borderTop: "1px solid #1e293b" }}>
<span>{line.label} <span style={{ color: "#94a3b8" }}>· {line.detail}</span></span>
<strong style={{ color: line.amount > 0 ? "#22c55e" : "#64748b" }}>{line.amount > 0 ? formatMoney(line.amount) : "Not earned"}</strong>
</div>
))}
</div>
)}

<div style={cardStyle}>
<h3 style={{ marginTop: 0 }}>Sponsorship offers · Season {seasonYear}</h3>
{negotiationMessage && <p role="status" style={{ color: "#fbbf24" }}>{negotiationMessage}</p>}
{commercial.activeSponsor && <p style={{ color: "#94a3b8" }}>Your current deal is active. New offers will be available when it expires or if you end it early.</p>}
{!commercial.activeSponsor && (commercial.offers ?? []).length === 0 && <p style={{ color: "#94a3b8" }}>No open offers. New offers are generated at the start of next season.</p>}
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
{(commercial.offers ?? []).map((offer) => {
const counter = commercial.counterOffers?.[offer.offerId];
const buttonStyle = { padding: "8px 12px", borderRadius: 8, fontWeight: 800, cursor: "pointer" };
return (
<article key={offer.offerId} style={{ padding: 14, background: "#1e293b", borderRadius: 10, border: "1px solid #334155", display: "grid", alignContent: "start", gap: 4 }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
<strong>{offer.name}</strong>
<span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#0f172a", color: "#38bdf8", whiteSpace: "nowrap" }}>{SPONSOR_PACKAGES[offer.packageType]?.label ?? "Guaranteed"}</span>
</div>
<div style={{ color: "#94a3b8", fontSize: 12 }}>{offer.years}-year deal</div>
<SponsorTerms offer={offer} />
<p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: "0.86rem" }}>{offer.effect}</p>
{counter && (
<div style={{ padding: 10, background: "#0c4a6e33", border: "1px solid #0284c7", borderRadius: 8, marginBottom: 6 }}>
<strong style={{ color: "#38bdf8", fontSize: 13 }}>Counter-offer · {SPONSOR_COUNTER_REQUESTS[counter.counterRequest]?.short}</strong>
<p style={{ margin: "4px 0", fontSize: 12, color: "#cbd5e1" }}>{counter.counterNote}</p>
<SponsorTerms offer={counter} />
</div>
)}
{!commercial.activeSponsor && (
<div style={{ display: "grid", gap: 8 }}>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button type="button" onClick={() => acceptSponsorshipOffer(offer)} style={{ ...buttonStyle, border: 0, background: "#16a34a", color: "white" }}>Accept offer</button>
{counter && <button type="button" onClick={() => acceptSponsorshipOffer(counter)} style={{ ...buttonStyle, border: 0, background: "#0284c7", color: "white" }}>Accept counter</button>}
</div>
{!counter && (
<div>
<div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Negotiate the package (one counter per offer):</div>
<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
{Object.entries(SPONSOR_COUNTER_REQUESTS).map(([request, config]) => {
const availability = getSponsorCounterAvailability(offer, request);
return (
<button key={request} type="button" disabled={!availability.available} title={availability.available ? config.label : availability.reason} onClick={() => requestSponsorCounter(offer, request)} style={{ ...buttonStyle, padding: "5px 9px", fontSize: 12, border: "1px solid #f59e0b", background: "transparent", color: availability.available ? "#fbbf24" : "#64748b", opacity: availability.available ? 1 : 0.5, cursor: availability.available ? "pointer" : "not-allowed" }}>{config.short}</button>
);
})}
</div>
</div>
)}
</div>
)}
</article>
);
})}
</div>
</div>
</>
)}

{tab === "BOARD" && (
<div style={cardStyle}>
<h3>Board Review</h3>
<div style={{ fontSize: "2.2rem", color: gradeColour(boardGrade), fontWeight: 800 }}>{boardGrade}</div>
<p>Board confidence: {commercial.boardSatisfaction ?? 70}/100 · Overall review score: {boardScore}/100 · Trend: <strong style={{ color: boardReview.trend >= 0 ? "#22c55e" : "#ef4444" }}>{boardReview.trend > 0 ? `+${boardReview.trend}` : boardReview.trend} pts</strong> since last season</p>
{administration.boardConsequence && <p role="status" style={{ padding: 12, background: "#7f1d1d", borderRadius: 8 }}>{administration.boardConsequence}</p>}
{boardScore < 50 && <p style={{ padding: 12, background: "#7f1d1d", borderRadius: 8 }}>The board is considering intervention. If results fall below the club’s expectations, a poor end-of-season review could cost you the coaching role.</p>}
<h4>Score breakdown</h4>
{[["Financial management", boardReview.financial], ["On-field results", boardReview.onField], ["List management", boardReview.list], ["Supporter satisfaction", boardReview.supporters], ["Board confidence", boardReview.boardConfidence], ["Staff quality", boardReview.staff]].map(([label, value]) => (
<div key={label} style={{ marginBottom: 10 }}>
<div style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><strong>{value}/100</strong></div>
<div style={{ height: 6, background: "#1e293b", borderRadius: 8, marginTop: 4 }}><div style={{ width: `${value}%`, height: "100%", background: value >= 70 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 8 }} /></div>
</div>
))}
<h4>Season {objectiveYear} objectives</h4>
<p style={{ color: "#94a3b8" }}>Football department soft cap: ${(staffBudget.cap / 1_000_000).toFixed(3)}m · Counted spending: ${(staffBudget.counted / 1_000_000).toFixed(2)}m</p>
<p style={{ color: "#94a3b8" }}>Missed lenient targets cost more board confidence. Ambitious targets receive more tolerance if missed.</p>
{!boardObjectivesFinalized && seasonState.phase === "OFFSEASON" && <div style={{ border: "1px solid #475569", borderRadius: 10, padding: 14, marginBottom: 16 }}>
<h4 style={{ marginTop: 0 }}>Negotiate this season’s objectives</h4>
<p style={{ color: "#94a3b8" }}>Offer one target in each area. The board weighs the whole package, so a lighter target needs a stronger commitment elsewhere. An accepted agreement is locked for the season.</p>
<div style={{ display: "grid", gap: 12 }}>
{boardObjectiveCategories.map(category => <label key={category.id} style={{ display: "grid", gap: 5 }}><strong>{category.label}</strong>
<select value={boardProposal[category.id] ?? category.defaultId} onChange={event => setBoardProposal(previous => ({ ...previous, [category.id]: event.target.value }))} style={{ padding: 9, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #64748b" }}>
{category.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
</select>
<small style={{ color: "#94a3b8" }}>Risk if missed: {(() => { const difficulty = category.choices.find(choice => choice.id === (boardProposal[category.id] ?? category.defaultId))?.difficulty ?? 3; return difficulty >= 6 ? "lower" : difficulty <= 2 ? "higher" : "moderate"; })()}</small>
</label>)}
</div>
<button type="button" onClick={() => {
const selections = Object.fromEntries(boardObjectiveCategories.map(category => [category.id, boardProposal[category.id] ?? category.defaultId]));
const response = proposeBoardObjectives({ club: typeof club === "string" ? { name: club } : club, roster: clubPlayers, seasonYear: objectiveYear, administration, selections });
setBoardNegotiationMessage(response.message);
if (response.accepted) updateAdministration(current => ({ ...current, boardObjectives: response.boardObjectives }));
}} style={{ marginTop: 14, padding: "10px 14px", border: 0, borderRadius: 8, background: "#ea580c", color: "white", fontWeight: 800, cursor: "pointer" }}>Propose to board</button>
{boardNegotiationMessage && <p role="status" style={{ marginBottom: 0 }}>{boardNegotiationMessage}</p>}
</div>}
{boardObjectivesFinalized && <p style={{ color: "#22c55e" }}>Objectives agreed with the board for this season.</p>}
{(seasonState.phase === "OFFSEASON" && Number(administration.boardObjectives?.seasonYear) === objectiveYear
? administration.boardObjectives.objectives.map(objective => ({ ...objective, status: "IN_PROGRESS", progress: 0 }))
: boardReview.objectives).map((objective) => {
const status = objective.status ?? (objective.complete ? "COMPLETE" : "IN_PROGRESS");
const statusLabel = status === "COMPLETE" ? "Complete" : status === "FAILED" ? "Failed" : "In progress";
const statusColour = status === "COMPLETE" ? "#22c55e" : status === "FAILED" ? "#ef4444" : "#f59e0b";
return <div key={objective.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #334155" }}>
<span>{objective.label}<small style={{ display: "block", color: "#94a3b8" }}>Risk if missed: {Number(objective.difficulty ?? 3) >= 6 ? "lower" : Number(objective.difficulty ?? 3) <= 2 ? "higher" : "moderate"}</small></span><strong style={{ color: statusColour, whiteSpace: "nowrap" }}>{statusLabel} · {objective.progress}%</strong>
</div>;
})}
</div>
)}
{tab === "JOB_MARKET" && <JobMarketTab market={getJobMarket(seasonState.jobMarket, leagueClubs, selectedClubName, seasonYear)} currentClubName={selectedClubName} onApply={onApplyForJob} />}
</>
);
}
