import { isMovementWindow } from "../engine/seasonRules.js";
import { evaluatePackageExchange } from "../engine/playerValuationEngine.js";
import { validTradePackage, checkClubCommitments } from "../engine/transactionRules.js";
import { useEffect, useMemo, useState } from "react";
import { players as allPlayersData } from "../data/players.js";
import { clubs } from "../data/clubs.js";
import { resolveAppearance } from "./appearance.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import { getPlayerTraitIds, TRAIT_DEFINITIONS } from "../data/footballData.js";
import { getAcquisitionDifficulty, calculateOfferValue, calculatePickValue, calculatePlayerValue, getClubSpecificValuation, getClubValuationDetails, getValuationTier, isPlayerUntouchable } from "../engine/playerValuationEngine.js";
import { formatDraftPick } from "../engine/draftEngine.js";
import { analyzeSquad, getTopPositionNeeds } from "../engine/squadAnalysisEngine.js";
import { getPlayersSeekingMoves } from "../engine/playersSeekingMovesEngine.js";
import { getFreeAgents } from "../engine/freeAgencyEngine.js";
import { tasmaniaConcessionOptions } from "../engine/tasmaniaExpansionEngine.js";
import { formatContractDuration } from "../engine/contractEngine.js";
import { generateAIOffersToUser } from "../engine/aiTradeEngine.js";
import { tradeEligibility } from "../engine/playerMovementRules.js";
import TradeNegotiation from "./TradeNegotiation.jsx";
import TradeGenius from "./TradeGenius.jsx";

