import { checkClubCommitments } from "../engine/transactionRules.js";
// TradeNegotiation modal — two-phase trade flow.
// Phase 1: Club negotiation (offer players + picks, get AI club response)
// Phase 2: Player contract negotiation (if club agreed, negotiate with player)

import { useMemo, useState } from "react";
import { clubs } from "../data/clubs.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import { calculateOfferValue, getAcquisitionDifficulty, getValuationTier, getClubSpecificValuation, generateTradeCounterOffer } from "../engine/playerValuationEngine.js";
import { evaluateTradeOffer } from "../engine/playerValuationEngine.js";
import { evaluateOffer, generateCounterOffer, getOutcomeLabel, summarizeEvaluation, defaultRoleForPlayer, negotiationOutcomes, createPromises, getLocationContentment, getLocationLabel } from "../engine/negotiationEngine.js";
import { calculateMarketValue, estimateSalaryDemand } from "../engine/contractValueEngine.js";
import { playingRoles, promiseTypes } from "../data/playerPersonalities.js";
import { evaluateFreeAgencyCompetition, generateAIFreeAgentCompetitors, getFreeAgencyStatus, shouldMatchRestrictedOffer } from "../engine/freeAgencyEngine.js";
import { checkPayrollChange, buildClubNegotiationContext } from "../engine/clubAdministrationEngine.js";
import { getConfiguredMaximumSalary, getMinimumSalary, projectCapCommitments } from "../engine/salaryCap.js";
import { contractSigningFields, normalizeContractComponents, projectedContractExtras } from "../engine/contractComponents.js";
import { resolveAppearance } from "./appearance.js";
import { formatDraftPick } from "../engine/draftEngine.js";
import {
 STRUCTURE_LABELS,
 STRUCTURE_PRESETS,
 buildSalarySchedule,
 describeStructure,
 getScheduleAverage,
 getScheduleShape,
 getSalaryInSeason,
 validateContractStructure,
} from "../engine/contractStructure.js";

const num = (v, f) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? f : Number(v));

