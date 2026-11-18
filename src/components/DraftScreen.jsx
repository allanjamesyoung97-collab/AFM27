import { dayKey } from "../engine/simulationClock.js";
import { rulesForDate, isMovementWindow } from "../engine/seasonRules.js";
import { useEffect, useMemo, useState } from "react";
import { evaluateDraftPickExchange, formatDraftPick, getCurrentDraftClub, getEligibleDraftProspects, isBidProspect } from "../engine/draftEngine.js";
import {
  MATCH_PICK_CAP_THROUGH,
  connectionLabel,
  draftValueIndex,
  getLadderRank,
  getMatchOptions,
  getPickMeta,
  matchAdjustment,
  planBestMatch,
  validateMatchPlan,
} from "../engine/draftBiddingEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import DraftBoard from "./DraftBoard.jsx";

const positionFilters = ["All positions", "Midfield", "Defence", "Forward", "Ruck"];
const roleForFilter = { Midfield: "Midfielder", Defence: "Defender", Forward: "Forward", Ruck: "Ruck" };

export default function DraftScreen({
  scoutingAccuracy = 0.69,
  seasonState = {},
  currentDate,
  userClub,
  players = [],
  onDraftPick,
  onDraftBid,
  onResolveDraftBid,
  onDraftPass,
  onAdvanceAI,
  onTradePicks,
  focusPlayerId = null,
  focusSequence = 0,
}) {
  const draft = seasonState.draftState;
  const [positionFilter, setPositionFilter] = useState("All positions");
  const [search, setSearch] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const shortlistIds = useMemo(() => new Set((seasonState.scoutingShortlist ?? []).map(String)), [seasonState.scoutingShortlist]);
  const [tradeClub, setTradeClub] = useState("");
  const [offeredPickIds, setOfferedPickIds] = useState([]);
  const [requestedPickIds, setRequestedPickIds] = useState([]);
  const [pickTradeMessage, setPickTradeMessage] = useState("");
  const [matchPickIndices, setMatchPickIndices] = useState([]);
  const [bidMessage, setBidMessage] = useState("");
  const cardStyle = {
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  };
  const currentClub = getCurrentDraftClub(draft);
  const activeDate = currentDate instanceof Date ? currentDate : currentDate ? new Date(currentDate) : null;
  const rules = activeDate ? rulesForDate(seasonState, activeDate) : null;
  const draftDate = draft?.kind === "MID_SEASON" ? rules?.midSeasonDraft : draft?.kind === "ROOKIE" ? rules?.rookieDraft : rules?.nationalDraft;
  const isDraftNight = Boolean(activeDate && draft && draftDate && Number(draft.draftYear) === activeDate.getFullYear() && dayKey(activeDate) >= draftDate);
  const tradePeriodOpen = Boolean(activeDate && isMovementWindow(seasonState, activeDate));
  const canTradePicks = tradePeriodOpen && !(draft?.picks?.length) && !(draft?.pickIndex > 0);
  const draftPickAssets = seasonState.draftPickAssets ?? [];
  const otherPickClubs = [...new Set(draftPickAssets.map((pick) => pick.currentOwner).filter((club) => club && club !== userClub?.name))];
  const userPicks = draftPickAssets.filter((pick) => pick.currentOwner === userClub?.name);
  const otherPicks = draftPickAssets.filter((pick) => pick.currentOwner === tradeClub);
  const offeredPicks = userPicks.filter((pick) => offeredPickIds.includes(String(pick.id)));
  const requestedPicks = otherPicks.filter((pick) => requestedPickIds.includes(String(pick.id)));
  const pickExchange = evaluateDraftPickExchange({ offeredPicks, requestedPicks, seasonYear: seasonState.seasonYear ?? 2027 });
  const userTurn = Boolean(isDraftNight && currentClub && currentClub === userClub?.name);
  const eligibleProspects = useMemo(() => getEligibleDraftProspects(draft), [draft]);

  useEffect(() => {
    if (!focusSequence || focusPlayerId == null) return;
    const target = eligibleProspects.find(prospect => String(prospect.id) === String(focusPlayerId));
    if (!target) return;
    setSearch(target.name ?? "");
    setPositionFilter("All positions");
    setShortlistOnly(false);
  }, [focusSequence, focusPlayerId]);

  useEffect(() => {
    if (isDraftNight && draft && !draft.completed && currentClub && !userTurn && !draft.pendingBid) onAdvanceAI?.();
  }, [isDraftNight, draft?.pickIndex, draft?.completed, currentClub, userTurn, draft?.pendingBid, onAdvanceAI]);

  const pendingBid = draft?.pendingBid && draft.pendingBid.homeClub === userClub?.name ? draft.pendingBid : null;
  const pendingOptions = useMemo(() => pendingBid ? getMatchOptions(draft, pendingBid.homeClub, pendingBid.bidIndex) : null, [draft, pendingBid]);
  const pendingSuggested = useMemo(() => pendingBid ? planBestMatch(draft, pendingBid.homeClub, pendingBid.bidIndex) : null, [draft, pendingBid]);
  const pendingCheck = pendingBid ? validateMatchPlan(draft, pendingBid.homeClub, pendingBid.bidIndex, matchPickIndices) : null;
  useEffect(() => { setMatchPickIndices([]); setBidMessage(""); }, [draft?.pendingBid?.prospectId, draft?.pendingBid?.bidIndex]);
  const toggleMatchPick = (index) => setMatchPickIndices((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index]);
  const answerBid = (match) => {
    const error = onResolveDraftBid?.({ match, pickIndices: matchPickIndices });
    setBidMessage(error ?? "");
  };
  const tiedProspects = eligibleProspects.filter((prospect) => prospect.connection);
  const myTied = tiedProspects.filter((prospect) => prospect.connection.club === userClub?.name);
  const pickMeta = draft ? getPickMeta(draft) : [];
  const userRank = draft ? getLadderRank(draft, userClub?.name) : null;

  const visibleProspects = eligibleProspects.filter((prospect) => {
    const matchesPosition = positionFilter === "All positions" || prospect.role === roleForFilter[positionFilter];
    const matchesSearch = `${prospect.name} ${prospect.juniorClub}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesPosition && matchesSearch && (!shortlistOnly || shortlistIds.has(String(prospect.id)));
  });
  const latestDraft = (seasonState.draftHistory ?? []).at(-1);
  const completedPicks = draft?.picks ?? latestDraft?.picks ?? [];
  const lastRound = pickMeta.reduce((max, entry) => Math.max(max, entry.round ?? 1), 1);
  const round = draft ? (pickMeta[draft.pickIndex]?.round ?? lastRound) : null;
  const displayRound = draft?.completed ? lastRound : round;

  const togglePickId = (id, setIds) => {
    const key = String(id);
    setIds((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]);
    setPickTradeMessage("");
  };

  const submitPickExchange = () => {
    if (!canTradePicks || !pickExchange.accepted) return;
    onTradePicks?.({
      targetClub: tradeClub,
      outgoingPickIds: offeredPicks.map((pick) => pick.id),
      incomingPickIds: requestedPicks.map((pick) => pick.id),
    });
    setPickTradeMessage(`Accepted: ${pickExchange.reason}`);
    setOfferedPickIds([]);
    setRequestedPickIds([]);
  };

  if (!draft) {
    return (
      <main style={{ color: "#f8fafc" }}>
        <h2>Draft Night</h2>
        <section style={cardStyle}><p style={{ margin: 0, color: "#94a3b8" }}>The next draft will open during the offseason.</p></section>
        {latestDraft?.picks?.length > 0 && <DraftResults picks={latestDraft.picks} userClub={userClub} cardStyle={cardStyle} title={`${latestDraft.draftYear} draft results`} />}
      </main>
    );
  }

  return (
    <main style={{ color: "#f8fafc" }}>
      <h2>{canTradePicks ? `Draft Board · ${draft.draftYear}` : `${draft.kind === "MID_SEASON" ? "Mid-season Draft" : draft.kind === "ROOKIE" ? "Rookie Draft" : "Draft Night"} · ${draft.draftYear}`}</h2>
      {canTradePicks && <section style={cardStyle}>
        <h3 style={{ margin: "0 0 8px" }}>Trade Draft Picks</h3>
        <p style={{ color: "#94a3b8", margin: "0 0 12px" }}>Available during Trade Period weeks only. Select picks from both clubs; future picks are discounted for uncertainty and the other club requires value parity plus a small premium.</p>
        <label style={{ display: "grid", gap: 5, maxWidth: 420, color: "#94a3b8", fontSize: 13 }}>Trade with
          <select value={tradeClub} onChange={(event) => { setTradeClub(event.target.value); setRequestedPickIds([]); setPickTradeMessage(""); }} style={{ padding: 9, borderRadius: 8 }}>
            <option value="">Choose a club</option>
            {otherPickClubs.map((club) => <option key={club} value={club}>{club}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <PickSelection title="Your picks to offer" picks={userPicks} selectedIds={offeredPickIds} onToggle={(id) => togglePickId(id, setOfferedPickIds)} />
          <PickSelection title={`${tradeClub || "Other club"} picks requested`} picks={otherPicks} selectedIds={requestedPickIds} onToggle={(id) => togglePickId(id, setRequestedPickIds)} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #334155" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            Offer value <strong style={{ color: "#f8fafc" }}>{pickExchange.offeredValue}</strong> · Requested value <strong style={{ color: "#f8fafc" }}>{pickExchange.requestedValue}</strong>
            {offeredPicks.length > 0 && requestedPicks.length > 0 && <div style={{ marginTop: 4, color: pickExchange.accepted ? "#4ade80" : "#fca5a5" }}>{pickExchange.reason}</div>}
            {pickTradeMessage && <div role="status" style={{ marginTop: 4, color: "#4ade80" }}>{pickTradeMessage}</div>}
          </div>
          <button type="button" disabled={!tradeClub || !pickExchange.accepted} onClick={submitPickExchange} style={{ border: 0, borderRadius: 9, padding: "10px 16px", background: tradeClub && pickExchange.accepted ? "#ea580c" : "#475569", color: "white", fontWeight: 800, cursor: tradeClub && pickExchange.accepted ? "pointer" : "not-allowed" }}>Submit pick offer</button>
        </div>
      </section>}
      <section style={cardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div>
            <strong style={{ fontSize: 20 }}>{draft.completed ? "Draft complete" : `Round ${round} · Pick ${draft.pickIndex + 1} of ${draft.totalPicks}`}</strong>
            <div style={{ color: "#94a3b8", marginTop: 5 }}>
              {draft.completed ? `${draft.picks.filter((pick) => !pick.passed).length} players selected · ${draft.picks.filter((pick) => pick.passed).length} passes` : `${currentClub} is on the clock`}
            </div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Scouting confidence · {Math.round((Number(scoutingAccuracy) || 0.69) * 100)}%</div>
        </div>
        {draft.initial && <p style={{ color: "#94a3b8", margin: "12px 0 0" }}>The first class follows the 2026 Zero Hanger power rankings, with generated prospects completing the five-round draft pool.</p>}
        {!draft.completed && <div style={{ height: 8, background: "#1e293b", borderRadius: 99, overflow: "hidden", marginTop: 14 }}><div style={{ height: "100%", width: `${(draft.pickIndex / draft.totalPicks) * 100}%`, background: "#ea580c" }} /></div>}
      </section>

      {pendingBid && pendingOptions && <section style={{ ...cardStyle, borderColor: "#7c3aed" }}>
        <h3 style={{ margin: "0 0 6px" }}>Bid received: {pendingBid.prospectName}</h3>
        <p style={{ color: "#cbd5e1", marginTop: 0 }}>
          {pendingBid.bidClub} has bid on your {connectionLabel(draft.availableProspects.find((prospect) => String(prospect.id) === String(pendingBid.prospectId))?.connection).split(" · ")[0].toLowerCase()} prospect at <strong>pick {pendingBid.bidPickNumber}</strong>. Match the bid with your own later picks, or let it stand and they take him.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
          <Stat label="Pick value" value={`${pendingOptions.baseValue} pts`} />
          <Stat label={`Ladder ${pendingOptions.adjustment > 0 ? "loading" : pendingOptions.adjustment < 0 ? "discount" : "adjustment"}`} value={pendingOptions.adjustment === 0 ? "None" : `${pendingOptions.adjustment > 0 ? "+" : ""}${Math.round(pendingOptions.adjustment * 100)}% (finished ${pendingOptions.ladderRank ?? "?"})`} />
          <Stat label="Points to match" value={`${pendingOptions.requiredPoints} pts`} strong />
          <Stat label="Most picks you can use" value={pendingOptions.bidPickNumber <= MATCH_PICK_CAP_THROUGH ? `${pendingOptions.maxPicks} (bid at 1–${MATCH_PICK_CAP_THROUGH})` : "No limit"} />
        </div>
        <strong style={{ fontSize: 13, color: "#94a3b8" }}>Your picks available to match (traded-in picks cannot be used)</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 12px" }}>
          {pendingOptions.eligiblePicks.length ? pendingOptions.eligiblePicks.map((entry) => {
            const selected = matchPickIndices.includes(entry.index);
            return <button key={entry.index} type="button" aria-pressed={selected} onClick={() => toggleMatchPick(entry.index)} style={{ border: `1px solid ${selected ? "#a78bfa" : "#475569"}`, borderRadius: 8, padding: "7px 10px", background: selected ? "#5b21b6" : "#1e293b", color: "#f8fafc", cursor: "pointer", fontSize: 13 }}>Pick {entry.pickNumber} · {entry.points} pts</button>;
          }) : <span style={{ color: "#94a3b8", fontSize: 13 }}>You have no eligible picks left, so you could only match with a deficit.</span>}
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 10 }}>
          Selected: <strong>{pendingCheck?.plan?.points ?? 0} pts</strong> of {pendingOptions.requiredPoints}
          {pendingCheck?.plan?.deficit > 0 && <span style={{ color: "#fbbf24" }}> · deficit {pendingCheck.plan.deficit} pts (you can carry up to {pendingOptions.deficitAllowance}; it costs your next first-round pick)</span>}
          {pendingCheck && !pendingCheck.ok && matchPickIndices.length > 0 && <div style={{ color: "#fca5a5", marginTop: 4 }}>{pendingCheck.reason}</div>}
          {pendingCheck?.ok && pendingCheck.plan.points > pendingOptions.requiredPoints && <div style={{ color: "#94a3b8", marginTop: 4 }}>{pendingCheck.plan.surplus} surplus pts are not refunded.</div>}
        </div>
        {bidMessage && <div role="alert" style={{ color: "#fca5a5", marginBottom: 8 }}>{bidMessage}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {pendingSuggested?.feasible && <button type="button" onClick={() => setMatchPickIndices(pendingSuggested.plan.indices)} style={{ ...draftButtonStyle, background: "#334155", border: "1px solid #475569" }}>Use suggested picks</button>}
          <button type="button" disabled={!pendingCheck?.ok} onClick={() => answerBid(true)} style={{ ...draftButtonStyle, background: pendingCheck?.ok ? "#7c3aed" : "#475569", cursor: pendingCheck?.ok ? "pointer" : "not-allowed" }}>Match bid</button>
          <button type="button" onClick={() => answerBid(false)} style={{ ...draftButtonStyle, background: "#334155", border: "1px solid #475569" }}>Let the bid stand</button>
        </div>
      </section>}

      <DraftBoard draft={draft} pickMeta={pickMeta} lastRound={lastRound} displayRound={displayRound} userClubName={userClub?.name} picks={draft.picks ?? []} />

      {tiedProspects.length > 0 && <section style={cardStyle}>
        <h3 style={{ margin: "0 0 6px" }}>Father-son &amp; academy prospects</h3>
        <p style={{ color: "#94a3b8", margin: "0 0 10px", fontSize: 13 }}>
          Any club can bid on these prospects at its own pick; the home club can match using its own later picks. Matching costs draft value index points: {userRank != null ? `as a ${userRank <= 2 ? "grand finalist" : userRank <= 4 ? "top-four club" : userRank > 10 ? "club that missed finals" : "finals club"}, your bids at picks 1–18 ${matchAdjustment(userRank, 1) > 0 ? `carry a ${Math.round(matchAdjustment(userRank, 1) * 100)}% loading` : matchAdjustment(userRank, 1) < 0 ? `get a ${Math.round(-matchAdjustment(userRank, 1) * 100)}% discount` : "have no loading or discount"}` : "ladder loadings apply to bids at picks 1–18"}.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}>{["Rank", "Prospect", "Link", "Est. cost to match at his rank", ""].map((heading) => <th key={heading} style={{ padding: "8px 7px", borderBottom: "1px solid #334155" }}>{heading}</th>)}</tr></thead>
            <tbody>{tiedProspects.map((prospect) => {
              const mine = prospect.connection.club === userClub?.name;
              const homeRank = getLadderRank(draft, prospect.connection.club);
              const cost = Math.round(draftValueIndex(prospect.rank) * (1 + matchAdjustment(homeRank, prospect.rank)));
              return <tr key={prospect.id} style={{ background: mine ? "#2e1065aa" : "transparent" }}>
                <td style={cellStyle}>#{prospect.rank}</td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{prospect.name}<small style={{ display: "block", color: "#94a3b8", fontWeight: 400 }}>{prospect.positions?.join(" / ")} · {prospect.juniorClub}</small></td>
                <td style={cellStyle}><ConnectionBadge prospect={prospect} draft={draft} userClub={userClub} /></td>
                <td style={cellStyle}>{cost} pts</td>
                <td style={{ ...cellStyle, color: "#94a3b8", fontSize: 12 }}>{prospect.connection.type === "FATHER_SON" && prospect.connection.fatherName ? `Father: ${prospect.connection.fatherName}, ${prospect.connection.fatherGames} games` : ""}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {myTied.length > 0 && <p style={{ color: "#c4b5fd", margin: "10px 0 0", fontSize: 13 }}>Your connected prospects can be drafted outright with your own pick, with no matching cost, if nobody bids first.</p>}
      </section>}

      {(draft.bidLog ?? []).length > 0 && <section style={cardStyle}>
        <h3 style={{ margin: "0 0 8px" }}>Bids &amp; matches</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {[...draft.bidLog].reverse().map((entry) => <div key={entry.id} style={{ padding: "8px 10px", borderRadius: 8, background: "#1e293b", border: `1px solid ${entry.matched ? "#7c3aed" : "#334155"}`, fontSize: 13 }}>
            <strong>Pick {entry.pickNumber}:</strong> {entry.bidClub} bid on {entry.prospectName} ({entry.homeClub}). {entry.matched
              ? <span style={{ color: "#c4b5fd" }}>{entry.homeClub} matched with {entry.picksUsed.length === 1 ? "pick" : "picks"} {entry.picksUsed.join(" & ")} ({entry.pointsUsed}/{entry.requiredPoints} pts{entry.deficit > 0 ? `, ${entry.deficit} pt deficit` : ""}).{entry.compensationTo ? ` ${entry.compensationTo} receive a compensation pick.` : ""}</span>
              : <span style={{ color: "#94a3b8" }}>Not matched, so {entry.bidClub} took him ({entry.reason}).</span>}
          </div>)}
        </div>
      </section>}

      {!draft.completed && <section style={{ ...cardStyle, borderColor: userTurn ? "#ea580c" : "#334155" }}>
        <h3 style={{ margin: "0 0 12px" }}>{!isDraftNight ? "Draft night is scheduled in the offseason" : userTurn ? `${userClub.name} selection` : `${currentClub} selecting`}</h3>
        {!isDraftNight ? <p style={{ color: "#94a3b8", marginBottom: 0 }}>Picks open when the offseason reaches Draft Night.</p> : userTurn ? <>
          <p style={{ color: "#94a3b8", marginTop: 0 }}>Choose any available prospect, or pass on this selection. Rankings are guidance; consider your list needs and the player's potential.</p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr)", gap: 10, marginBottom: 12 }}>
            <label style={{ color: "#94a3b8", fontSize: 13 }}>Search prospects
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player or junior club" style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: 5, padding: 10, borderRadius: 8 }} />
            </label>
            <label style={{ color: "#94a3b8", fontSize: 13 }}>Position
              <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5, padding: 10, borderRadius: 8 }}>
                {positionFilters.map((filter) => <option key={filter}>{filter}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#f8fafc" }}><input type="checkbox" checked={shortlistOnly} onChange={event => setShortlistOnly(event.target.checked)} /> Shortlisted prospects only</label>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}>{["Rank", "Prospect", "Position", "Junior club", "Link", "OVR", "Assessment", ""].map((heading) => <th key={heading} style={{ padding: "9px 7px", borderBottom: "1px solid #334155" }}>{heading}</th>)}</tr></thead>
              <tbody>{visibleProspects.map((prospect) => <tr key={prospect.id}>
                <td style={cellStyle}>#{prospect.rank}<small style={{ display: "block", color: "#94a3b8" }}>{prospect.rank === draft.pickIndex + 1 ? "On rank" : `${prospect.rank - (draft.pickIndex + 1) > 0 ? "+" : ""}${prospect.rank - (draft.pickIndex + 1)} from pick`}</small></td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{prospect.name}</td>
                <td style={cellStyle}>{prospect.positions.join(" / ")}</td>
                <td style={{ ...cellStyle, color: "#94a3b8" }}>{prospect.juniorClub}</td>
                <td style={cellStyle}><ConnectionBadge prospect={prospect} draft={draft} userClub={userClub} /></td>
                <td style={cellStyle}>{prospect.overall}</td>
                <td style={cellStyle}>POT: <PotentialStars potential={prospect.potential} /></td>
                <td style={cellStyle}>{isBidProspect(draft, prospect, userClub?.name)
                  ? <button type="button" onClick={() => { if (window.confirm(`Bid on ${prospect.name} at pick ${draft.pickIndex + 1}? ${prospect.connection.club} can match the bid. If they do not, ${prospect.name} is yours at this pick.`)) onDraftBid?.(prospect.id); }} style={{ ...draftButtonStyle, background: "#7c3aed" }}>Bid</button>
                  : <button type="button" onClick={() => onDraftPick?.(prospect.id)} style={draftButtonStyle}>Draft</button>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!visibleProspects.length && <p style={{ color: "#94a3b8" }}>No eligible prospects match this filter.</p>}
          <button type="button" onClick={() => onDraftPass?.()} style={{ ...draftButtonStyle, marginTop: 12, background: "#334155", border: "1px solid #475569" }}>Pass this pick</button>
        </> : <p style={{ color: "#94a3b8", marginBottom: 0 }}>The assistant is weighing available prospects against the club’s list needs.</p>}
      </section>}

      {completedPicks.length > 0 && <DraftResults picks={completedPicks} userClub={userClub} cardStyle={cardStyle} title={draft.completed ? "Complete draft results" : "Selections so far"} />}
    </main>
  );
}

function PickSelection({ title, picks, selectedIds, onToggle }) {
  return <div style={{ border: "1px solid #334155", borderRadius: 10, padding: 10 }}>
    <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflowY: "auto" }}>
      {picks.length ? picks.map((pick) => {
        const selected = selectedIds.includes(String(pick.id));
        return <button key={pick.id} type="button" aria-pressed={selected} onClick={() => onToggle(pick.id)} style={{ border: `1px solid ${selected ? "#ea580c" : "#475569"}`, borderRadius: 8, padding: "7px 9px", background: selected ? "#9a3412" : "#1e293b", color: "#f8fafc", cursor: "pointer", fontSize: 12 }}>{formatDraftPick(pick)}</button>;
      }) : <span style={{ color: "#94a3b8", fontSize: 13 }}>No picks available.</span>}
    </div>
  </div>;
}

function ConnectionBadge({ prospect, draft, userClub }) {
  if (!prospect.connection) return <span style={{ color: "#64748b" }}>—</span>;
  const mine = prospect.connection.club === userClub?.name;
  const homeRank = getLadderRank(draft, prospect.connection.club);
  return <span title={`${connectionLabel(prospect.connection)}${homeRank ? ` · finished ${homeRank}` : ""}`} style={{ display: "inline-block", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: mine ? "#5b21b6" : "#334155", color: "#f8fafc", whiteSpace: "nowrap" }}>
    {prospect.connection.type === "FATHER_SON" ? "F-S" : prospect.connection.academyType === "NORTHERN" ? "ACAD" : "NGA"} · {prospect.connection.club}
  </span>;
}

function Stat({ label, value, strong = false }) {
  return <div style={{ padding: "8px 10px", borderRadius: 8, background: "#1e293b", border: "1px solid #334155" }}>
    <div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div>
    <div style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? 18 : 14, marginTop: 2 }}>{value}</div>
  </div>;
}

const cellStyle = { padding: "10px 7px", borderBottom: "1px solid #1e293b", verticalAlign: "middle" };
const draftButtonStyle = { border: 0, borderRadius: 8, padding: "8px 12px", color: "white", background: "#ea580c", fontWeight: 800, cursor: "pointer" };

function DraftResults({ picks, userClub, cardStyle, title }) {
  return <section style={cardStyle}>
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: "#94a3b8", textAlign: "left" }}>{["Pick", "Club", "Player", "Position", "OVR", "POT assessment", "Junior club", "Note"].map((heading) => <th key={heading} style={{ padding: "10px 8px", borderBottom: "1px solid #334155" }}>{heading}</th>)}</tr></thead>
        <tbody>{picks.map((pick) => <tr key={`${pick.year}-${pick.pick}-${pick.club}`} style={{ background: pick.club === userClub?.name ? "#17255455" : "transparent" }}>
          <td style={cellStyle}>{pick.pick}</td><td style={cellStyle}>{pick.club}</td>
          <td style={{ ...cellStyle, fontWeight: 700 }}>{pick.passed ? "Passed" : pick.playerName}<small style={{ display: "block", color: "#94a3b8", fontWeight: 400 }}>{pick.passed ? "No player selected" : `Ranked #${pick.rank}`}</small></td>
          <td style={cellStyle}>{pick.positions?.join(" / ") ?? "—"}</td><td style={cellStyle}>{pick.overall ?? "—"}</td>
          <td style={cellStyle}>{pick.passed ? "—" : <>POT: <PotentialStars potential={pick.potential} /></>}</td><td style={{ ...cellStyle, color: "#94a3b8" }}>{pick.juniorClub ?? "—"}</td>
          <td style={{ ...cellStyle, fontSize: 12, color: "#c4b5fd" }}>{pick.matchedBid ? `Matched bid by ${pick.matchedBid.bidClub} (picks ${pick.matchedBid.picksUsed.join(" & ")})` : pick.viaBid ? "Taken via bid" : pick.connection ? connectionLabel(pick.connection) : ""}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}