export default function TradeLab({
 appearance,
 players: playerPool = allPlayersData,
 playerDevelopment = {},
 playerContracts = {},
 seasonYear = 2027,
 currentDate,
 userClub = clubs[0],
 seasonState = {},
 onTradeComplete,
 onRespondToAITradeOffer,
 onShopTradeComplete,
 onTradeGeniusComplete,
 onTradeOutcome,
 aiTradeOfferResponses = {},
 focusPlayerId = null,
 focusSequence = 0,
 onViewDraftProspect,
 onOpenClub,
}) {
 const lightMode = resolveAppearance(appearance) === "light";
 const palette = getPalette(lightMode);
 const activeDate = currentDate instanceof Date ? currentDate : currentDate ? new Date(currentDate) : null;
 const tradePeriodOpen = Boolean(activeDate && isMovementWindow(seasonState, activeDate));
 const freeAgencyOpen = Boolean(activeDate && isMovementWindow(seasonState, activeDate, "freeAgency"));
 const delistedFreeAgencyOpen = Boolean(activeDate && isMovementWindow(seasonState, activeDate, "delistedFreeAgency"));
 const tasmaniaConcessionWindow = Boolean(activeDate && isMovementWindow(seasonState, activeDate, "tasmaniaConcession"));
 const concessionBase = useMemo(() => tasmaniaConcessionOptions(seasonState, userClub.name, clubs.map((club) => club.name)), [seasonState.expansionCareer, userClub.name]);
 const concessionOptions = concessionBase && tasmaniaConcessionWindow ? concessionBase : null;
 const canRecruitAgent = (player) => player?.freeAgencyStatus?.type === "TAS_CONCESSION" ? tasmaniaConcessionWindow : player?.freeAgencyStatus?.type === "DFA" ? freeAgencyOpen || delistedFreeAgencyOpen : freeAgencyOpen;
 const tradeOutcomes = [...(seasonState.tradeOutcomes ?? [])].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
 const userDraftPicks = (seasonState.draftPickAssets ?? []).filter((pick) => pick.currentOwner === userClub.name);

 const [activeTab, setActiveTab] = useState("DATABASE");
 const [playerSearch, setPlayerSearch] = useState("");
 const [positionFilter, setPositionFilter] = useState("ALL");
 const [ageBandFilter, setAgeBandFilter] = useState("ALL");
 const [traitFilter, setTraitFilter] = useState("ALL");
 const [seekingPositionFilter, setSeekingPositionFilter] = useState("ALL");
 const [seekingSort, setSeekingSort] = useState("overall");
 const [clubFilter, setClubFilter] = useState("ALL");
 const [faOnlyFilter, setFaOnlyFilter] = useState(false);
 const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
 const [negotiationTarget, setNegotiationTarget] = useState(null);
 const [tradeTargets, setTradeTargets] = useState([]); // Players the user has approached
 const [counteringOfferId, setCounteringOfferId] = useState(null);
 const [counterPlayerIds, setCounterPlayerIds] = useState([]);
 const [counterPickIds, setCounterPickIds] = useState([]);
 const [counterUserPlayerIds, setCounterUserPlayerIds] = useState([]);
 const [counterUserPickIds, setCounterUserPickIds] = useState([]);
 const [incomingContractNegotiation, setIncomingContractNegotiation] = useState(null);
 const [shopOutgoingAssetKeys, setShopOutgoingAssetKeys] = useState([]);
 const [shopSort, setShopSort] = useState({ key: "asset", direction: "asc" });
 const [shopBuyerClubName, setShopBuyerClubName] = useState("");
 const [shopReturnPlayerIds, setShopReturnPlayerIds] = useState([]);
 const [shopReturnPickIds, setShopReturnPickIds] = useState([]);
 const [shopReturnSort, setShopReturnSort] = useState({ key: "asset", direction: "asc" });
 const [shopTradeResponse, setShopTradeResponse] = useState(null);
 const [geniusModeRequest, setGeniusModeRequest] = useState({ mode: "TARGET", sequence: 0 });
 const [geniusResetSequence, setGeniusResetSequence] = useState(0);
 const [geniusNotice, setGeniusNotice] = useState(null);
 const shortlistIds = useMemo(() => new Set((seasonState.scoutingShortlist ?? []).map(String)), [seasonState.scoutingShortlist]);
 const shortlistedProspects = (seasonState.draftState?.availableProspects ?? []).filter(prospect => shortlistIds.has(String(prospect.id)));

 useEffect(() => {
 if (!focusSequence || focusPlayerId == null) return;
 const target = (Array.isArray(playerPool) ? playerPool : []).find(player => String(player.id) === String(focusPlayerId));
 if (!target) return;
 setActiveTab("DATABASE");
 setPlayerSearch(target.name ?? "");
 setPositionFilter("ALL");
 setAgeBandFilter("ALL");
 setTraitFilter("ALL");
 setClubFilter("ALL");
 setFaOnlyFilter(false);
 }, [focusSequence, focusPlayerId]);

 const shopOutgoingPlayerIds = shopOutgoingAssetKeys
 .filter((key) => key.startsWith("player:"))
 .map((key) => key.slice("player:".length));
 const shopOutgoingPickIds = shopOutgoingAssetKeys
 .filter((key) => key.startsWith("pick:"))
 .map((key) => key.slice("pick:".length));

 const databasePlayers = useMemo(
 () => (Array.isArray(playerPool) ? playerPool : []).map((player) =>
 ({ ...getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts), recentlyMoved: !tradeEligibility(player, seasonState, seasonYear).eligible })
 ).filter((player) => Boolean(player.club)),
 [playerPool, playerDevelopment, playerContracts, seasonYear, seasonState.tradePeriodTransactions, seasonState.calendarClock]
 );
 const userClubPlayers = useMemo(
 () => databasePlayers.filter((player) => player.club === userClub.name),
 [databasePlayers, userClub.name],
 );
 const tradeValuationContext = useMemo(() => ({
 allPlayers: databasePlayers,
 ladder: seasonState.ladder ?? [],
 seasonYear,
 clubCount: clubs.length,
 }), [databasePlayers, seasonState.ladder, seasonYear]);
 const shopOutgoingPlayers = useMemo(
 () => userClubPlayers.filter((player) => shopOutgoingPlayerIds.includes(String(player.id))),
 [userClubPlayers, shopOutgoingPlayerIds],
 );
 const shopOutgoingPicks = userDraftPicks.filter((pick) => shopOutgoingPickIds.includes(String(pick.id)));
 const shopRows = useMemo(() => [
 ...userClubPlayers.map((player) => ({
 id: `player-${player.id}`,
 assetId: String(player.id),
 kind: "Player",
 asset: player.name ?? "",
 type: (player.positions ?? (player.position ? [player.position] : [])).join(", ") || "—",
 age: Number(player.age),
 overall: Number(player.overall),
 value: calculatePlayerValue(player, tradeValuationContext),
 player,
 })),
 ...userDraftPicks.map((pick) => ({
 id: `pick-${pick.id}`,
 assetId: String(pick.id),
 kind: "Draft pick",
 asset: formatDraftPick(pick),
 type: "Draft pick",
 age: null,
 overall: null,
 value: calculatePickValue(pick, tradeValuationContext),
 pick,
 })),
 ].sort((a, b) => {
 const left = a[shopSort.key];
 const right = b[shopSort.key];
 if (left == null || right == null) return left == null && right == null ? 0 : left == null ? 1 : -1;
 const comparison = typeof left === "number" && typeof right === "number"
 ? left - right
 : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
 return shopSort.direction === "asc" ? comparison : -comparison;
 }), [userClubPlayers, userDraftPicks, tradeValuationContext, shopSort]);
 const shopBuyerPlayers = databasePlayers.filter((player) => player.club === shopBuyerClubName && !player.recentlyMoved);
 const shopBuyerPicks = (seasonState.draftPickAssets ?? []).filter((pick) => pick.currentOwner === shopBuyerClubName);
 const shopIncomingPlayers = shopBuyerPlayers.filter((player) => shopReturnPlayerIds.includes(String(player.id)));
 const shopIncomingPicks = shopBuyerPicks.filter((pick) => shopReturnPickIds.includes(String(pick.id)));
 const shopReturnRows = [
 ...shopBuyerPlayers.map((player) => ({
 id: `player-${player.id}`, assetId: String(player.id), kind: "Player", asset: player.name ?? "",
 type: (player.positions ?? (player.position ? [player.position] : [])).join(", ") || "—",
 age: Number(player.age), overall: Number(player.overall),
 value: getClubSpecificValuation(player, shopBuyerClubName, tradeValuationContext), player,
 })),
 ...shopBuyerPicks.map((pick) => ({
 id: `pick-${pick.id}`, assetId: String(pick.id), kind: "Draft pick", asset: formatDraftPick(pick),
 type: "Draft pick", age: null, overall: null,
 value: calculatePickValue(pick, tradeValuationContext), pick,
 })),
 ].sort((a, b) => {
 const left = a[shopReturnSort.key];
 const right = b[shopReturnSort.key];
 if (left == null || right == null) return left == null && right == null ? 0 : left == null ? 1 : -1;
 const comparison = typeof left === "number" && typeof right === "number"
 ? left - right
 : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
 return shopReturnSort.direction === "asc" ? comparison : -comparison;
 });
 const shopReturnAssetCount = shopReturnPlayerIds.length + shopReturnPickIds.length;
 const shopBuyerAssetValue = calculateOfferValue(
 { players: shopOutgoingPlayers, picks: shopOutgoingPicks },
 shopBuyerClubName,
 tradeValuationContext,
 );
 const toggleShopSort = (key) => setShopSort((current) => current.key === key
 ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
 : { key, direction: ["age", "overall", "value"].includes(key) ? "desc" : "asc" });
 const toggleShopReturnSort = (key) => setShopReturnSort((current) => current.key === key
 ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
 : { key, direction: ["age", "overall", "value"].includes(key) ? "desc" : "asc" });

 const aiOffers = useMemo(() => {
 if (!tradePeriodOpen) return [];
 if (seasonState.calendarClock) return (seasonState.pendingAITradeOffers ?? []).filter(offer => !aiTradeOfferResponses[offer.id] && offer.deadline >= seasonState.calendarClock.date);
 const marketClubs = clubs.map((club) => ({
 ...club,
 draftPicks: (seasonState.draftPickAssets ?? []).filter((pick) =>
 pick.currentOwner === club.name && Number(pick.year) >= seasonYear && Number(pick.year) <= seasonYear + 2,
 ),
 }));
 const offers = generateAIOffersToUser(databasePlayers, marketClubs, userClub.name, seasonYear, {
 windowKey: `${seasonYear}-${seasonState.offseasonStep ?? 0}`,
 ladder: seasonState.ladder ?? [],
 maxOffers: 3,
 tradeRequests: seasonState.tradeRequests ?? [],
 });
 return offers.filter((offer) => !aiTradeOfferResponses[offer.id]);
 }, [tradePeriodOpen, seasonState.pendingAITradeOffers, seasonState.calendarClock, databasePlayers, seasonState.draftPickAssets, seasonState.offseasonStep, seasonYear, userClub.name, aiTradeOfferResponses]);

 const freeAgents = useMemo(
 () => getFreeAgents(playerPool, playerContracts, { seasonYear, eligibilityYear: activeDate?.getFullYear() ?? seasonYear,
 includeExpiring: activeDate?.getFullYear() === Number(seasonYear),
 ...(concessionOptions ? { tasmaniaConcession: concessionOptions, allowedTypes: ["UFA", "RFA", "DFA", "TAS_CONCESSION"] } : {}) }).filter(player => player.originalClub !== userClub.name),
 [playerPool, playerContracts, seasonYear, activeDate?.getFullYear(), userClub.name, concessionOptions]
 );

 const freeAgentIds = useMemo(() => new Set(freeAgents.map((fa) => fa.id)), [freeAgents]);

 const moveContext = useMemo(() => {
 const appearancesByPlayer = {};
 const playedMatchKeys = new Set();
 (seasonState.roundHistory ?? []).forEach((roundEntry, roundIndex) => {
 (roundEntry.results ?? []).forEach((result, matchIndex) => {
 const matchKey = `${roundEntry.round ?? roundIndex}-${result.homeTeam ?? result.home}-${result.awayTeam ?? result.away}-${matchIndex}`;
 for (const side of ["home", "away"]) {
 for (const stat of result.playerStats?.[side] ?? []) {
 if (stat.playerId == null || / squad$/i.test(stat.playerName ?? "")) continue;
 const key = `${matchKey}:${String(stat.playerId)}`;
 if (playedMatchKeys.has(key)) continue;
 playedMatchKeys.add(key);
 const playerId = String(stat.playerId);
 appearancesByPlayer[playerId] = (appearancesByPlayer[playerId] ?? 0) + 1;
 }
 }
 });
 });
 return {
 seasonYear,
 ladder: seasonState.ladder ?? [],
 roundsPlayed: (seasonState.roundHistory ?? []).length,
 appearancesByPlayer,
 };
 }, [seasonState.roundHistory, seasonState.ladder, seasonYear]);

 const positionsForPlayer = (player) => {
 if (Array.isArray(player.positions)) return player.positions;
 return player.position ? [player.position] : [];
 };

 const positionOptions = useMemo(
 () => [...new Set(databasePlayers.flatMap(positionsForPlayer))].sort(),
 [databasePlayers]
 );
 const traitOptions = useMemo(() => Object.values(TRAIT_DEFINITIONS).slice().sort((a, b) => a.label.localeCompare(b.label)), []);

 const normalizedClubKey = (clubName) =>
 (clubName ?? "").toLowerCase().replace(/[^a-z]/g, "");

 const clubAbbreviation = (clubName) => {
 if (!clubName || clubName === "-") return "FA";
 const clubKey = normalizedClubKey(clubName);
 const club = clubs.find(
 (item) =>
 normalizedClubKey(item.name) === clubKey ||
 normalizedClubKey(item.abbreviation) === clubKey
 );
 if (club) return club.abbreviation;
 const aliases = {
 gws: "GWS",
 gwsgiants: "GWS",
 greaterwesternsydney: "GWS",
 greaterwesternsydneygiants: "GWS"
 };
 return aliases[clubKey] ?? "—";
 };

 const sortableColumns = [
 { key: "club", label: "CLUB" },
 { key: "name", label: "PLAYER" },
 { key: "age", label: "AGE" },
 { key: "overall", label: "OVERALL" },
 { key: "potential", label: "POTENTIAL", sortable: false },
 { key: "positions", label: "POSITION(S)" },
 { key: "contractYears", label: "CONTRACT" },
 { key: "actions", label: "ACTIONS" },
 ];

 const changeSort = (key) => {
 setSortConfig((current) => {
 if (current.key === key) {
 return { key, direction: current.direction === "asc" ? "desc" : "asc" };
 }
 const numericColumns = ["age", "overall", "contractYears"];
 return { key, direction: numericColumns.includes(key) ? "desc" : "asc" };
 });
 };

 const filteredPlayers = useMemo(() => {
 const query = playerSearch.trim().toLowerCase();
 return databasePlayers
 .filter((player) => typeof player.name === "string" && player.name.trim().length > 0)
 .filter((player) => player.club !== userClub.name)
 .filter((player) => activeTab !== "SHORTLIST" || shortlistIds.has(String(player.id)))
 .filter((player) => !query || (player.name ?? "").toLowerCase().includes(query))
 .filter((player) => ageBandFilter === "ALL"
 || (ageBandFilter === "U23" && Number(player.age) < 23)
 || (ageBandFilter === "24_29" && Number(player.age) >= 24 && Number(player.age) <= 29)
 || (ageBandFilter === "30_PLUS" && Number(player.age) >= 30))
 .filter((player) => traitFilter === "ALL"
 || (traitFilter === "HAS_TRAIT" && getPlayerTraitIds(player).length > 0)
 || getPlayerTraitIds(player).includes(traitFilter))
 .filter((player) =>
 positionFilter === "ALL" ||
 positionsForPlayer(player).some((position) => position.toUpperCase() === positionFilter)
 )
 .filter((player) => {
 if (faOnlyFilter) return freeAgentIds.has(player.id);
 if (clubFilter === "ALL") return true;
 if (clubFilter === "FREE_AGENTS") return freeAgentIds.has(player.id);
 return !freeAgentIds.has(player.id) && clubAbbreviation(player.club) === clubAbbreviation(clubFilter);
 })
 .sort((a, b) => {
 const getValue = (player) => {
 switch (sortConfig.key) {
 case "club": return clubAbbreviation(player.club);
 case "name": return player.name ?? "";
 case "age": return player.age;
 case "overall": return player.overall;
 case "positions": return positionsForPlayer(player).join(", ");
 case "contractYears": return freeAgentIds.has(player.id) ? 0 : (player.contract?.yearsRemaining ?? player.yearsRemaining);
 default: return "";
 }
 };
 const aValue = getValue(a);
 const bValue = getValue(b);
 const aMissing = aValue == null || aValue === "" || aValue === "—";
 const bMissing = bValue == null || bValue === "" || bValue === "—";
 if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
 const comparison = typeof aValue === "number" && typeof bValue === "number"
 ? aValue - bValue
 : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
 return sortConfig.direction === "asc" ? comparison : -comparison;
 });
 }, [databasePlayers, userClub.name, playerSearch, positionFilter, ageBandFilter, traitFilter, clubFilter, faOnlyFilter, activeTab, shortlistIds, sortConfig, freeAgentIds]);

 // Dynamic squad analysis
 const squadAnalysis = useMemo(
 () => analyzeSquad(databasePlayers, userClub.name, playerContracts),
 [databasePlayers, userClub.name, playerContracts]
 );

 const positionNeeds = useMemo(
 () => getTopPositionNeeds(databasePlayers, userClub.name, playerContracts),
 [databasePlayers, userClub.name, playerContracts]
 );

 // Players seeking moves
 const playersSeekingMoves = useMemo(
 () => getPlayersSeekingMoves(
 databasePlayers,
 playerContracts,
 userClub.name,
 { ...moveContext, seasonState, moveFactors: undefined },
 ),
 [databasePlayers, playerContracts, moveContext, userClub, seasonState]
 );
 const visibleSeekingMoves = useMemo(() => playersSeekingMoves
 .filter((item) => item.currentClub !== userClub.name)
 .filter((item) => seekingPositionFilter === "ALL" || positionsForPlayer(item.player).includes(seekingPositionFilter))
 .sort((a, b) => seekingSort === "salary"
 ? b.desiredSalaryRange.max - a.desiredSalaryRange.max
 : (Number(b.player.overall) || 0) - (Number(a.player.overall) || 0)),
 [playersSeekingMoves, seekingPositionFilter, seekingSort, userClub.name]);

 // Handle approaching a player
 const handleApproach = (player) => {
 const freeAgent = freeAgents.find(candidate => candidate.id === player.id);
 if (!(freeAgent ? canRecruitAgent(freeAgent) : tradePeriodOpen) || !tradeEligibility(player, seasonState, seasonYear).eligible) return;
 setNegotiationTarget(player);
 // Add to trade targets if not already there
 setTradeTargets((prev) => {
 if (prev.some((t) => t.player.id === player.id)) return prev;
 return [...prev, {
 player,
 status: "APPROACHED",
 negotiationStatus: "Club negotiation pending",
 offerHistory: [],
 clubResponse: null,
 estimatedDifficulty: getAcquisitionDifficulty(getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts)),
 }];
 });
 };

 const resetShopPackageSelection = () => {
 setShopOutgoingAssetKeys([]);
 setShopReturnPlayerIds([]);
 setShopReturnPickIds([]);
 };

 const handleTradeComplete = (result) => {
 if (!tradePeriodOpen) return;
 setNegotiationTarget(null);
 if (incomingContractNegotiation?.source === "SHOP") resetShopPackageSelection();
 // Update trade targets
 setTradeTargets((prev) => prev.map((t) =>
 t.player.id === result.player.id
 ? { ...t, status: "COMPLETED", negotiationStatus: "Trade completed" }
 : t
 ));
 onTradeOutcome?.({
 status: "SUCCESSFUL",
 source: result.isFreeAgent ? "Free Agency" : incomingContractNegotiation?.source === "SHOP" ? "Shop Your Assets" : "Trade Lab",
 otherClub: result.previousClub ?? incomingContractNegotiation?.buyerClub?.name,
 summary: `${result.player?.name ?? "Player"} joined ${result.newClub ?? userClub.name}; the trade was completed.`,
 offeredAssets: [...(result.outgoingPlayers ?? []).map((player) => player.name ?? player.id), ...(result.draftPickIds ?? []).map(String)],
 requestedAssets: [result.player?.name, ...(result.incomingDraftPickIds ?? []).map(String)].filter(Boolean),
 });
 if (onTradeComplete) onTradeComplete(result);
 };

 const [incomingFeedback, setIncomingFeedback] = useState("");
 const beginIncomingContract = (offer, packageToTrade, action) => {
 const userOffer = {
 players: [...(offer.targetPlayer ? [offer.targetPlayer] : []), ...(packageToTrade.userPlayers ?? [])],
 picks: [...(offer.targetPick ? [offer.targetPick] : []), ...(packageToTrade.userPicks ?? [])],
 };
 const aiReturn = { players: packageToTrade.players ?? [], picks: packageToTrade.picks ?? [] };
 if (!validTradePackage(aiReturn) || !validTradePackage(userOffer)) { setIncomingFeedback("Each side can include one to three assets, including the player being traded."); return false; }
 if (action === "COUNTER") {
 const evaluation = evaluatePackageExchange(userOffer, aiReturn, offer.fromClub, tradeValuationContext);
 setIncomingFeedback(evaluation.reason);
 if (!evaluation.accepted) return false;
 } else setIncomingFeedback("");
 const incomingPlayer = packageToTrade?.players?.[0];
 if (!incomingPlayer) {
 onRespondToAITradeOffer?.(offer, action, packageToTrade);
 return true;
 }
 const offerClub = clubs.find((club) => club.name === offer.fromClub);
 if (!offerClub) return false;
 setIncomingContractNegotiation({
 source: "INCOMING",
 offer,
 packageToTrade,
 action,
 offerClub,
 contracts: {},
 contractTargetPlayer: incomingPlayer,
 contractClub: userClub,
 });
 return true;
 };

 const canTradePlayer = (player) => !player?.recentlyMoved;
 const openGeniusShop = () => {
 setGeniusModeRequest((current) => ({ mode: "SHOP", sequence: current.sequence + 1 }));
 setGeniusNotice(null);
 setActiveTab("GENIUS");
 };
 // Salary-cap screen for a Trade Genius suggestion, using current contracts.
 // Other clubs that would breach the cap rule the trade out; the manager's own
 // club only gets a warning because incoming contracts are renegotiated.
 const buildGeniusCapCheck = () => (suggestion) => {
 const contracts = { ...(playerContracts ?? {}) };
 for (const leg of suggestion.legs) {
 for (const player of leg.give.players) contracts[String(player.id)] = { ...(contracts[String(player.id)] ?? player.contract ?? {}), club: leg.club };
 for (const player of leg.receive.players) contracts[String(player.id)] = { ...(contracts[String(player.id)] ?? player.contract ?? {}), club: userClub.name };
 }
 const pool = Array.isArray(playerPool) ? playerPool : [];
 for (const leg of suggestion.legs) {
 const check = checkClubCommitments(pool, contracts, leg.club, seasonYear, 0, seasonState.leagueAdministration?.[leg.club]);
 if (!check.ok) return { ok: false, reason: check.reason };
 }
 const own = checkClubCommitments(pool, contracts, userClub.name, seasonYear, 0, seasonState.clubAdministration);
 return own.ok ? { ok: true } : { ok: true, warning: `${own.reason} Negotiate lower salaries or send out more salary to make it work.` };
 };
 const beginGeniusTrade = (suggestion) => {
 if (!tradePeriodOpen) return;
 const incomingPlayers = suggestion.legs.flatMap((leg) => leg.receive.players);
 setGeniusNotice(null);
 // Pick-only returns need no contract negotiation.
 if (!incomingPlayers.length) { completeGeniusTrade({ suggestion }, {}); return; }
 setIncomingContractNegotiation({
 source: "GENIUS",
 suggestion,
 targetPlayer: incomingPlayers[0],
 contractTargetPlayer: incomingPlayers[0],
 incomingPlayers,
 contracts: {},
 buyerClub: userClub,
 });
 };
 const geniusLegForPlayer = (negotiation, player) => negotiation?.suggestion?.legs?.find((leg) =>
 leg.receive.players.some((candidate) => String(candidate.id) === String(player?.id)));
 const completeGeniusTrade = (negotiation, contracts) => {
 const legs = negotiation.suggestion.legs;
 const completion = onTradeGeniusComplete?.({
 legs: legs.map((leg) => ({
 targetClub: leg.club,
 outgoingPlayerIds: leg.give.players.map((player) => player.id),
 outgoingPickIds: leg.give.picks.map((pick) => pick.id),
 incomingPlayerIds: leg.receive.players.map((player) => player.id),
 incomingPickIds: leg.receive.picks.map((pick) => pick.id),
 })),
 incomingContracts: contracts,
 });
 if (completion?.ok === false) {
 setGeniusNotice({ ok: false, text: completion.reason ?? "The trade could not be applied." });
 return;
 }
 for (const leg of legs) {
 onTradeOutcome?.({
 status: "SUCCESSFUL",
 source: "Trade Genius",
 otherClub: leg.club,
 summary: `Trade Successful: ${leg.receive.players.map((player) => player.name).join(", ")} joined ${userClub.name}${legs.length > 1 ? ` (multi-club trade across ${legs.length} clubs)` : ""}.`,
 offeredAssets: [...leg.give.players.map((player) => player.name), ...leg.give.picks.map(formatDraftPick)],
 requestedAssets: [...leg.receive.players.map((player) => player.name), ...leg.receive.picks.map(formatDraftPick)],
 offeredValue: leg.offeredValue,
 requestedValue: leg.requestedValue,
 });
 }
 resetShopPackageSelection();
 setGeniusResetSequence((current) => current + 1);
 setGeniusNotice({ ok: true, text: legs.length > 1 ? `Multi-club trade completed with ${legs.map((leg) => leg.club).join(" and ")}.` : `Trade completed with ${legs[0].club}.` });
 };

 const submitShopTrade = () => {
 if (!tradePeriodOpen || !shopBuyerClubName) return;
 const outgoingPackage = { players: shopOutgoingPlayers, picks: shopOutgoingPicks };
 const returnPackage = { players: shopIncomingPlayers, picks: shopIncomingPicks };
 if ((!outgoingPackage.players.length && !outgoingPackage.picks.length) || (!returnPackage.players.length && !returnPackage.picks.length)) return;

 if (!validTradePackage(outgoingPackage) || !validTradePackage(returnPackage)) { setShopTradeResponse({ accepted: false, reason: "Maximum three assets per side." }); return; }
 const returnValue = calculateOfferValue(returnPackage, shopBuyerClubName, tradeValuationContext);
 const offeredValue = calculateOfferValue(outgoingPackage, shopBuyerClubName, tradeValuationContext);
 const requiredRate = getValuationTier(returnValue).requiredSurplusRate;
 const isUntouchable = shopIncomingPlayers.some((player) => isPlayerUntouchable(player, null, tradeValuationContext));
 const requiredValue = Math.round(returnValue * (isUntouchable ? 1.4 : 1 + requiredRate));
 const exchange = evaluatePackageExchange(outgoingPackage, returnPackage, shopBuyerClubName, tradeValuationContext);
 const accepted = exchange.accepted;
 const response = {
 accepted,
 offeredValue,
 requestedValue: returnValue,
 requiredValue,
 reason: accepted
 ? `${shopBuyerClubName} accepts the proposed asset package.${shopIncomingPlayers.length ? " The incoming player(s) still need to agree to contract terms." : ""}`
 : exchange.reason,
 };
 setShopTradeResponse(response);
 if (!accepted) {
 onTradeOutcome?.({
 status: "UNSUCCESSFUL",
 source: "Shop Your Assets",
 otherClub: shopBuyerClubName,
 summary: `${shopBuyerClubName} declined your offer for ${returnPackage.players.map((player) => player.name).concat(returnPackage.picks.map(formatDraftPick)).join(", ")}.`,
 offeredAssets: outgoingPackage.players.map((player) => player.name).concat(outgoingPackage.picks.map(formatDraftPick)),
 requestedAssets: returnPackage.players.map((player) => player.name).concat(returnPackage.picks.map(formatDraftPick)),
 offeredValue,
 requestedValue: returnValue,
 });
 return;
 }

 if (shopIncomingPlayers.length) {
 setIncomingContractNegotiation({
 source: "SHOP",
 targetPlayer: shopIncomingPlayers[0],
 contractTargetPlayer: shopIncomingPlayers[0],
 incomingPlayers: shopIncomingPlayers,
 contracts: {},
 buyerClub: userClub,
 packageToTrade: outgoingPackage,
 incomingPickIds: shopIncomingPicks.map((pick) => pick.id),
 });
 } else {
 const completion = onShopTradeComplete?.({
 targetClub: shopBuyerClubName,
 outgoingPlayerIds: shopOutgoingPlayers.map((player) => player.id),
 outgoingPickIds: shopOutgoingPicks.map((pick) => pick.id),
 incomingPlayerId: null,
 incomingPlayerIds: [],
 incomingPickIds: shopIncomingPicks.map((pick) => pick.id),
 });
 if (completion?.ok === false) {
 setShopTradeResponse({ accepted: false, reason: completion.reason ?? "The trade could not be applied." });
 return;
 }
 onTradeOutcome?.({
 status: "SUCCESSFUL",
 source: "Shop Your Assets",
 otherClub: shopBuyerClubName,
 summary: `Draft pick trade completed with ${shopBuyerClubName}.`,
 offeredAssets: outgoingPackage.players.map((player) => player.name).concat(outgoingPackage.picks.map(formatDraftPick)),
 requestedAssets: returnPackage.players.map((player) => player.name).concat(returnPackage.picks.map(formatDraftPick)),
 });
 resetShopPackageSelection();
 setShopTradeResponse({ accepted: true, successful: true, reason: "Trade Successful" });
 }
 };

 const tabStyle = (tab) => ({
 padding: "10px 14px",
 border: "none",
 borderRadius: "10px",
 cursor: "pointer",
 background: activeTab === tab ? "#ea580c" : (lightMode ? "#eef2f8" : "#1e293b"),
 color: activeTab === tab ? "white" : palette.text,
 fontWeight: "bold",
 });

 const cardStyle = {
 color: palette.text,
 background: palette.card,
 border: `1px solid ${palette.border}`,
 borderRadius: "16px",
 padding: "16px",
 marginBottom: "12px",
 };

 const playerPositions = (player) => positionsForPlayer(player).join(", ") || "—";
 const playerContractYears = (player) => {
 if (freeAgentIds.has(player.id)) return "FA";
 return formatContractDuration(player.contract?.yearsRemaining ?? player.yearsRemaining, { currentDate, seasonYear });
 };

 return (
 <main style={{ color: palette.text }}>
 <h2>Trade Lab</h2>

 {/* Tab navigation */}
 {!tradePeriodOpen && <div style={{ ...cardStyle, color: palette.muted }}>Trading and free-agent signings are available only during the two Trade Period weeks.</div>}
 <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
 <button type="button" style={tabStyle("DATABASE")} onClick={() => setActiveTab("DATABASE")}>PLAYER DATABASE</button>
 <button type="button" style={tabStyle("SHORTLIST")} onClick={() => { setActiveTab("SHORTLIST"); setPlayerSearch(""); setPositionFilter("ALL"); setAgeBandFilter("ALL"); setTraitFilter("ALL"); setClubFilter("ALL"); setFaOnlyFilter(false); }}>SHORTLIST{shortlistIds.size ? ` (${shortlistIds.size})` : ""}</button>
 <button type="button" style={tabStyle("INCOMING")} onClick={() => setActiveTab("INCOMING")}>INCOMING OFFERS{aiOffers.length ? ` (${aiOffers.length})` : ""}</button>
 <button type="button" style={tabStyle("OUTCOMES")} onClick={() => setActiveTab("OUTCOMES")}>TRADE OUTCOMES</button>
 <button type="button" style={tabStyle("SHOP")} onClick={() => setActiveTab("SHOP")}>SHOP YOUR ASSETS</button>
 <button type="button" style={tabStyle("GENIUS")} onClick={() => setActiveTab("GENIUS")}>TRADE GENIUS</button>
 <button type="button" style={tabStyle("NEEDS")} onClick={() => setActiveTab("NEEDS")}>POSITION NEEDS</button>
 <button type="button" style={tabStyle("SEEKING")} onClick={() => setActiveTab("SEEKING")}>PLAYERS SEEKING MOVES</button>
 <button type="button" style={tabStyle("TARGETS")} onClick={() => setActiveTab("TARGETS")}>TRADE TARGETS</button>
 <button type="button" style={tabStyle("FREEAGENTS")} onClick={() => setActiveTab("FREEAGENTS")}>FREE AGENTS</button>
 </div>

 <div aria-hidden={activeTab !== "GENIUS"} style={{ display: activeTab === "GENIUS" ? "block" : "none" }}>
 <TradeGenius
 palette={palette}
 lightMode={lightMode}
 cardStyle={cardStyle}
 userClub={userClub}
 userClubPlayers={userClubPlayers}
 userDraftPicks={userDraftPicks}
 databasePlayers={databasePlayers}
 draftPickAssets={seasonState.draftPickAssets ?? []}
 valuationContext={tradeValuationContext}
 tradePeriodOpen={tradePeriodOpen}
 canTradePlayer={canTradePlayer}
 buildCapCheck={buildGeniusCapCheck}
 shopOutgoingAssetKeys={shopOutgoingAssetKeys}
 setShopOutgoingAssetKeys={setShopOutgoingAssetKeys}
 modeRequest={geniusModeRequest}
 resetSequence={geniusResetSequence}
 notice={geniusNotice}
 onAccept={beginGeniusTrade}
 onOpenManualShop={() => setActiveTab("SHOP")}
 />
 </div>

 {activeTab === "SHOP" && (
 <section aria-label="Shop your assets">
 <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: "#ea580c" }}>
 <div style={{ flex: "1 1 320px" }}>
 <strong>Use Trade Genius</strong>
 <div style={{ color: palette.muted, fontSize: 13, marginTop: 3 }}>Skip the manual work: pick the assets you want to move and Trade Genius shows the best value deals every club will accept. You can still build a deal by hand below.</div>
 </div>
 <button type="button" onClick={openGeniusShop} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#ea580c", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Use Trade Genius</button>
 </div>
 <div style={cardStyle}>
 <h3 style={{ margin: "0 0 6px" }}>Your assets · approximate trade value</h3>
 <p style={{ margin: "0 0 12px", color: palette.muted, fontSize: 13 }}>Values are a starting estimate. Clubs value players differently based on list needs, age profile, and premiership window. Select up to three assets per side ({shopOutgoingAssetKeys.length}/3 selected). Package weights: strongest asset 100%, second 70%, third 49%.</p>
 {!tradePeriodOpen && <p style={{ color: "#f59e0b", margin: 0 }}>Trading is available during the two Trade Period weeks.</p>}
 <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
 <button
 type="button"
 disabled={!shopOutgoingAssetKeys.length}
 onClick={() => { setShopOutgoingAssetKeys([]); setShopTradeResponse(null); }}
 style={{ padding: "6px 11px", border: `1px solid ${palette.border}`, borderRadius: 7, background: palette.surface, color: shopOutgoingAssetKeys.length ? palette.text : palette.muted, fontSize: 12, fontWeight: 700, cursor: shopOutgoingAssetKeys.length ? "pointer" : "not-allowed", opacity: shopOutgoingAssetKeys.length ? 1 : 0.6 }}
 >Clear all</button>
 </div>
 <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${palette.border}`, borderRadius: 10 }}>
 <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", textAlign: "left" }}>
 <thead><tr style={{ color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>{[
 ["asset", "Asset"], ["type", "Position / type"], ["age", "Age"], ["overall", "Overall"], ["value", "Approx. value"],
 ].map(([key, label]) => <th key={key} aria-sort={shopSort.key === key ? (shopSort.direction === "asc" ? "ascending" : "descending") : "none"} style={{ padding: 9, textAlign: key === "age" || key === "overall" || key === "value" ? "right" : "left" }}><button type="button" onClick={() => toggleShopSort(key)} style={{ padding: 0, border: 0, background: "transparent", color: palette.muted, font: "inherit", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{label}{shopSort.key === key ? (shopSort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</button></th>)}</tr></thead>
 <tbody>
 {shopRows.map((row) => {
 const assetKey = `${row.kind === "Player" ? "player" : "pick"}:${row.assetId}`;
 const selected = shopOutgoingAssetKeys.includes(assetKey);
 const toggle = () => {
 setShopOutgoingAssetKeys((current) => {
 if (current.includes(assetKey)) return current.filter((key) => key !== assetKey);
 if (current.length >= 3) return current;
 return [...current, assetKey];
 });
 setShopTradeResponse(null);
 };
 return <tr key={row.id} style={{ borderBottom: `1px solid ${palette.border}`, background: selected ? (lightMode ? "#fff7ed" : "#2a1b16") : "transparent" }}>
 <td style={{ padding: 8 }}><button type="button" aria-pressed={selected} onClick={toggle} disabled={!tradePeriodOpen || Boolean(row.player?.recentlyMoved)} title={row.player?.recentlyMoved ? "Player recently moved clubs" : undefined} style={{ padding: "5px 7px", border: `1px solid ${selected ? "#ea580c" : "transparent"}`, borderRadius: 7, background: selected ? "#ea580c" : "transparent", color: selected ? "#fff" : palette.text, fontWeight: 750, textAlign: "left", cursor: tradePeriodOpen && !row.player?.recentlyMoved ? "pointer" : "not-allowed" }}>{row.asset}{row.player?.recentlyMoved ? " · Recently moved" : ""}</button></td>
 <td style={{ padding: 8, color: palette.muted }}>{row.type}</td>
 <td style={{ padding: 8, textAlign: "right" }}>{row.age ?? "—"}</td>
 <td style={{ padding: 8, textAlign: "right" }}>{row.overall ?? "—"}</td>
 <td style={{ padding: 8, fontWeight: 800, textAlign: "right" }}>{row.value.toLocaleString()} pts</td>
 </tr>;
 })}
 {!shopRows.length && <tr><td colSpan={5} style={{ padding: 12, color: palette.muted }}>No players or picks are available to shop.</td></tr>}
 </tbody>
 </table>
 </div>
 </div>

 {(shopOutgoingPlayers.length || shopOutgoingPicks.length) > 0 && (
 <div style={cardStyle}>
 <h3 style={{ margin: "0 0 6px" }}>Club specific valuations</h3>
 <p style={{ margin: "0 0 12px", color: palette.muted, fontSize: 13 }}>Estimated value to each club for your selected package: {shopOutgoingPlayers.length + shopOutgoingPicks.length} asset(s).</p>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
 {clubs.filter((club) => club.name !== userClub.name)
 .map((club) => ({
 ...club,
 packageValue: calculateOfferValue(
 { players: shopOutgoingPlayers, picks: shopOutgoingPicks },
 club.name,
 tradeValuationContext,
 ),
 }))
 .sort((a, b) => b.packageValue - a.packageValue)
 .map((club) => {
 const clubValue = club.packageValue;
 const leadInterest = shopOutgoingPlayers
 .map((player) => ({ player, ...getClubValuationDetails(player, club.name, tradeValuationContext) }))
 .sort((a, b) => Math.abs(b.adjustment) - Math.abs(a.adjustment))[0];
 const rationale = leadInterest
 ? `${leadInterest.player.name}: ${leadInterest.reason}`
 : shopOutgoingPicks.length
 ? "They value the added draft capital for future list building."
 : "No assets selected for valuation.";
 const selected = shopBuyerClubName === club.name;
 return <div key={club.id} style={{ display: "grid", gap: 4 }}>
 <button type="button" onClick={() => onOpenClub?.(club.name)} style={{ border: 0, padding: "4px 0", background: "none", color: palette.text, textAlign: "left", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>{club.name}</button>
 <button type="button" onClick={() => { setShopBuyerClubName(club.name); setShopReturnPlayerIds([]); setShopReturnPickIds([]); setShopTradeResponse(null); }} style={{ padding: 12, border: `1px solid ${selected ? "#ea580c" : palette.border}`, borderRadius: 10, background: selected ? palette.surface : palette.card, color: palette.text, textAlign: "left", cursor: "pointer" }}>
 <strong>Select {club.name}</strong><div style={{ marginTop: 4, color: palette.muted, fontSize: 12 }}>Club valuation</div><div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{clubValue.toLocaleString()} pts</div><div style={{ marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 1.4 }}>{rationale}</div>
 </button>
 </div>;
 })}
 </div>
 </div>
 )}

 {shopBuyerClubName && (
 <div style={cardStyle}>
 <h3 style={{ margin: "0 0 6px" }}>Build a deal with {shopBuyerClubName}</h3>
 <p style={{ margin: "0 0 12px", color: palette.muted, fontSize: 13 }}>Select any mix of up to three players and picks from {shopBuyerClubName}. Click an asset name again to remove it. Values shown are what the club assigns to each asset.</p>
 <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${palette.border}`, borderRadius: 10 }}>
 <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", textAlign: "left" }}>
 <thead><tr style={{ color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>
 {[["asset", "Asset"], ["type", "Position / type"], ["age", "Age"], ["overall", "Overall"], ["value", "Approx. value"]].map(([key, label]) => (
 <th key={key} aria-sort={shopReturnSort.key === key ? (shopReturnSort.direction === "asc" ? "ascending" : "descending") : "none"} style={{ padding: 9, textAlign: ["age", "overall", "value"].includes(key) ? "right" : "left" }}>
 <button type="button" onClick={() => toggleShopReturnSort(key)} style={{ padding: 0, border: 0, background: "transparent", color: palette.muted, font: "inherit", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{label}{shopReturnSort.key === key ? (shopReturnSort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</button>
 </th>
 ))}
 </tr></thead>
 <tbody>
 {shopReturnRows.map((row) => {
 const assetKey = String(row.assetId);
 const selected = row.kind === "Player" ? shopReturnPlayerIds.includes(assetKey) : shopReturnPickIds.includes(assetKey);
 const atLimit = !selected && shopReturnAssetCount >= 3;
 const toggle = () => {
 if (atLimit || !tradePeriodOpen) return;
 if (row.kind === "Player") {
 setShopReturnPlayerIds((current) => current.includes(assetKey) ? current.filter((id) => id !== assetKey) : current.length + shopReturnPickIds.length >= 3 ? current : [...current, assetKey]);
 } else {
 setShopReturnPickIds((current) => current.includes(assetKey) ? current.filter((id) => id !== assetKey) : current.length + shopReturnPlayerIds.length >= 3 ? current : [...current, assetKey]);
 }
 setShopTradeResponse(null);
 };
 return <tr key={row.id} style={{ borderBottom: `1px solid ${palette.border}`, background: selected ? (lightMode ? "#fff7ed" : "#2a1b16") : "transparent", opacity: !tradePeriodOpen || atLimit ? 0.55 : 1 }}>
 <td style={{ padding: 8 }}><button type="button" aria-pressed={selected} disabled={!tradePeriodOpen || atLimit} onClick={toggle} style={{ padding: "5px 7px", border: `1px solid ${selected ? "#ea580c" : "transparent"}`, borderRadius: 7, background: selected ? "#ea580c" : "transparent", color: selected ? "#fff" : palette.text, fontWeight: 750, textAlign: "left", cursor: tradePeriodOpen && !atLimit ? "pointer" : "not-allowed" }}>{row.asset}{selected ? " · SELECTED" : ""}</button></td>
 <td style={{ padding: 8, color: palette.muted }}>{row.type}</td>
 <td style={{ padding: 8, textAlign: "right" }}>{row.age ?? "—"}</td>
 <td style={{ padding: 8, textAlign: "right" }}>{row.overall ?? "—"}</td>
 <td style={{ padding: 8, fontWeight: 800, textAlign: "right", color: "#f59e0b" }}>{row.value.toLocaleString()} pts</td>
 </tr>;
 })}
 {!shopReturnRows.length && <tr><td colSpan={5} style={{ padding: 12, color: palette.muted }}>No players or picks available from this club.</td></tr>}
 </tbody>
 </table>
 </div>
 <p style={{ margin: "8px 0 0", color: palette.muted, fontSize: 12 }}>RETURN PACKAGE · {shopReturnAssetCount}/3 selected</p>
 <p style={{ margin: "12px 0", color: palette.muted }}>Their value for your package: <strong>{shopBuyerAssetValue.toLocaleString()} pts</strong></p>
 {shopTradeResponse && <div role="status" style={{ marginBottom: 10, color: shopTradeResponse.accepted ? "#22c55e" : "#f59e0b" }}>{shopTradeResponse.successful ? "Trade Successful" : <>{shopTradeResponse.reason} {shopTradeResponse.accepted && `Their return package is valued at ${shopTradeResponse.requestedValue.toLocaleString()} pts.`}</>}</div>}
 <button type="button" disabled={!tradePeriodOpen || !shopBuyerAssetValue || !shopReturnAssetCount} onClick={submitShopTrade} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: tradePeriodOpen ? "#ea580c" : "#64748b", color: "white", fontWeight: 700, cursor: tradePeriodOpen ? "pointer" : "not-allowed" }}>Propose trade</button>
 </div>
 )}
 </section>
 )}

 {/* PLAYER DATABASE */}
 {(activeTab === "DATABASE" || activeTab === "SHORTLIST") && (
 <section aria-label={activeTab === "SHORTLIST" ? "Shortlist" : "Player database"}>
 {activeTab === "SHORTLIST" && <div style={cardStyle}><h3 style={{ margin: "0 0 5px" }}>Shortlist</h3><p style={{ margin: 0, color: palette.muted }}>Players saved from scout dossiers. Current AFL players appear below; draft prospects remain on the Draft Board.</p></div>}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12, maxWidth: 920 }}>
 <label style={{ color: palette.text }}>
 Position
 <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} style={selectStyle(palette)}>
 <option value="ALL">All positions</option>
 {positionOptions.map((position) => <option key={position} value={position.toUpperCase()}>{position}</option>)}
 </select>
 </label>
 <label style={{ color: palette.text }}>
 Club
 <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)} style={selectStyle(palette)}>
 <option value="ALL">All clubs</option>
 <option value="FREE_AGENTS">Free Agents only</option>
 {clubs.map((club) => <option key={club.id} value={club.name}>{club.name}</option>)}
 </select>
 </label>
 <label style={{ color: palette.text }}>
 Age band
 <select value={ageBandFilter} onChange={(e) => setAgeBandFilter(e.target.value)} style={selectStyle(palette)}>
 <option value="ALL">All ages</option>
 <option value="U23">U23</option>
 <option value="24_29">24–29</option>
 <option value="30_PLUS">30+</option>
 </select>
 </label>
 <label style={{ color: palette.text }}>
 Trait
 <select value={traitFilter} onChange={(e) => setTraitFilter(e.target.value)} style={selectStyle(palette)}>
 <option value="ALL">All traits</option>
 <option value="HAS_TRAIT">Any trait</option>
 {traitOptions.map((trait) => <option key={trait.id} value={trait.id}>{trait.label}</option>)}
 </select>
 </label>
 </div>

 <label style={{ display: "block", marginBottom: 12, color: palette.text }}>
 Search player name
 <input type="search" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Type a player's name" style={{ ...inputStyle(palette), maxWidth: 480 }} />
 </label>

 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
 <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14, color: palette.text }}>
 <input type="checkbox" checked={faOnlyFilter} onChange={(e) => setFaOnlyFilter(e.target.checked)} />
 Free Agents only
 </label>
 </div>

 <p style={{ color: palette.muted, margin: "0 0 10px" }} aria-live="polite">
 {filteredPlayers.length} {activeTab === "SHORTLIST" ? "shortlisted AFL players" : "players found"}
 </p>

 <div style={{ ...cardStyle, overflowX: "auto", padding: 0 }}>
 <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", textAlign: "left" }}>
 <thead>
 <tr style={{ color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>
 {sortableColumns.map(({ key, label }) => {
 if (key === "actions" || key === "potential") return <th key={key} style={{ padding: "13px 14px", textAlign: "left" }}><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>{label}</span></th>;
 const isSorted = sortConfig.key === key;
 const ariaSort = isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none";
 return (
 <th key={key} scope="col" aria-sort={ariaSort} style={{ padding: "13px 14px", textAlign: "left" }}>
 <button type="button" onClick={() => changeSort(key)} style={{ padding: 0, border: 0, background: "transparent", color: palette.muted, font: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 0.7, cursor: "pointer", whiteSpace: "nowrap" }}>
 {label} {isSorted ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
 </button>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody>
 {filteredPlayers.map((player, index) => {
 const isFA = freeAgentIds.has(player.id);
 return (
 <tr key={player.id ?? `${player.club ?? "player"}-${player.name}-${index}`} style={{ borderBottom: `1px solid ${palette.border}` }}>
 <td style={{ padding: "12px 14px", color: isFA ? "#f59e0b" : palette.muted, fontWeight: 700 }}>
 {isFA ? "FA" : clubAbbreviation(player.club)}
 </td>
 <td style={{ padding: "12px 14px", fontWeight: 700 }}>{player.name}</td>
 <td style={{ padding: "12px 14px" }}>{player.age ?? "—"}</td>
 <td style={{ padding: "12px 14px" }}>{player.overall ?? "—"}</td>
 <td style={{ padding: "12px 14px" }}><PotentialStars player={player} /></td>
 <td style={{ padding: "12px 14px" }}>{playerPositions(player)}</td>
 <td style={{ padding: "12px 14px" }}>{playerContractYears(player)}</td>
 <td style={{ padding: "12px 14px" }}>
 <button
 disabled={!tradePeriodOpen || Boolean(player.recentlyMoved)}
 onClick={() => handleApproach(player)}
 style={{
 padding: "6px 12px", borderRadius: 8, cursor: tradePeriodOpen && !player.recentlyMoved ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700,
 background: tradePeriodOpen && !player.recentlyMoved ? "#ea580c" : "#64748b", color: "white", border: "none",
 }}
 >
 {player.recentlyMoved ? "Player recently moved clubs" : isFA ? "Recruit" : "Approach"}
 </button>
 </td>
 </tr>
 );
 })}
 {filteredPlayers.length === 0 && (
 <tr><td colSpan={8} style={{ padding: 18, color: palette.muted, textAlign: "center" }}>No players match those filters.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 {activeTab === "SHORTLIST" && shortlistedProspects.length > 0 && <div style={cardStyle}>
 <h3 style={{ margin: "0 0 10px" }}>Draft prospects</h3>
 {shortlistedProspects.map(prospect => <div key={prospect.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "10px 0", borderTop: `1px solid ${palette.border}` }}>
 <span><strong>{prospect.name}</strong> <span style={{ color: palette.muted }}>· {(prospect.positions ?? []).join(" / ")} · OVR {prospect.overall ?? "—"}</span></span>
 <button type="button" onClick={() => onViewDraftProspect?.(prospect.id)} style={{ padding: "7px 11px", border: 0, borderRadius: 8, background: "#ea580c", color: "white", fontWeight: 700, cursor: "pointer" }}>View Draft Board →</button>
 </div>)}
 </div>}
 </section>
 )}

 {activeTab === "INCOMING" && (
 <section aria-label="Incoming AI trade offers">
 {aiOffers.length === 0 ? (
 <div style={cardStyle}><p style={{ margin: 0, color: palette.muted }}>No unreviewed AI trade offers in this trade period.</p></div>
 ) : aiOffers.map((offer) => (
 <article key={offer.id} style={{ ...cardStyle, marginBottom: 12 }}>
 <h3 style={{ marginTop: 0 }}><button type="button" onClick={() => onOpenClub?.(offer.fromClub)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", fontWeight: "inherit", cursor: "pointer", textDecoration: "underline" }}>{offer.fromClub}</button> want {offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : "a club asset")}</h3>
 <p style={{ color: palette.muted }}>They offer {offer.offer?.players?.length ? offer.offer.players.map((player) => player.name).join(", ") : "no players"}{offer.offer?.picks?.length ? `${offer.offer?.players?.length ? " and " : ""}${offer.offer.picks.map(formatDraftPick).join(", ")}` : ""}.</p>
 <p>Estimated value: {Math.round(offer.offerValue)} · {offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : "Requested asset")} value: {Math.round(offer.targetValue)} · {Math.round((offer.returnRate ?? (offer.offerValue / Math.max(offer.targetValue, 1))) * 100)}% of requested value</p>
 {counteringOfferId === offer.id && (() => {
 const clubPlayers = databasePlayers.filter((player) => player.club === offer.fromClub && String(player.id) !== String(offer.targetPlayer?.id));
 const clubPicks = (seasonState.draftPickAssets ?? []).filter((pick) => pick.currentOwner === offer.fromClub);
 const ownPlayers = userClubPlayers.filter((player) => String(player.id) !== String(offer.targetPlayer?.id));
 const ownPicks = userDraftPicks.filter((pick) => String(pick.id) !== String(offer.targetPick?.id));
 const counterOffer = {
 players: clubPlayers.filter((player) => counterPlayerIds.includes(String(player.id))),
 picks: clubPicks.filter((pick) => counterPickIds.includes(String(pick.id))),
 userPlayers: ownPlayers.filter((player) => counterUserPlayerIds.includes(String(player.id))),
 userPicks: ownPicks.filter((pick) => counterUserPickIds.includes(String(pick.id))),
 };
 const currentPackage = { players: offer.offer?.players ?? [], picks: offer.offer?.picks ?? [] };
 const currentOfferValue = calculateOfferValue(currentPackage, userClub.name, tradeValuationContext);
 const counterOfferValue = calculateOfferValue(counterOffer, userClub.name, tradeValuationContext);
 const targetValue = offer.targetPlayer
 ? getClubSpecificValuation(offer.targetPlayer, userClub.name, tradeValuationContext)
 : calculatePickValue(offer.targetPick, tradeValuationContext);
 const toggle = (setItems, items, id, limit) => setItems((current) => current.includes(String(id)) ? current.filter((item) => item !== String(id)) : items.length >= limit ? current : [...current, String(id)]);
 const userOutgoingValue = calculateOfferValue({ players: [...(offer.targetPlayer ? [offer.targetPlayer] : []), ...counterOffer.userPlayers], picks: [...(offer.targetPick ? [offer.targetPick] : []), ...counterOffer.userPicks] }, offer.fromClub, tradeValuationContext);
 return (
 <div style={{ margin: "12px 0", padding: 12, border: `1px solid ${palette.border}`, borderRadius: 10 }}>
 <strong>Negotiate the offer</strong>
 <p style={{ margin: "6px 0 10px", color: palette.muted, fontSize: 13 }}>Choose what {offer.fromClub} sends and add any of your own players or picks to the deal. Their requested {offer.targetPlayer ? "player" : "pick"} is included automatically. Up to three assets per side.</p>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12, padding: 10, borderRadius: 8, background: palette.input, fontSize: 13 }}>
 <span>Current offer: <strong>{currentOfferValue.toLocaleString()} pts</strong></span>
 <span>Your player: <strong>{targetValue.toLocaleString()} pts</strong></span>
 <span>Counter package: <strong style={{ color: counterOfferValue >= targetValue ? "#22c55e" : "#f59e0b" }}>{counterOfferValue.toLocaleString()} pts</strong></span>
 <span>You send: <strong>{userOutgoingValue.toLocaleString()} pts</strong></span>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
 <div>
 <strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>{offer.fromClub} sends</strong>
 <div style={{ display: "grid", gap: 6, maxHeight: 190, overflow: "auto" }}>
 {clubPlayers.map((player) => {
 const value = getClubSpecificValuation(player, userClub.name, tradeValuationContext);
 const selected = counterPlayerIds.includes(String(player.id));
 return <label key={player.id} style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 8px", borderRadius: 7, border: `1px solid ${selected ? "#22c55e" : palette.border}`, background: selected ? `${palette.surface}` : "transparent", fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={selected} onChange={() => toggle(setCounterPlayerIds, [...counterPlayerIds, ...counterPickIds], player.id, 3)} /><span style={{ flex: 1 }}>{player.name} · {player.overall ?? "—"} OVR</span><strong>{value.toLocaleString()}</strong></label>;
 })}
 {clubPicks.map((pick) => {
 const value = calculatePickValue(pick, tradeValuationContext);
 const selected = counterPickIds.includes(String(pick.id));
 return <label key={pick.id} style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 8px", borderRadius: 7, border: `1px solid ${selected ? "#22c55e" : palette.border}`, background: selected ? `${palette.surface}` : "transparent", fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={selected} onChange={() => toggle(setCounterPickIds, [...counterPlayerIds, ...counterPickIds], pick.id, 3)} /><span style={{ flex: 1 }}>{formatDraftPick(pick)}</span><strong>{value.toLocaleString()}</strong></label>;
 })}
 </div>
 </div>
 <div>
 <strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>You add (target player already included)</strong>
 <div style={{ display: "grid", gap: 6, maxHeight: 190, overflow: "auto" }}>
 {ownPlayers.map((player) => {
 const value = getClubSpecificValuation(player, offer.fromClub, tradeValuationContext);
 const selected = counterUserPlayerIds.includes(String(player.id));
 return <label key={player.id} style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 8px", borderRadius: 7, border: `1px solid ${selected ? "#22c55e" : palette.border}`, background: selected ? palette.surface : "transparent", fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={selected} onChange={() => toggle(setCounterUserPlayerIds, [...counterUserPlayerIds, ...counterUserPickIds], player.id, 2)} /><span style={{ flex: 1 }}>{player.name} · {player.overall ?? "—"} OVR</span><strong>{value.toLocaleString()}</strong></label>;
 })}
 {ownPicks.map((pick) => {
 const value = calculatePickValue(pick, tradeValuationContext);
 const selected = counterUserPickIds.includes(String(pick.id));
 return <label key={pick.id} style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 8px", borderRadius: 7, border: `1px solid ${selected ? "#22c55e" : palette.border}`, background: selected ? palette.surface : "transparent", fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={selected} onChange={() => toggle(setCounterUserPickIds, [...counterUserPlayerIds, ...counterUserPickIds], pick.id, 2)} /><span style={{ flex: 1 }}>{formatDraftPick(pick)}</span><strong>{value.toLocaleString()}</strong></label>;
 })}
 </div>
 </div>
 </div>
 <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
 <button type="button" disabled={!tradePeriodOpen || (!counterOffer.players.length && !counterOffer.picks.length)} onClick={() => {
 if (!beginIncomingContract(offer, counterOffer, "COUNTER")) return;
 setCounteringOfferId(null); setCounterPlayerIds([]); setCounterPickIds([]); setCounterUserPlayerIds([]); setCounterUserPickIds([]);
 }} style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "#d97706", color: "white", fontWeight: 700, cursor: tradePeriodOpen ? "pointer" : "not-allowed" }}>Send counter</button>
 <button type="button" onClick={() => { setCounteringOfferId(null); setCounterPlayerIds([]); setCounterPickIds([]); setCounterUserPlayerIds([]); setCounterUserPickIds([]); }} style={{ padding: "8px 14px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.surface, color: palette.text, fontWeight: 700 }}>Cancel</button>
 </div>
 </div>
 );
 })()}
 <div style={{ display: "flex", gap: 8 }}>
 <button type="button" disabled={!tradePeriodOpen} onClick={() => beginIncomingContract(offer, { players: offer.offer?.players ?? [], picks: offer.offer?.picks ?? [] }, "ACCEPT")} style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "#16a34a", color: "white", fontWeight: 700, cursor: tradePeriodOpen ? "pointer" : "not-allowed" }}>{offer.offer?.players?.length ? "Accept & negotiate contract" : "Accept offer"}</button>
 <button type="button" disabled={!tradePeriodOpen} onClick={() => onRespondToAITradeOffer?.(offer, "DECLINE")} style={{ padding: "8px 14px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.surface, color: palette.text, fontWeight: 700, cursor: tradePeriodOpen ? "pointer" : "not-allowed" }}>Decline</button>
 <button type="button" disabled={!tradePeriodOpen} onClick={() => { setCounteringOfferId(offer.id); setCounterPlayerIds((offer.offer?.players ?? []).map((player) => String(player.id))); setCounterPickIds((offer.offer?.picks ?? []).map((pick) => String(pick.id))); setCounterUserPlayerIds([]); setCounterUserPickIds([]); }} style={{ padding: "8px 14px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.surface, color: palette.text, fontWeight: 700, cursor: tradePeriodOpen ? "pointer" : "not-allowed" }}>Negotiate</button>
 </div>
 </article>
 ))}
 </section>
 )}

 {activeTab === "OUTCOMES" && (
 <section aria-label="Trade outcomes">
 <div style={cardStyle}>
 <h3 style={{ margin: "0 0 6px" }}>Trade Outcomes</h3>
 <p style={{ margin: "0 0 14px", color: palette.muted, fontSize: 13 }}>A history of offers involving your club, including completed deals, declined offers, and rejected counters.</p>
 {tradeOutcomes.length === 0 ? (
 <p style={{ margin: 0, color: palette.muted }}>No trade outcomes recorded yet.</p>
 ) : tradeOutcomes.map((outcome) => (
 <article key={outcome.id} style={{ padding: "12px 0", borderTop: `1px solid ${palette.border}` }}>
 <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
 <strong style={{ color: outcome.status === "SUCCESSFUL" ? "#22c55e" : "#ef4444" }}>{outcome.status === "SUCCESSFUL" ? "Successful" : "Unsuccessful"}</strong>
 <strong>{outcome.otherClub ?? "Trade"}</strong>
 <span style={{ color: palette.muted, fontSize: 12 }}>{outcome.source} · {outcome.seasonYear ?? seasonYear}{outcome.date ? ` · ${outcome.date}` : ""}</span>
 </div>
 <div>{outcome.summary}</div>
 {(outcome.offeredAssets?.length > 0 || outcome.requestedAssets?.length > 0) && <div style={{ marginTop: 5, color: palette.muted, fontSize: 12 }}>Offered: {outcome.offeredAssets?.join(", ") || "—"} · Requested: {outcome.requestedAssets?.join(", ") || "—"}</div>}
 </article>
 ))}
 </div>
 </section>
 )}

 {/* POSITION NEEDS — Dynamic squad analysis */}
 {activeTab === "NEEDS" && (
 <section aria-label="Position needs">
 <div style={cardStyle}>
 <h3 style={{ margin: "0 0 4px" }}>Squad Analysis — {userClub.name}</h3>
 <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Squad Avg OVR</div>
 <div style={{ fontSize: 22, fontWeight: 800 }}>{squadAnalysis.overallQuality}</div>
 {squadAnalysis.overallRank != null && <div style={{ fontSize: 12, color: palette.muted }}>League rank {squadAnalysis.overallRank}/{squadAnalysis.leagueSize}</div>}
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Average Age</div>
 <div style={{ fontSize: 22, fontWeight: 800 }}>{squadAnalysis.averageAge}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Squad Size</div>
 <div style={{ fontSize: 22, fontWeight: 800 }}>{squadAnalysis.squadSize}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Status</div>
 <div style={{ fontSize: 18, fontWeight: 700, color: squadAnalysis.rebuildStatus === "Contending" ? "#22c55e" : squadAnalysis.rebuildStatus === "Rebuilding" ? "#f97316" : "#f59e0b" }}>{squadAnalysis.rebuildStatus}</div>
 </div>
 <div>
 <div style={{ fontSize: 12, color: palette.muted }}>Age Profile</div>
 <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
 <span style={{ color: "#3b82f6" }}>Young {squadAnalysis.ageProfile.young}</span>
 {" · "}
 <span style={{ color: "#22c55e" }}>Prime {squadAnalysis.ageProfile.prime}</span>
 {" · "}
 <span style={{ color: "#f97316" }}>Vet {squadAnalysis.ageProfile.veteran}</span>
 </div>
 </div>
 </div>
 </div>

 <p style={{ color: palette.muted, fontSize: 13, margin: "0 0 12px" }}>
 Position quality compares each club's best eligible starters with the league. A missing starter counts at replacement level; the bars show league standing, not raw overall.
 </p>
 {/* Position breakdown */}
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
 {Object.entries(squadAnalysis.positions).map(([key, data]) => (
 <div key={key} style={cardStyle}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
 <h4 style={{ margin: 0, fontSize: 15 }}>{data.label}</h4>
 <span style={{ fontSize: 12, fontWeight: 700, color: data.depth.color, background: `${data.depth.color}22`, padding: "2px 8px", borderRadius: 6 }}>{data.depth.label}</span>
 </div>
 <div style={{ fontSize: 13, color: palette.muted }}>
 {data.count} eligible · Best {data.starters} OVR {data.score} · League {data.leagueAverage}
 </div>
 <div style={{ fontSize: 12, color: palette.muted, marginTop: 3 }}>
 Rank {data.rank ?? '—'}/{data.leagueSize} · Avg age {data.averageAge}{data.missing ? ` · ${data.missing} starter${data.missing === 1 ? '' : 's'} missing` : ''}
 </div>
 <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: palette.surface }}>
 <div style={{ width: `${data.depth.rating}%`, height: "100%", borderRadius: 3, background: data.depth.color, transition: "width 0.3s ease" }} />
 </div>
 </div>
 ))}
 </div>

 {/* Insights */}
 {squadAnalysis.insights.length > 0 && (
 <div style={cardStyle}>
 <h4 style={{ margin: "0 0 8px", fontSize: 15 }}>Club Insights</h4>
 {squadAnalysis.insights.map((insight, i) => (
 <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: i > 0 ? `1px solid ${palette.border}` : "none" }}>
 <span style={{
 fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, flexShrink: 0,
 background: insight.type === "strength" ? "#22c55e22" : insight.type === "need" ? "#f9731622" : "#f59e0b22",
 color: insight.type === "strength" ? "#22c55e" : insight.type === "need" ? "#f97316" : "#f59e0b",
 }}>
 {insight.type === "strength" ? "STRENGTH" : `${insight.priority.toUpperCase()} NEED`}
 </span>
 <span style={{ fontSize: 14 }}>{insight.text}</span>
 </div>
 ))}
 </div>
 )}

 {/* Top position needs */}
 {positionNeeds.length > 0 && (
 <div style={cardStyle}>
 <h4 style={{ margin: "0 0 8px", fontSize: 15 }}>Priority Position Needs</h4>
 {positionNeeds.map((need, i) => (
 <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? `1px solid ${palette.border}` : "none" }}>
 <div>
 <span style={{ fontWeight: 700 }}>{need.label}</span>
 <span style={{ color: palette.muted, fontSize: 13, marginLeft: 8 }}>Best {squadAnalysis.positions[need.category]?.starters} OVR {need.starterQuality} · League {need.leagueAverage} · Rank {need.rank}/{need.leagueSize}</span>
 </div>
 <span style={{ fontSize: 12, fontWeight: 700, color: need.color, background: `${need.color}22`, padding: "2px 8px", borderRadius: 6 }}>
 {need.priority} · {need.depthLabel}
 </span>
 </div>
 ))}
 </div>
 )}
 </section>
 )}

 {/* PLAYERS SEEKING MOVES */}
 {activeTab === "SEEKING" && (
 <section aria-label="Players seeking moves">
 <p style={{ color: palette.muted, margin: "0 0 12px" }}>
 {visibleSeekingMoves.length} players are monitoring their options or actively seeking a move. Reasons use contract status, projected or actual senior opportunity, club direction, pay and player morale.
 </p>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
 <label style={{ color: palette.muted, fontSize: 13, fontWeight: 700 }}>
 Position{" "}
 <select value={seekingPositionFilter} onChange={(event) => setSeekingPositionFilter(event.target.value)} style={{ ...inputStyle(palette), display: "inline-block", width: "auto", minWidth: 110, marginLeft: 6 }}>
 <option value="ALL">All positions</option>
 {positionOptions.map((position) => <option key={position} value={position}>{position}</option>)}
 </select>
 </label>
 <label style={{ color: palette.muted, fontSize: 13, fontWeight: 700 }}>
 Sort by{" "}
 <select value={seekingSort} onChange={(event) => setSeekingSort(event.target.value)} style={{ ...inputStyle(palette), display: "inline-block", width: "auto", minWidth: 190, marginLeft: 6 }}>
 <option value="overall">Overall (high to low)</option>
 <option value="salary">Desired salary (high to low)</option>
 </select>
 </label>
 </div>
 {visibleSeekingMoves.length === 0 ? (
 <div style={cardStyle}><p style={{ margin: 0, color: palette.muted }}>{seekingPositionFilter === "ALL" ? "No players are currently seeking moves." : `No players seeking moves at ${seekingPositionFilter}.`}</p></div>
 ) : (
 visibleSeekingMoves.map((item, i) => (
 <div key={i} style={cardStyle}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
 <div>
 <span style={{ fontWeight: 800, fontSize: 16 }}>{item.player.name}</span>
 <span style={{ color: palette.muted, marginLeft: 8, fontSize: 14 }}>
 {clubAbbreviation(item.player.club)} · OVR {item.player.overall} · Age {item.player.age}
 </span>
 </div>
 <span style={{ fontSize: 12, fontWeight: 700, color: item.level.color, background: `${item.level.color}22`, padding: "3px 10px", borderRadius: 8 }}>
 {item.level.label}
 </span>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
 <div>
 <span style={{ color: palette.muted }}>Reason: </span>
 <span style={{ fontWeight: 600 }}>{item.reason}</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>Desired salary: </span>
 <span style={{ fontWeight: 600 }}>${item.desiredSalaryRange.min.toLocaleString()} – ${item.desiredSalaryRange.max.toLocaleString()}</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>Desired length: </span>
 <span style={{ fontWeight: 600 }}>{item.desiredContractLength} years</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>Current deal: </span>
 <span style={{ fontWeight: 600 }}>{formatContractDuration(item.yearsRemaining, { currentDate, seasonYear })}</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>{item.opportunityBasis === "actual" ? "Senior opportunities: " : "Projected role: "}</span>
 <span style={{ fontWeight: 600 }}>{item.opportunityBasis === "actual"
 ? `${item.appearances} appearance${item.appearances === 1 ? "" : "s"} · ${Math.round(item.opportunityRate * 100)}% of matches`
 : `${item.projectedDepthRank}${ordinal(item.projectedDepthRank)} in ${item.projectedDepthPosition} depth · about ${Math.round(item.opportunityRate * 23)} matches`}</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>Current club ladder: </span>
 <span style={{ fontWeight: 600 }}>{item.ladderRank ? `${item.ladderRank}${ordinal(item.ladderRank)}` : "Season not underway"}</span>
 </div>
 <div>
 <span style={{ color: palette.muted }}>Interest in {userClub.name}: </span>
 <span style={{ fontWeight: 700, color: item.userClubInterestLabel.color }}>{item.userClubInterestLabel.label}</span>
 </div>
 </div>
 {item.preferredDestinations.length > 0 && (
 <div style={{ marginTop: 6, fontSize: 13 }}>
 <span style={{ color: palette.muted }}>Preferred destinations: </span>
 {item.preferredDestinations.join(", ")}
 </div>
 )}
 <button
 disabled={!tradePeriodOpen}
 onClick={() => handleApproach(item.player)}
 style={{
 marginTop: 10, padding: "8px 16px", borderRadius: 8, cursor: tradePeriodOpen ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700,
 background: tradePeriodOpen ? "#ea580c" : "#64748b", color: "white", border: "none",
 }}
 >
 Approach {item.player.name}
 </button>
 </div>
 ))
 )}
 </section>
 )}

 {/* TRADE TARGETS — only players the user has approached */}
 {activeTab === "TARGETS" && (
 <section aria-label="Trade targets">
 <p style={{ color: palette.muted, margin: "0 0 12px" }}>
 Players you have approached or are currently negotiating for.
 </p>
 {tradeTargets.length === 0 ? (
 <div style={cardStyle}>
 <p style={{ margin: 0, color: palette.muted }}>You have not approached any players yet. Search the Player Database to find targets.</p>
 </div>
 ) : (
 tradeTargets.map((target, i) => {
 const careerPlayer = getCareerPlayer(target.player, playerDevelopment, seasonYear, playerContracts);
 return (
 <div key={i} style={cardStyle}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
 <div>
 <span style={{ fontWeight: 800, fontSize: 16 }}>{target.player.name}</span>
 <span style={{ color: palette.muted, marginLeft: 8, fontSize: 14 }}>
 {freeAgentIds.has(target.player.id) ? "Free Agent" : clubAbbreviation(target.player.club)} · OVR {careerPlayer.overall}
 </span>
 </div>
 <span style={{
 fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
 background: target.status === "COMPLETED" ? "#22c55e22" : target.status === "APPROACHED" ? "#3b82f622" : "#f59e0b22",
 color: target.status === "COMPLETED" ? "#22c55e" : target.status === "APPROACHED" ? "#3b82f6" : "#f59e0b",
 }}>
 {target.status}
 </span>
 </div>
 <div style={{ fontSize: 13, color: palette.muted, marginBottom: 6 }}>{target.negotiationStatus}</div>
 <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
 <div>
 <span style={{ color: palette.muted }}>Difficulty: </span>
 <span style={{ fontWeight: 700, color: target.estimatedDifficulty.color }}>{target.estimatedDifficulty.label}</span>
 </div>
 {target.offerHistory?.length > 0 && (
 <div>
 <span style={{ color: palette.muted }}>Offers made: </span>
 <span style={{ fontWeight: 600 }}>{target.offerHistory.length}</span>
 </div>
 )}
 </div>
 {target.status !== "COMPLETED" && (
 <button
 disabled={!tradePeriodOpen}
 onClick={() => handleApproach(target.player)}
 style={{
 marginTop: 10, padding: "8px 16px", borderRadius: 8, cursor: tradePeriodOpen ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700,
 background: tradePeriodOpen ? "#ea580c" : "#64748b", color: "white", border: "none",
 }}
 >
 Continue Negotiation
 </button>
 )}
 </div>
 );
 })
 )}
 </section>
 )}

 {incomingFeedback && <p role="status" style={{ color: palette.text }}>{incomingFeedback}</p>}
 {/* FREE AGENTS */}
 {activeTab === "FREEAGENTS" && (
 <section aria-label="Free agents">
 {concessionBase && <p style={{ margin: "0 0 12px", fontWeight: 700 }}>Tasmania concession: {concessionBase.remaining} signing{concessionBase.remaining === 1 ? "" : "s"} left, one player per club, for players out of contract after 2027. {tasmaniaConcessionWindow ? "The window is open until 18 October." : "The window is closed."}</p>}
 <p style={{ color: palette.muted, margin: "0 0 12px" }}>
 {freeAgents.length} eligible players. Restricted free agents may require a trade if their current club matches; delisted players can sign after contract expiry.
 </p>
 {freeAgents.length === 0 ? (
 <div style={cardStyle}><p style={{ margin: 0, color: palette.muted }}>No free agents are currently available.</p></div>
 ) : (
 <div style={{ ...cardStyle, overflowX: "auto", padding: 0 }}>
 <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", textAlign: "left" }}>
 <thead>
 <tr style={{ color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>PLAYER</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>PREV CLUB</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>STATUS</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>AGE</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>OVERALL</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>POSITION</th>
 <th style={{ padding: "13px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.7 }}>ACTIONS</th>
 </tr>
 </thead>
 <tbody>
 {freeAgents.map((fa, i) => {
 const careerPlayer = getCareerPlayer(fa, playerDevelopment, seasonYear, playerContracts);
 return (
 <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
 <td style={{ padding: "12px 14px", fontWeight: 700 }}>{fa.name}</td>
 <td style={{ padding: "12px 14px", color: palette.muted }}>{clubAbbreviation(fa.originalClub)}</td>
 <td style={{ padding: "12px 14px" }} title={fa.freeAgencyStatus?.reason}>{fa.freeAgencyStatus?.type === "TAS_CONCESSION" ? "CONCESSION" : fa.freeAgencyStatus?.type}</td>
 <td style={{ padding: "12px 14px" }}>{careerPlayer.age}</td>
 <td style={{ padding: "12px 14px" }}>{careerPlayer.overall}</td>
 <td style={{ padding: "12px 14px" }}>{playerPositions(fa)}</td>
 <td style={{ padding: "12px 14px" }}>
 <button
 disabled={!canRecruitAgent(fa)}
 onClick={() => handleApproach(fa)}
 style={{
 padding: "6px 12px", borderRadius: 8, cursor: canRecruitAgent(fa) ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700,
 background: canRecruitAgent(fa) ? "#ea580c" : "#64748b", color: "white", border: "none",
 }}
 >
 Recruit
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </section>
 )}

 {/* Trade Negotiation Modal */}
 {negotiationTarget && (freeAgentIds.has(negotiationTarget.id) ? canRecruitAgent(freeAgents.find(player => player.id === negotiationTarget.id)) : tradePeriodOpen) && (
 <TradeNegotiation
 targetPlayer={negotiationTarget}
 userClub={userClub}
 allPlayers={playerPool}
 playerDevelopment={playerDevelopment}
 playerContracts={playerContracts}
 userClubPicks={userDraftPicks}
 canTrade={freeAgentIds.has(negotiationTarget?.id) ? canRecruitAgent(freeAgents.find(player => player.id === negotiationTarget.id)) : tradePeriodOpen}
 seasonYear={seasonYear}
 currentDate={activeDate}
 clubAdministration={seasonState.clubAdministration}
 seasonState={seasonState}
 tasmaniaConcession={concessionOptions}
 leagueAdministration={seasonState.leagueAdministration}
 ladder={seasonState.ladder ?? []}
 appearance={appearance}
 onClose={() => setNegotiationTarget(null)}
 onComplete={handleTradeComplete}
 onTradeOutcome={onTradeOutcome}
 />
 )}
 {incomingContractNegotiation && tradePeriodOpen && (
 <TradeNegotiation
 key={`contract-${incomingContractNegotiation.source}-${incomingContractNegotiation.contractTargetPlayer?.id ?? incomingContractNegotiation.targetPlayer?.id}`}
 targetPlayer={incomingContractNegotiation.contractTargetPlayer ?? incomingContractNegotiation.targetPlayer}
 userClub={incomingContractNegotiation.contractClub ?? incomingContractNegotiation.buyerClub}
 allPlayers={databasePlayers}
 playerDevelopment={playerDevelopment}
 playerContracts={{ ...playerContracts, ...Object.fromEntries(Object.entries(incomingContractNegotiation.contracts ?? {}).map(([id, terms]) => [id, { ...terms, club: userClub.name, yearsRemaining: terms.years }])) }}
 userClubPicks={(seasonState.draftPickAssets ?? []).filter((pick) => pick.currentOwner === (incomingContractNegotiation.contractClub ?? incomingContractNegotiation.buyerClub).name)}
 canTrade={tradePeriodOpen}
 seasonYear={seasonYear}
 clubAdministration={seasonState.clubAdministration}
 seasonState={seasonState}
 leagueAdministration={seasonState.leagueAdministration}
 ladder={seasonState.ladder ?? []}
 initialPhase="PLAYER_NEGOTIATION"
 initialOffer={incomingContractNegotiation.source === "GENIUS" ? geniusLegForPlayer(incomingContractNegotiation, incomingContractNegotiation.contractTargetPlayer)?.give : incomingContractNegotiation.source === "INCOMING" ? { players: [incomingContractNegotiation.offer.targetPlayer], picks: [] } : incomingContractNegotiation.packageToTrade}
 transactionLabel={incomingContractNegotiation.source === "GENIUS" ? `Trade Genius · ${incomingContractNegotiation.contractTargetPlayer?.name ?? "Player"} contract` : incomingContractNegotiation.source === "INCOMING" ? `Incoming offer · ${incomingContractNegotiation.contractTargetPlayer?.name ?? "Player"} contract` : "Shop your assets · Player contract"}
 appearance={appearance}
 onClose={() => setIncomingContractNegotiation(null)}
 onTradeOutcome={onTradeOutcome}
 onComplete={(trade) => {
 if (incomingContractNegotiation.source === "GENIUS") {
 const contracts = { ...incomingContractNegotiation.contracts, [String(trade.player.id)]: trade.contract };
 const nextPlayer = incomingContractNegotiation.incomingPlayers.find((player) => !contracts[String(player.id)]);
 if (nextPlayer) {
 setIncomingContractNegotiation((current) => ({ ...current, contracts, contractTargetPlayer: nextPlayer }));
 return;
 }
 completeGeniusTrade(incomingContractNegotiation, contracts);
 } else if (incomingContractNegotiation.source === "INCOMING") {
 const contracts = { ...incomingContractNegotiation.contracts, [String(trade.player.id)]: trade.contract };
 const nextPlayer = incomingContractNegotiation.packageToTrade.players.find(player => !contracts[String(player.id)]);
 if (nextPlayer) {
 setIncomingContractNegotiation(current => ({ ...current, contracts, contractTargetPlayer: nextPlayer }));
 return;
 }
 onRespondToAITradeOffer?.(
 incomingContractNegotiation.offer,
 incomingContractNegotiation.action,
 { ...incomingContractNegotiation.packageToTrade, contracts },
 );
 } else {
 const contracts = { ...incomingContractNegotiation.contracts, [String(trade.player.id)]: trade.contract };
 const incomingPlayers = incomingContractNegotiation.incomingPlayers ?? [incomingContractNegotiation.targetPlayer];
 const nextPlayer = incomingPlayers.find((player) => !contracts[String(player.id)]);
 if (nextPlayer) {
 setIncomingContractNegotiation((current) => ({ ...current, contracts, contractTargetPlayer: nextPlayer }));
 return;
 }

 const completion = onShopTradeComplete?.({
 targetClub: shopBuyerClubName,
 outgoingPlayerIds: shopOutgoingPlayers.map((player) => player.id),
 outgoingPickIds: shopOutgoingPicks.map((pick) => pick.id),
 incomingPlayerId: incomingPlayers[0]?.id ?? null,
 incomingPlayerIds: incomingPlayers.map((player) => player.id),
 incomingPlayers,
 incomingPickIds: incomingContractNegotiation.incomingPickIds ?? [],
 incomingContracts: contracts,
 });
 if (completion?.ok === false) {
 setShopTradeResponse({ accepted: false, reason: completion.reason ?? "The trade could not be applied." });
 } else {
 onTradeOutcome?.({
 status: "SUCCESSFUL",
 source: "Shop Your Assets",
 otherClub: shopBuyerClubName,
 summary: `Trade Successful: ${[...incomingPlayers.map((player) => player.name), ...shopIncomingPicks.map(formatDraftPick)].join(", ")} joined ${userClub.name}.`,
 offeredAssets: [...shopOutgoingPlayers.map((player) => player.name), ...shopOutgoingPicks.map(formatDraftPick)],
 requestedAssets: [...incomingPlayers.map((player) => player.name), ...shopIncomingPicks.map(formatDraftPick)],
 offeredValue: calculateOfferValue({ players: shopOutgoingPlayers, picks: shopOutgoingPicks }, shopBuyerClubName, tradeValuationContext),
 requestedValue: calculateOfferValue({ players: incomingPlayers, picks: shopIncomingPicks }, shopBuyerClubName, tradeValuationContext),
 });
 resetShopPackageSelection();
 setShopTradeResponse({ accepted: true, successful: true, reason: "Trade Successful" });
 }
 }
 setIncomingContractNegotiation(null);
 }}
 />
 )}
 </main>
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

function selectStyle(palette) {
 return {
 display: "block",
 boxSizing: "border-box",
 width: "100%",
 marginTop: 6,
 padding: "11px 12px",
 border: `1px solid ${palette.border}`,
 borderRadius: 10,
 background: palette.input,
 color: palette.text,
 fontSize: 15,
 };
}

function ordinal(value) {
 const remainder = Number(value) % 100;
 if (remainder >= 11 && remainder <= 13) return "th";
 return ({ 1: "st", 2: "nd", 3: "rd" })[Number(value) % 10] ?? "th";
}

function inputStyle(palette) {
 return {
 display: "block",
 boxSizing: "border-box",
 width: "100%",
 marginTop: 6,
 padding: "11px 12px",
 border: `1px solid ${palette.border}`,
 borderRadius: 10,
 background: palette.input,
 color: palette.text,
 fontSize: 15,
 };
}