export default function TradeNegotiation({
 targetPlayer,
 userClub,
 allPlayers,
 playerDevelopment,
 playerContracts,
 userClubPicks = [],
 canTrade = true,
 seasonYear,
 currentDate,
 clubAdministration = {},
 seasonState = null,
 tasmaniaConcession = null,
 leagueAdministration = {},
 ladder = [],
 initialPhase,
 initialOffer = null,
 transactionLabel,
 appearance,
 onClose,
 onComplete,
 onTradeOutcome,
}) {
 const lightMode = resolveAppearance(appearance) === "light";
 const palette = getPalette(lightMode);

 const [phase, setPhase] = useState(() => {
 if (initialPhase) return initialPhase;
 // Free agents skip directly to player negotiation
 return ["UFA", "RFA", "DFA", "TAS_CONCESSION"].includes(getFreeAgencyStatus(targetPlayer, playerContracts, allPlayers, { seasonYear, eligibilityYear: currentDate?.getFullYear() ?? seasonYear, includeExpiring: currentDate?.getFullYear() === Number(seasonYear), tasmaniaConcession: tasmaniaConcession ?? undefined }).type) ? "PLAYER_NEGOTIATION" : "CLUB_NEGOTIATION";
 });

 const [selectedPlayerIds, setSelectedPlayerIds] = useState(() => (initialOffer?.players ?? []).map((player) => player.id));
 const [playerPositionFilter, setPlayerPositionFilter] = useState("ALL");
 const [selectedPicks, setSelectedPicks] = useState(() => initialOffer?.picks ?? []);
 const [clubResponse, setClubResponse] = useState(null);
 const [matchedContract, setMatchedContract] = useState(null);
 const [offerHistory, setOfferHistory] = useState([]);

 // Contract offer state. The offer is a schedule of salaries, one per season; the average
 // annual value and the number of years are derived from it, as for the club's own players.
 const [contractSchedule, setContractSchedule] = useState(() => {
 const target = getCareerPlayer(targetPlayer, playerDevelopment, seasonYear, playerContracts);
 const opening = Math.round(num(estimateSalaryDemand(target, userClub.name, 1, seasonYear), 400000) / 5000) * 5000;
 return buildSalarySchedule(opening, 3, STRUCTURE_PRESETS.EVEN, { seasonYear });
 });
 const [contractRole, setContractRole] = useState(() => defaultRoleForPlayer(getCareerPlayer(targetPlayer, playerDevelopment, seasonYear, playerContracts)));
 const [contractPromises, setContractPromises] = useState([]);
 const [contractComponents, setContractComponents] = useState(() => normalizeContractComponents());
 const [playerResponse, setPlayerResponse] = useState(null);
 const [contractHistory, setContractHistory] = useState([]);
 const [contractMessage, setContractMessage] = useState("");
 const [lastCounter, setLastCounter] = useState(null);
 const [counterRevisionAvailable, setCounterRevisionAvailable] = useState(false);
 const [counterRevisionUsed, setCounterRevisionUsed] = useState(false);
 const contractYears = contractSchedule.length;
 const contractSalary = getScheduleAverage(contractSchedule);

 const freeAgencyStatus = getFreeAgencyStatus(targetPlayer, playerContracts, allPlayers, { seasonYear, eligibilityYear: currentDate?.getFullYear() ?? seasonYear, includeExpiring: currentDate?.getFullYear() === Number(seasonYear) , tasmaniaConcession: tasmaniaConcession ?? undefined });
 const isFA = ["UFA", "RFA", "DFA", "TAS_CONCESSION"].includes(freeAgencyStatus.type);
 // Tasmania's concession signings are agreed directly with the player: no rival bids.
 const isConcession = freeAgencyStatus.type === "TAS_CONCESSION";
 const valuationPlayers = useMemo(
 () => allPlayers.map((player) => getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts)),
 [allPlayers, playerDevelopment, seasonYear, playerContracts],
 );
 const valuationContext = useMemo(
 () => ({ seasonYear, allPlayers: valuationPlayers, ladder, clubCount: clubs.length }),
 [seasonYear, valuationPlayers, ladder],
 );
 const careerPlayer = useMemo(
 () => getCareerPlayer(targetPlayer, playerDevelopment, seasonYear, playerContracts),
 [targetPlayer, playerDevelopment, seasonYear, playerContracts]
 );
 const AICompetitorOffers = useMemo(
 () => isFA && !isConcession ? generateAIFreeAgentCompetitors(careerPlayer, userClub.name, seasonYear, { clubs, allPlayers: valuationPlayers, playerContracts }) : [],
 [isFA, isConcession, careerPlayer, userClub.name, seasonYear, clubs, valuationPlayers, playerContracts],
 );

 const contractValidation = useMemo(
 () => validateContractStructure(contractSchedule, { seasonYear, administrationState: clubAdministration }),
 [contractSchedule, seasonYear, clubAdministration],
 );
 const contractExtras = projectedContractExtras(contractComponents);
 const minSalary = getMinimumSalary(seasonYear);
 const maxSalary = getConfiguredMaximumSalary(seasonYear, clubAdministration);
 const money = (value) => `$${Number(value ?? 0).toLocaleString()}`;

 // Describes the buying club to the negotiation engine, exactly as for the club's own players:
 // coaching staff, live ladder, reputation and facilities all feed the player's view of the move.
 const negotiationContext = useMemo(
 () => buildClubNegotiationContext({ administrationState: clubAdministration, seasonState: seasonState ?? { ladder }, clubName: userClub.name, players: valuationPlayers }),
 [clubAdministration, seasonState, ladder, userClub.name, valuationPlayers],
 );
 const evaluationContext = useMemo(
 () => ({ deterministic: true, seasonYear, clubContext: negotiationContext }),
 [seasonYear, negotiationContext],
 );
 const marketValue = useMemo(() => calculateMarketValue(careerPlayer, { interestedClubs: 1, seasonYear }).marketValue, [careerPlayer, seasonYear]);
 const agentDemand = useMemo(() => estimateSalaryDemand(careerPlayer, userClub.name, 1, seasonYear), [careerPlayer, userClub.name, seasonYear]);
 const personality = careerPlayer.personality ?? {};
 const locationContentment = getLocationContentment(careerPlayer, userClub.name);
 const coachRelationship = Math.max(0, Math.min(100, Number(personality.relationships?.seniorCoach ?? 50) + Number(negotiationContext.coachRelationshipModifier ?? 0)));

 const scheduleOptions = { seasonYear };
 const setOfferAverage = (average) => setContractSchedule((current) => buildSalarySchedule(average, current.length, getScheduleShape(current), scheduleOptions));
 const changeContractYears = (years) => setContractSchedule((current) => buildSalarySchedule(getScheduleAverage(current), years, getScheduleShape(current), scheduleOptions));
 const applyStructurePreset = (preset) => setContractSchedule((current) => buildSalarySchedule(getScheduleAverage(current), current.length, preset, scheduleOptions));
 const setContractYear = (index, value) => setContractSchedule((current) => current.map((salary, i) => (i === index ? value : salary)));
 const changeComponent = (group, key, value) => setContractComponents((current) => ({ ...current,
 [group]: { ...current[group], [key]: Math.max(0, Number(value) || 0) },
 }));
 const togglePromise = (promiseId) => setContractPromises((current) => current.includes(promiseId) ? current.filter((id) => id !== promiseId) : [...current, promiseId]);

 const userClubPlayers = useMemo(
 () => allPlayers
 .map((p) => getCareerPlayer(p, playerDevelopment, seasonYear, playerContracts))
 .filter((p) => p.club === userClub.name && p.id !== targetPlayer.id)
 .sort((a, b) => num(b.overall, 0) - num(a.overall, 0)),
 [allPlayers, userClub, playerDevelopment, seasonYear, playerContracts, targetPlayer]
 );

 const availablePlayerPositions = useMemo(
 () => [...new Set(userClubPlayers.flatMap((player) => player.positions?.length ? player.positions : ["OTHER"]))]
 .sort((a, b) => a.localeCompare(b)),
 [userClubPlayers]
 );
 const visibleUserClubPlayers = useMemo(
 () => playerPositionFilter === "ALL"
 ? userClubPlayers
 : userClubPlayers.filter((player) => (player.positions?.length ? player.positions : ["OTHER"]).includes(playerPositionFilter)),
 [userClubPlayers, playerPositionFilter]
 );

 const availableClubPicks = userClubPicks.filter((pick) => pick.currentOwner === userClub.name);

 const targetValue = useMemo(() => getClubSpecificValuation(careerPlayer, careerPlayer.club, valuationContext), [careerPlayer, valuationContext]);
 const targetDifficulty = useMemo(() => getAcquisitionDifficulty(careerPlayer), [careerPlayer]);
 const targetTier = getValuationTier(targetValue);

 const selectedPlayers = useMemo(
 () => userClubPlayers.filter((p) => selectedPlayerIds.includes(p.id)),
 [userClubPlayers, selectedPlayerIds]
 );

 const currentOfferValue = useMemo(
 () => calculateOfferValue({ players: selectedPlayers, picks: selectedPicks }, careerPlayer.club, valuationContext),
 [selectedPlayers, selectedPicks, careerPlayer.club, valuationContext]
 );
 const userClubPayroll = useMemo(() => allPlayers
 .map((player) => getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts))
 .filter((player) => player.club === userClub.name)
 .reduce((total, player) => total + num(player.contract?.salary, 0), 0),
 [allPlayers, playerDevelopment, seasonYear, playerContracts, userClub.name]);
 const offeredPlayerSalary = selectedPlayers.reduce((total, player) => total + num(player.contract?.salary, 0) + projectedContractExtras(player.contract), 0);
 const offerPayrollCheck = checkPayrollChange({
 playerPayments: userClubPayroll,
 currentSalary: offeredPlayerSalary,
 // The offered players leave our list, so their current salaries come out of
 // the payroll before the incoming player's first-year salary is added.
 newSalary: (contractSchedule[0] ?? 0) + contractExtras,
 seasonYear,
 administrationState: clubAdministration,
 });
 const futureCap = useMemo(() => projectCapCommitments(contractSchedule.map((salary, index) => {
 const committedBeforeOffer = valuationPlayers
 .filter((player) => player.club === userClub.name && !selectedPlayerIds.includes(player.id))
 .reduce((sum, player) => {
 const contract = player.contract ?? {};
 return sum + getSalaryInSeason({
 yearsRemaining: contract.yearsRemaining,
 salary: contract.salary,
 yearlySalaries: contract.yearlySalaries,
 }, index) + (index < Number(contract.yearsRemaining ?? 0) ? projectedContractExtras(contract) : 0);
 }, 0);
 return committedBeforeOffer + salary + contractExtras;
 }), seasonYear, clubAdministration?.salaryCapBank, clubAdministration), [contractSchedule, contractExtras, valuationPlayers, userClub.name, selectedPlayerIds, seasonYear, clubAdministration]);

 const togglePlayer = (playerId) => {
 if (!selectedPlayerIds.includes(playerId) && selectedPlayerIds.length + selectedPicks.length >= 3) return;
 setClubResponse(null);
 setSelectedPlayerIds((prev) => prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]);
 };

 const togglePick = (pick) => {
 if (!selectedPicks.some(item => item.id === pick.id) && selectedPlayerIds.length + selectedPicks.length >= 3) return;
 setClubResponse(null);
 setSelectedPicks((prev) => prev.some((item) => item.id === pick.id)
 ? prev.filter((item) => item.id !== pick.id)
 : [...prev, pick]);
 };

 const submitClubOffer = () => {
 if (!canTrade) return;
 const offer = { players: selectedPlayers, picks: selectedPicks };
 const result = evaluateTradeOffer(careerPlayer, offer, targetPlayer.club, valuationContext);
 const counter = result.accepted ? null : generateTradeCounterOffer(careerPlayer, offer, targetPlayer.club, valuationContext,
 { players: userClubPlayers, picks: availableClubPicks });
 const response = {
 accepted: result.accepted,
 reason: result.reason,
 offerValue: result.offerValue,
 targetValue: result.targetValue,
 surplus: result.surplusValue,
 confidence: result.confidence,
 requiredValue: result.requiredValue,
 counter,
 timestamp: Date.now(),
 };
 setClubResponse(response);
 setOfferHistory((prev) => [...prev, { offer, response }]);

 if (result.accepted) {
 if (matchedContract) {
 onComplete({ player: targetPlayer, newClub: userClub.name, previousClub: freeAgencyStatus.club,
 outgoingPlayers: selectedPlayers.map(player => ({ id: player.id })), draftPickIds: selectedPicks.map(pick => pick.id),
 contract: matchedContract, isFreeAgent: false });
 } else setPhase("PLAYER_NEGOTIATION");
 }
 };

 const checkTransactionCap = (offer) => {
 const proposed = { ...playerContracts, [String(targetPlayer.id)]: { ...(playerContracts[String(targetPlayer.id)] ?? {}), club: userClub.name, salary: offer.salary, yearlySalaries: offer.yearlySalaries, yearsRemaining: offer.years, ...normalizeContractComponents(offer) } };
 for (const player of selectedPlayers) proposed[String(player.id)] = { ...(playerContracts[String(player.id)] ?? player.contract), club: careerPlayer.club };
 for (const club of (isFA ? [userClub.name] : [userClub.name, careerPlayer.club]).filter(name => name && name !== "-")) {
 const check = checkClubCommitments(allPlayers, proposed, club, seasonYear, 0, club === userClub.name ? clubAdministration : leagueAdministration?.[club]);
 if (!check.ok) {
 setPlayerResponse({ blocked: true, outcomeLabel: { label: "Salary cap exceeded", color: "#ef4444" }, score: 0, summary: { details: [check.reason] } });
 return false;
 }
 }
 return true;
 };

 // The offer as currently set on the form (or with terms swapped in, for a counter).
 const buildOffer = (schedule = contractSchedule, role = contractRole, promises = contractPromises) => ({
 clubName: userClub.name,
 salary: getScheduleAverage(schedule),
 years: schedule.length,
 yearlySalaries: schedule,
 structure: describeStructure(schedule),
 role,
 promises,
 ...normalizeContractComponents(contractComponents),
 });

 // The contract written to the player's record when the deal is signed.
 const buildContractTerms = (offer) => ({
 salary: offer.yearlySalaries?.[0] ?? offer.salary,
 years: offer.years,
 yearlySalaries: offer.yearlySalaries,
 role: offer.role,
 promises: createPromises(offer.promises ?? [], { seasonYear, round: Number(seasonState?.round ?? 1), years: offer.years }),
 ...normalizeContractComponents(offer),
 ...contractSigningFields(seasonState, careerPlayer.id, seasonYear),
 });

 const evaluateContractOffer = (offer) => {
 if (!canTrade || !checkTransactionCap(offer)) return;
 if (freeAgencyStatus.type === "RFA" && Number(offer.years) < 2) {
 setPlayerResponse({ blocked: true, outcomeLabel: { label: "Two-year minimum", color: "#ef4444" }, score: 0,
 summary: { details: ["A restricted free-agent offer must run for at least two seasons."] } });
 return;
 }
 // A submitted offer answers any counter on the table; a revision made after a counter is the last one.
 if (counterRevisionAvailable) {
 setCounterRevisionAvailable(false);
 setCounterRevisionUsed(true);
 }
 setLastCounter(null);
 setContractMessage("");
 const result = evaluateOffer(careerPlayer, offer, evaluationContext);
 const resolvedOutcome = result.outcome;
 const outcome = getOutcomeLabel(resolvedOutcome);
 const summary = summarizeEvaluation(result);
 const competition = isFA && !isConcession
 ? evaluateFreeAgencyCompetition(careerPlayer, offer, AICompetitorOffers, { seasonYear })
 : null;
 const wonCompetition = !competition || competition.userWon;

 const response = {
 score: result.score,
 outcome: wonCompetition ? resolvedOutcome : negotiationOutcomes.REJECT,
 outcomeLabel: wonCompetition ? outcome : { label: `Offer ranked ${competition.userRank}th · ${competition.winner?.clubName} selected`, color: "#f87171" },
 summary,
 offer: { ...offer },
 competition,
 };
 setPlayerResponse(response);
 setContractHistory((prev) => [...prev, { offer, response }]);

 if (resolvedOutcome === negotiationOutcomes.ACCEPT && wonCompetition) {
 const contract = buildContractTerms(offer);
 if (freeAgencyStatus.type === "RFA" && shouldMatchRestrictedOffer(targetPlayer, offer, allPlayers, playerContracts, currentDate?.getFullYear() ?? seasonYear, leagueAdministration?.[freeAgencyStatus.club])) {
 setMatchedContract(contract);
 setClubResponse({ accepted: false, reason: `${freeAgencyStatus.club} matched the salary and term. A club-to-club trade is now required.`, offerValue: 0, targetValue: targetValue });
 setPhase("CLUB_NEGOTIATION");
 return;
 }
 onComplete({
 player: targetPlayer,
 newClub: userClub.name,
 previousClub: freeAgencyStatus.club ?? careerPlayer.club,
 outgoingPlayers: selectedPlayers.map((player) => ({ id: player.id })),
 draftPickIds: selectedPicks.map((pick) => pick.id),
 contract,
 isFreeAgent: isFA,
 freeAgencyType: freeAgencyStatus.type,
 });
 } else {
 onTradeOutcome?.({
 status: "UNSUCCESSFUL",
 source: isFA ? "Free Agency · Contract" : "Trade Negotiation · Contract",
 otherClub: careerPlayer.club,
 summary: `${careerPlayer.name} did not accept the contract terms${competition && !competition.userWon ? ` and chose ${competition.winner?.clubName ?? "another club"}` : ""}.`,
 offeredAssets: [careerPlayer.name],
 requestedAssets: [],
 });
 }
 };

 const submitContractOffer = () => {
 if (!contractValidation.ok || !offerPayrollCheck.ok) return;
 evaluateContractOffer(buildOffer());
 };

 const handlePlayerCounter = () => {
 if (!canTrade || !playerResponse || playerResponse.blocked || lastCounter || counterRevisionUsed) return;
 const counter = generateCounterOffer(careerPlayer, buildOffer(), evaluationContext);
 if (!counter.acceptable) {
 const reasons = counter.shortfalls?.length ? ` The player ${counter.shortfalls.join(" and ")}.` : "";
 setContractMessage(`${careerPlayer.name}'s agent cannot find acceptable terms within a reasonable salary range.${reasons} Improve the role, add suitable promises or incentives, or adjust the contract and try again.`);
 return;
 }
 const schedule = counter.yearlySalaries?.length
 ? counter.yearlySalaries
 : buildSalarySchedule(counter.salary, counter.years, STRUCTURE_PRESETS.EVEN, scheduleOptions);
 setContractSchedule(schedule);
 setContractRole(counter.role ?? contractRole);
 if (Array.isArray(counter.promises)) setContractPromises(counter.promises);
 setLastCounter(counter);
 setCounterRevisionAvailable(true);
 setContractMessage(`${careerPlayer.name} has proposed ${money(counter.salary)}/year for ${counter.years} years. Their terms score ${counter.evaluationScore}/100 against the same factors used for your offers; you can revise them or accept.`);
 };

 const acceptPlayerCounter = () => {
 if (!lastCounter) return;
 const schedule = lastCounter.yearlySalaries?.length
 ? lastCounter.yearlySalaries
 : buildSalarySchedule(lastCounter.salary, lastCounter.years, STRUCTURE_PRESETS.EVEN, scheduleOptions);
 evaluateContractOffer(buildOffer(schedule, lastCounter.role ?? contractRole, lastCounter.promises ?? contractPromises));
 };

 const rejectPlayerCounter = () => {
 if (!lastCounter) return;
 setLastCounter(null);
 setCounterRevisionAvailable(false);
 setContractMessage(`${careerPlayer.name}'s requested terms were declined. You can revise your offer and submit it.`);
 };

 const modalStyle = {
 position: "fixed",
 inset: 0,
 zIndex: 300,
 display: "grid",
 placeItems: "center",
 padding: 20,
 background: "rgba(2, 6, 23, 0.78)",
 backdropFilter: "blur(6px)",
 overflowY: "auto",
 };

 const dialogStyle = {
 width: "min(100%, 900px)",
 maxHeight: "90vh",
 overflowY: "auto",
 boxSizing: "border-box",
 padding: 24,
 border: `1px solid ${palette.border}`,
 borderRadius: 18,
 background: palette.card,
 color: palette.text,
 boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
 };

 const sectionStyle = {
 background: palette.surface,
 border: `1px solid ${palette.border}`,
 borderRadius: 12,
 padding: 16,
 marginBottom: 12,
 };

 const btnStyle = (variant = "primary") => ({
 padding: "10px 16px",
 borderRadius: 10,
 cursor: "pointer",
 fontWeight: 700,
 fontSize: 14,
 background: variant === "primary" ? "#ea580c" : variant === "danger" ? "#dc2626" : palette.surface,
 color: variant === "primary" || variant === "danger" ? "white" : palette.text,
 border: variant === "secondary" ? `1px solid ${palette.border}` : "none",
 });

 return (
 <div style={modalStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
 <div style={dialogStyle} role="dialog" aria-modal="true">
 {/* Header */}
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
 <div>
 <div style={{ fontSize: 12, color: palette.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
 {transactionLabel ?? (isFA ? `${freeAgencyStatus.type === "RFA" ? "Restricted" : freeAgencyStatus.type === "DFA" ? "Delisted" : isConcession ? "Tasmania Concession" : "Unrestricted"} Free Agent Recruitment` : "Trade Negotiation")}
 </div>
 <h2 style={{ margin: "4px 0 2px" }}>{targetPlayer.name}</h2>
 <div style={{ color: palette.muted, fontSize: 14 }}>
 {!isFA && `${targetPlayer.club} · `}
 Overall {careerPlayer.overall} · Age {careerPlayer.age} · <PotentialStars player={careerPlayer} />
 {!isFA && ` · ${targetDifficulty.label} to acquire`}
 </div>
 </div>
 <button style={btnStyle("danger")} onClick={onClose}>Close</button>
 </div>

 {/* Phase indicator */}
 {(!isFA || matchedContract) && (
 <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
 <div style={{
 flex: 1, padding: "8px 12px", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 700,
 background: phase === "CLUB_NEGOTIATION" ? "#ea580c" : palette.surface,
 color: phase === "CLUB_NEGOTIATION" ? "white" : palette.muted,
 border: `1px solid ${palette.border}`,
 }}>
 1. Club Negotiation
 </div>
 <div style={{
 flex: 1, padding: "8px 12px", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 700,
 background: phase === "PLAYER_NEGOTIATION" ? "#ea580c" : palette.surface,
 color: phase === "PLAYER_NEGOTIATION" ? "white" : palette.muted,
 border: `1px solid ${palette.border}`,
 }}>
 2. Player Contract
 </div>
 </div>
 )}

 {/* Phase 1: Club Negotiation */}
 {(!isFA || matchedContract) && phase === "CLUB_NEGOTIATION" && (
 <>
 <div style={sectionStyle}>
 <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Target Value</h3>
 <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Trade Value</div>
 <div style={{ fontSize: 24, fontWeight: 800, color: targetTier.color }}>{targetValue}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Tier</div>
 <div style={{ fontSize: 18, fontWeight: 700 }}>{targetTier.label}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Difficulty</div>
 <div style={{ fontSize: 18, fontWeight: 700, color: targetDifficulty.color }}>{targetDifficulty.label}</div>
 </div>
 </div>
 </div>

 <div style={sectionStyle}>
 <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Offer Players</h3>
 <div aria-label="Filter offered players by position" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
 {["ALL", ...availablePlayerPositions].map((position) => {
 const selected = playerPositionFilter === position;
 const count = position === "ALL"
 ? userClubPlayers.length
 : userClubPlayers.filter((player) => (player.positions?.length ? player.positions : ["OTHER"]).includes(position)).length;
 return (
 <button
 key={position}
 type="button"
 aria-pressed={selected}
 onClick={() => setPlayerPositionFilter(position)}
 style={{
 minWidth: 52, padding: "6px 9px", borderRadius: 8, cursor: "pointer",
 background: selected ? "#ea580c" : palette.input,
 color: selected ? "white" : palette.text,
 border: `1px solid ${selected ? "#ea580c" : palette.border}`,
 fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
 }}
 >
 {position} <span style={{ opacity: 0.75 }}>({count})</span>
 </button>
 );
 })}
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
 {visibleUserClubPlayers.map((p) => {
 const val = getClubSpecificValuation(p, careerPlayer.club, valuationContext);
 const selected = selectedPlayerIds.includes(p.id);
 return (
 <button
 key={p.id}
 type="button"
 onClick={() => togglePlayer(p.id)}
 style={{
 padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, textAlign: "left",
 background: selected ? "#ea580c" : palette.input,
 color: selected ? "white" : palette.text,
 border: `1px solid ${selected ? "#ea580c" : palette.border}`,
 }}
 >
 <span style={{ display: "block" }}>{p.name} · {p.overall} OVR</span>
 <span style={{ display: "block", marginTop: 3, opacity: 0.75, fontSize: 11 }}>
 {(p.positions ?? []).join(" / ") || "Position unknown"} · Value {val}
 </span>
 </button>
 );
 })}
 {visibleUserClubPlayers.length === 0 && <div style={{ color: palette.muted, fontSize: 13 }}>No players at this position.</div>}
 </div>
 </div>

 {availableClubPicks.length > 0 && (
 <div style={sectionStyle}>
 <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Offer Draft Picks</h3>
 <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
 {availableClubPicks.map((pick) => {
 const selected = selectedPicks.some((selectedPick) => selectedPick.id === pick.id);
 return (
 <button
 key={pick.id}
 onClick={() => togglePick(pick)}
 style={{
 padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
 background: selected ? "#ea580c" : palette.input,
 color: selected ? "white" : palette.text,
 border: `1px solid ${selected ? "#ea580c" : palette.border}`,
 }}
 >
 {formatDraftPick(pick)}
 </button>
 );
 })}
 </div>
 </div>
 )}

 <div style={sectionStyle}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Your Offer Value</div>
 <div style={{ fontSize: 24, fontWeight: 800 }}>{currentOfferValue}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted, textAlign: "right" }}>Target Value</div>
 <div style={{ fontSize: 24, fontWeight: 800, color: targetTier.color }}>{targetValue}</div>
 </div>
 </div>
 <button style={{ ...btnStyle("primary"), width: "100%", marginTop: 12, opacity: canTrade ? 1 : 0.5 }} onClick={submitClubOffer} disabled={!canTrade || currentOfferValue === 0}>
 Submit Offer to {targetPlayer.club}
 </button>
 </div>

 {clubResponse && (
 <div style={{ ...sectionStyle, borderColor: clubResponse.accepted ? "#22c55e" : "#ef4444" }}>
 <div style={{ fontWeight: 700, color: clubResponse.accepted ? "#22c55e" : "#ef4444", marginBottom: 4 }}>
 {clubResponse.accepted ? "Club Accepted" : matchedContract ? "Original Club Matched" : "Club Counter Offer"}
 </div>
 <div style={{ color: palette.text, fontSize: 14 }}>{clubResponse.reason}</div>
 <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>
 Offer: {clubResponse.offerValue} / Required: {clubResponse.requiredValue ?? clubResponse.targetValue}
 </div>
 {!clubResponse.accepted && clubResponse.counter && <div style={{ marginTop: 10 }}>
 <p style={{ margin: "0 0 6px", fontSize: 13 }}>{clubResponse.counter.reason}</p>
 <div style={{ fontSize: 13 }}>They request: {[...clubResponse.counter.players.map(player => player.name), ...clubResponse.counter.picks.map(formatDraftPick)].join(", ") || "A stronger return"}</div>
 <div style={{ fontSize: 12, color: palette.muted, marginTop: 5 }}>Package value: {clubResponse.counter.offerValue} / Required: {clubResponse.counter.requiredValue}</div>
 <div style={{ fontSize: 12, color: palette.muted, marginTop: 5 }}>Any club agreement still requires the player to accept your contract offer.</div>
 {clubResponse.counter.possible && clubResponse.counter.offerValue >= clubResponse.counter.requiredValue && <button type="button" style={{ ...btnStyle("secondary"), marginTop: 9 }} onClick={() => {
 setSelectedPlayerIds(clubResponse.counter.players.map(player => player.id));
 setSelectedPicks(clubResponse.counter.picks);
 setClubResponse(null);
 }}>Apply counter package</button>}
 </div>}
 </div>
 )}

 {offerHistory.length > 0 && (
 <div style={sectionStyle}>
 <h4 style={{ margin: "0 0 6px", fontSize: 14, color: palette.muted }}>Offer History ({offerHistory.length})</h4>
 {offerHistory.map((entry, i) => (
 <div key={i} style={{ fontSize: 12, color: palette.muted, padding: "4px 0", borderTop: i > 0 ? `1px solid ${palette.border}` : "none" }}>
 Offer {i + 1}: Value {entry.response.offerValue} — {entry.response.accepted ? "Accepted" : "Countered"}
 </div>
 ))}
 </div>
 )}
 </>
 )}

 {/* Phase 2: Player Contract Negotiation — the same interface used for the club's own players */}
 {phase === "PLAYER_NEGOTIATION" && (
 <>
 <div style={sectionStyle}>
 <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Player Profile</h3>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
 <div>Overall: <strong>{careerPlayer.overall}</strong></div>
 <div>Age: <strong>{careerPlayer.age}</strong></div>
 <div>Position: <strong>{careerPlayer.positions?.join(", ") || "—"}</strong></div>
 <div>Stage: <strong>{personality.careerStage ?? "—"}</strong></div>
 <div>Greed: <strong>{personality.greed ?? "—"}</strong></div>
 <div>Loyalty: <strong>{personality.loyalty ?? "—"}</strong></div>
 <div>Ambition: <strong>{personality.ambition ?? "—"}</strong></div>
 <div>Prem Desire: <strong>{personality.premiershipDesire ?? "—"}</strong></div>
 <div>Location: <strong>{locationContentment}/100 · {getLocationLabel(locationContentment)}</strong></div>
 <div>Coach Rel: <strong>{coachRelationship}</strong></div>
 </div>
 {personality.agent && (
 <div style={{ marginTop: 8, fontSize: 12, color: "#8b5cf6" }}>
 Agent: {personality.agent.label} — {personality.agent.description}
 </div>
 )}
 <div style={{ marginTop: 12, fontSize: 14, display: "grid", gap: 4 }}>
 <div style={{ display: "flex", justifyContent: "space-between" }}><span>Market Value:</span><strong>{money(marketValue)}</strong></div>
 <div style={{ display: "flex", justifyContent: "space-between" }}><span>Current Salary:</span><strong>{money(careerPlayer.contract?.salary)}</strong></div>
 <div style={{ display: "flex", justifyContent: "space-between" }}><span>Agent's current demand:</span><strong>{money(agentDemand)}/yr</strong></div>
 </div>
 </div>

 <div style={sectionStyle}>
 <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Contract Offer</h3>
 <label htmlFor="trade-offer-average" style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
 Average annual salary: {money(contractSalary)}
 </label>
 <input
 id="trade-offer-average"
 type="range"
 min={minSalary}
 max={maxSalary}
 step="5000"
 value={Math.min(maxSalary, Math.max(minSalary, contractSalary))}
 onChange={(e) => setOfferAverage(Number(e.target.value))}
 style={{ width: "100%", marginBottom: 12 }}
 />

 <label htmlFor="trade-offer-years" style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
 Contract length: {contractYears} year(s)
 </label>
 <input
 id="trade-offer-years"
 type="range"
 min="1"
 max="6"
 step="1"
 value={contractYears}
 onChange={(e) => changeContractYears(Number(e.target.value))}
 style={{ width: "100%", marginBottom: 12 }}
 />

 <div style={{ padding: 12, marginBottom: 12, background: palette.input, borderRadius: 10, display: "grid", gap: 9 }}>
 <strong style={{ fontSize: 13 }}>Conditional payments and trigger</strong>
 <small style={{ color: palette.muted }}>Base salary above is guaranteed. Match payments are earned only for senior games played. Incentives count when the award is won.</small>
 {[["matchPayments", "perMatch", "Payment per game ($)"], ["matchPayments", "startsAfter", "Games before payment starts"], ["matchPayments", "maxPaidMatches", "Maximum paid games"], ["performanceIncentives", "bestAndFairestTop3", "Club top 3 bonus ($)"], ["performanceIncentives", "bestAndFairestTop5", "Club top 5 bonus ($)"], ["performanceIncentives", "bestAndFairestTop10", "Club top 10 bonus ($)"], ["performanceIncentives", "brownlow", "Brownlow bonus ($)"], ["performanceIncentives", "coleman", "Coleman bonus ($)"], ["triggerClause", "gamesAcrossTwoSeasons", "Games over two seasons for an extra year"]].map(([group, key, label]) => (
 <label key={`${group}-${key}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 13 }}>{label}
 <input type="number" min="0" step={key.includes("Games") || key === "startsAfter" || key === "gamesAcrossTwoSeasons" ? "1" : "1000"} value={contractComponents[group][key]} onChange={(event) => changeComponent(group, key, event.target.value)} style={{ width: 110, padding: 6, background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 6 }} />
 </label>
 ))}
 <small style={{ color: palette.muted }}>Club finish uses coaches votes as the current Best and Fairest measure. Only the highest eligible top 3, 5 or 10 bonus is paid. Maximum conditional pay per season: {money(contractExtras)}. A trigger adds one year at the final agreed base salary.</small>
 </div>

 <div style={{ marginBottom: 12, padding: 12, background: palette.input, borderRadius: 10 }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
 <strong style={{ fontSize: 13 }}>Contract structure · {STRUCTURE_LABELS[describeStructure(contractSchedule)]}</strong>
 <div style={{ display: "flex", gap: 6 }}>
 {[["EVEN", "Even"], ["FRONT_LOADED", "Front-load"], ["BACK_LOADED", "Back-load"]].map(([preset, label]) => (
 <button
 key={preset}
 type="button"
 disabled={contractYears === 1}
 onClick={() => applyStructurePreset(preset)}
 style={{
 padding: "4px 10px",
 fontSize: 12,
 borderRadius: 6,
 border: `1px solid ${palette.border}`,
 background: contractYears > 1 && describeStructure(contractSchedule) === preset ? "#0c4a6e" : palette.card,
 color: contractYears === 1 ? palette.muted : contractYears > 1 && describeStructure(contractSchedule) === preset ? "#f8fafc" : palette.text,
 cursor: contractYears === 1 ? "not-allowed" : "pointer",
 }}
 >
 {label}
 </button>
 ))}
 </div>
 </div>

 {contractYears === 1 ? (
 <div style={{ color: palette.muted, fontSize: 12 }}>A one-year deal has a single salary. Add years to front-load or back-load it.</div>
 ) : (
 contractSchedule.map((salary, index) => {
 const bounds = contractValidation.bounds[index];
 return (
 <div key={index} style={{ marginBottom: 8 }}>
 <label htmlFor={`trade-offer-year-${index}`} style={{ display: "block", fontSize: 12, marginBottom: 2 }}>
 {seasonYear + index} (contract year {index + 1}): <strong>{money(salary)}</strong>
 </label>
 <input
 id={`trade-offer-year-${index}`}
 type="range"
 min={bounds.min}
 max={Math.max(bounds.min, bounds.max)}
 step="5000"
 value={Math.min(Math.max(salary, bounds.min), Math.max(bounds.min, bounds.max))}
 onChange={(e) => setContractYear(index, Number(e.target.value))}
 style={{ width: "100%" }}
 />
 </div>
 );
 })
 )}

 {contractValidation.errors.map((error) => (
 <div key={error} role="alert" style={{ color: "#ef4444", fontSize: 12 }}>{error}</div>
 ))}

 <div style={{ marginTop: 8, fontSize: 11, color: palette.muted }}>
 <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1.1fr 0.65fr", gap: 6, fontWeight: 700, marginBottom: 3 }}>
 <span>Season</span><span>Committed</span><span>Cap</span><span>Used</span>
 </div>
 {futureCap.map((row) => (
 <div key={row.year} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1.1fr 0.65fr", gap: 6, color: row.share > 1 ? "#ef4444" : row.share > 0.97 ? "#f59e0b" : palette.muted }}>
 <span>{row.year}</span><span>{money(row.committed)}</span><span>{row.capEnforced ? money(row.cap) : "Unrestricted"}</span><span>{row.capEnforced ? `${Math.round(row.share * 100)}%` : "—"}</span>
 </div>
 ))}
 <div style={{ marginTop: 5 }}>
 Committed counts players already under contract for that season plus this offer, and removes the salaries of players offered in the trade. The cap grows about 5% a year, so back-loading frees room now and uses it later.
 </div>
 </div>
 </div>

 {!offerPayrollCheck.ok && <div role="alert" style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>This year's salary would put player payments at {money(offerPayrollCheck.projected)}, above the {money(offerPayrollCheck.salaryCap)} salary cap. Lower year 1 (back-loading helps).</div>}

 <label htmlFor="trade-offer-role" style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Playing Role</label>
 <select
 id="trade-offer-role"
 value={contractRole}
 onChange={(e) => setContractRole(e.target.value)}
 style={{ ...inputStyle(palette), marginTop: 0, marginBottom: 12 }}
 >
 {playingRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
 </select>

 <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Contract Promises (optional)</label>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
 {promiseTypes.map((promise) => {
 const active = contractPromises.includes(promise.id);
 return (
 <button
 key={promise.id}
 type="button"
 onClick={() => togglePromise(promise.id)}
 style={{
 padding: "4px 10px",
 fontSize: 12,
 borderRadius: 6,
 border: active ? "1px solid #22c55e" : `1px solid ${palette.border}`,
 background: active ? "#052e16" : palette.card,
 color: active ? "#22c55e" : palette.muted,
 cursor: "pointer",
 }}
 >
 {promise.label}
 </button>
 );
 })}
 </div>

 <button style={{ ...btnStyle("primary"), width: "100%", opacity: canTrade && contractValidation.ok && offerPayrollCheck.ok && !futureCap.some((row) => row.overCap) ? 1 : 0.5 }} onClick={submitContractOffer} disabled={!canTrade || !contractValidation.ok || !offerPayrollCheck.ok || futureCap.some((row) => row.overCap)}>
 Submit Contract Offer
 </button>
 </div>

 {contractMessage && (
 <div role="status" style={{ ...sectionStyle, borderColor: "#f59e0b", fontSize: 13 }}>{contractMessage}</div>
 )}

 {playerResponse && (
 <div style={{ ...sectionStyle, borderColor: playerResponse.outcomeLabel.color }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
 <div style={{ fontWeight: 700, color: playerResponse.outcomeLabel.color, fontSize: 16 }}>
 {playerResponse.outcomeLabel.label}
 </div>
 <div style={{ fontSize: 20, fontWeight: 800 }}>{playerResponse.score}/100</div>
 </div>
 {playerResponse.summary?.details?.map((detail, i) => (
 <div key={i} style={{ fontSize: 12, color: palette.muted, padding: "2px 0" }}>{detail}</div>
 ))}
 {!playerResponse.blocked && (
 <div style={{ borderTop: `1px solid ${palette.border}`, marginTop: 8, paddingTop: 8, fontSize: 12, color: palette.muted, display: "grid", gap: 4 }}>
 <div><strong>Club Appeal</strong> reflects results, reputation and facilities. Winning, improving facilities and securing prestige sponsors can raise it.</div>
 <div><strong>Relationships</strong> reflects the senior coach, club, supporters and leadership group. Coach quality, suitable leaders and keeping player promises can improve it.</div>
 </div>
 )}
 {playerResponse.competition?.rankings?.length > 0 && (
 <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: palette.input }}>
 <strong>Competing offers</strong>
 {playerResponse.competition.rankings.map((entry, index) => (
 <div key={entry.clubName} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 5, color: palette.muted, fontSize: 12 }}>
 <span>{index + 1}. {entry.clubName}</span>
 <span>${entry.offer.salary.toLocaleString()}/yr · {entry.offer.years} yrs · {entry.score}/100</span>
 </div>
 ))}
 </div>
 )}
 {!playerResponse.blocked && playerResponse.outcome !== negotiationOutcomes.ACCEPT && !lastCounter && !counterRevisionUsed && (
 <button
 type="button"
 style={{ ...btnStyle("secondary"), width: "100%", marginTop: 10, opacity: canTrade ? 1 : 0.5, borderColor: "#f59e0b", color: "#fbbf24" }}
 disabled={!canTrade}
 onClick={handlePlayerCounter}
 >
 Request Player Counter
 </button>
 )}
 </div>
 )}

 {lastCounter && (() => {
 const counterSchedule = lastCounter.yearlySalaries?.length ? lastCounter.yearlySalaries : [lastCounter.salary];
 const counterPayroll = checkPayrollChange({
 playerPayments: userClubPayroll,
 currentSalary: offeredPlayerSalary,
 newSalary: (counterSchedule[0] ?? 0) + contractExtras,
 seasonYear,
 administrationState: clubAdministration,
 });
 return (
 <div style={{ ...sectionStyle, borderColor: "#f59e0b" }}>
 <h4 style={{ margin: "0 0 8px", color: "#f59e0b" }}>Counter-Offer</h4>
 <div style={{ fontSize: 13, marginBottom: 8, display: "grid", gap: 3 }}>
 <div><strong>Average salary:</strong> {money(lastCounter.salary)}/yr</div>
 <div><strong>Contract years:</strong> {lastCounter.years}</div>
 {counterSchedule.length > 1 && (
 <div><strong>Structure:</strong> {STRUCTURE_LABELS[describeStructure(counterSchedule)]} — {counterSchedule.map((salary, index) => `${seasonYear + index}: ${money(salary)}`).join(" · ")}</div>
 )}
 <div><strong>Role:</strong> {playingRoles.find((role) => role.id === lastCounter.role)?.label ?? lastCounter.role}</div>
 {lastCounter.promises?.length > 0 && (
 <div><strong>Promises:</strong> {lastCounter.promises.map((id) => promiseTypes.find((promise) => promise.id === id)?.label ?? id).join(", ")}</div>
 )}
 </div>
 {lastCounter.issues?.length > 0 && (
 <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 10 }}>
 {lastCounter.issues.map((issue, i) => <div key={i}>- {issue}</div>)}
 </div>
 )}
 {!counterPayroll.ok && (
 <div role="alert" style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>
 This counter would put player payments at {money(counterPayroll.projected)}, above the {money(counterPayroll.salaryCap)} cap this season.
 </div>
 )}
 <button
 type="button"
 style={{ ...btnStyle("primary"), width: "100%", background: counterPayroll.ok && canTrade ? "#16a34a" : "#475569", opacity: counterPayroll.ok && canTrade ? 1 : 0.6 }}
 disabled={!counterPayroll.ok || !canTrade}
 onClick={acceptPlayerCounter}
 >
 Accept Counter-Offer
 </button>
 <button
 type="button"
 style={{ ...btnStyle("secondary"), width: "100%", marginTop: 7, borderColor: "#f59e0b", color: "#fbbf24" }}
 onClick={rejectPlayerCounter}
 >
 Reject Player's Terms
 </button>
 </div>
 );
 })()}

 {contractHistory.length > 0 && (
 <div style={sectionStyle}>
 <h4 style={{ margin: "0 0 6px", fontSize: 14, color: palette.muted }}>Contract Offer History ({contractHistory.length})</h4>
 {contractHistory.map((entry, i) => (
 <div key={i} style={{ fontSize: 12, color: palette.muted, padding: "4px 0", borderTop: i > 0 ? `1px solid ${palette.border}` : "none" }}>
 Offer {i + 1}: ${entry.offer.salary?.toLocaleString()}/yr, {entry.offer.years} years — Score: {entry.response.score}/100 — {entry.response.outcomeLabel?.label}
 </div>
 ))}
 </div>
 )}
 </>
 )}
 </div>
 </div>
 );
}

function getPalette(lightMode) {
 return {
 text: lightMode ? "#0f172a" : "#f8fafc",
 muted: lightMode ? "#64748b" : "#94a3b8",
 card: lightMode ? "#ffffff" : "#0f172a",
 surface: lightMode ? "#e2e8f0" : "#1e293b",
 border: lightMode ? "#cbd5e1" : "#334155",
 input: lightMode ? "#ffffff" : "#0f172a",
 };
}

function inputStyle(palette) {
 return {
 display: "block",
 boxSizing: "border-box",
 width: "100%",
 marginTop: 6,
 padding: "10px 12px",
 border: `1px solid ${palette.border}`,
 borderRadius: 10,
 background: palette.input,
 color: palette.text,
 fontSize: 15,
 };
}