import { useMemo } from "react";
import ClubBadge from "./ClubBadge.jsx";
import { COUNTER_STYLES, TACTIC_SLIDERS, TACTIC_STYLES } from "../engine/tacticsEngine.js";
import { recommendMatchupSwap } from "../engine/matchupEngine.js";

// Ground layout: rows run from the attacking end to the defensive end.
const GROUND_ROWS = [
  { label: "Forward pockets", slots: ["FP1", "FF", "FP2"] },
  { label: "Half forwards", slots: ["HF1", "CHF", "HF2"] },
  { label: "Wings & centre", slots: ["W1", "C", "W2"] },
  { label: "Followers", slots: ["RR", "R", "ROV"] },
  { label: "Half backs", slots: ["HB1", "CHB", "HB2"] },
  { label: "Back pockets", slots: ["BP1", "FB", "BP2"] },
];
const LINE_LABELS = { forward: "Forwards", midfield: "Midfield", defence: "Defence" };
const RED = "#f87171";
const AMBER = "#fbbf24";

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const ordinal = (n) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
};
const readableAttribute = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
const resultInvolves = (result, club) => (result.homeTeam ?? result.home) === club || (result.awayTeam ?? result.away) === club;

/** One club's season so far, read from the completed rounds. */
function seasonRecord(roundHistory = [], clubName) {
  const games = roundHistory
    .flatMap((entry) => (entry.results ?? []).map((result) => ({ ...result, round: entry.round })))
    .filter((result) => resultInvolves(result, clubName))
    .sort((a, b) => Number(b.round) - Number(a.round))
    .map((result) => {
      const isHome = (result.homeTeam ?? result.home) === clubName;
      const forPoints = Number(isHome ? result.homeScore : result.awayScore);
      const againstPoints = Number(isHome ? result.awayScore : result.homeScore);
      const opponent = isHome ? (result.awayTeam ?? result.away) : (result.homeTeam ?? result.home);
      return { round: result.round, opponent, forPoints, againstPoints, outcome: forPoints > againstPoints ? "W" : forPoints < againstPoints ? "L" : "D" };
    });
  const wins = games.filter((game) => game.outcome === "W").length;
  const losses = games.filter((game) => game.outcome === "L").length;
  const forTotal = games.reduce((sum, game) => sum + game.forPoints, 0);
  const againstTotal = games.reduce((sum, game) => sum + game.againstPoints, 0);
  return {
    games, wins, losses, draws: games.length - wins - losses,
    averageFor: games.length ? forTotal / games.length : null,
    averageAgainst: games.length ? againstTotal / games.length : null,
  };
}

function Meter({ value, max = 20, palette }) {
  // A centred bar: green to the right when you have the edge, red to the left when they do.
  const clamped = Math.max(-max, Math.min(max, Number(value) || 0));
  const width = `${(Math.abs(clamped) / max) * 50}%`;
  return (
    <div style={{ position: "relative", height: 10, borderRadius: 6, background: palette.surface, border: `1px solid ${palette.border}` }}>
      <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: palette.muted, opacity: 0.6 }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 6, width, background: clamped >= 0 ? palette.green : RED, [clamped >= 0 ? "left" : "right"]: "50%" }} />
    </div>
  );
}

export default function OppositionReport({
  palette, cardStyle, club, opponentName, upcomingMatch, seasonState = {}, isHome = null, isMatchDay = false,
  predictedLineup = [], unavailable = [], opponentStyle, counterPlan, currentPlan, onApplyCounter,
  ownGroupProfile = [], opponentGroupProfile = [], matchupModel, matchupAnalytics,
}) {
  const record = useMemo(() => seasonRecord(seasonState.roundHistory, opponentName), [seasonState.roundHistory, opponentName]);
  const ladderIndex = (seasonState.ladder ?? []).findIndex((entry) => entry.club === opponentName);
  const lastMeeting = useMemo(() => (seasonState.roundHistory ?? [])
    .flatMap((entry) => (entry.results ?? []).map((result) => ({ ...result, round: entry.round })))
    .filter((result) => resultInvolves(result, opponentName) && resultInvolves(result, club?.name))
    .sort((a, b) => Number(b.round) - Number(a.round))[0] ?? null, [seasonState.roundHistory, opponentName, club?.name]);
  const swap = useMemo(() => (matchupModel ? recommendMatchupSwap(matchupModel) : null), [matchupModel]);

  const bySlot = Object.fromEntries(predictedLineup.map((entry) => [entry.position, entry.player]));
  const interchange = predictedLineup.filter((entry) => String(entry.position).startsWith("INT"));
  const threats = [...predictedLineup].sort((a, b) => Number(b.player.overall ?? 0) - Number(a.player.overall ?? 0)).slice(0, 5);
  const threatIds = new Set(threats.slice(0, 3).map((entry) => String(entry.player.id)));
  const ovrColor = (value) => (value >= 80 ? palette.green : value >= 70 ? palette.blue : value >= 60 ? AMBER : palette.muted);
  const pairs = matchupAnalytics?.matchups ?? [];
  const bestPairs = [...pairs].sort((a, b) => b.edge - a.edge).slice(0, 3);
  const worstPairs = [...pairs].sort((a, b) => a.edge - b.edge).slice(0, 3).filter((pair) => pair.edge < 0);
  const opponentStyleName = opponentStyle?.style?.name;
  const counterStyle = counterPlan ? TACTIC_STYLES.find((style) => style.id === counterPlan.style) : null;
  const counterDiffers = counterPlan && currentPlan && (counterPlan.style !== currentPlan.style
    || TACTIC_SLIDERS.some(({ id }) => Math.abs(Number(counterPlan.sliders?.[id] ?? 50) - Number(currentPlan.sliders?.[id] ?? 50)) >= 6));
  const idealCounters = opponentStyle ? (COUNTER_STYLES[opponentStyle.style.id] ?? []) : [];
  const sliderLeanText = (plan) => TACTIC_SLIDERS.map(({ id, left, right }) => {
    const value = Number(plan?.sliders?.[id] ?? 50);
    return Math.abs(value - 50) >= 8 ? (value < 50 ? left : right) : null;
  }).filter(Boolean);

  const sectionTitle = (kicker, title, color = palette.accent) => (
    <div style={{ marginBottom: 12 }}>
      <span style={{ color, fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>{kicker}</span>
      <h3 style={{ margin: "4px 0 0" }}>{title}</h3>
    </div>
  );
  const chip = (text, color) => (
    <span style={{ padding: "6px 10px", borderRadius: 9, color, background: palette.surface, border: `1px solid ${palette.border}`, fontWeight: 800, fontSize: 12 }}>{text}</span>
  );
  const playerCard = (slot, player) => {
    const injured = player && unavailable.some((item) => String(item.player.id) === String(player.id));
    const isThreat = player && threatIds.has(String(player.id));
    return (
      <div key={slot} style={{ flex: "1 1 0", minWidth: 0, padding: "8px 10px", borderRadius: 10, background: palette.surface, border: `1px solid ${isThreat ? AMBER : palette.border}`, opacity: injured ? 0.5 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <small style={{ color: palette.muted, fontWeight: 800 }}>{slot}</small>
          {isThreat && <small style={{ color: AMBER, fontWeight: 800 }}>THREAT</small>}
        </div>
        {player ? <>
          <strong style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</strong>
          <strong style={{ color: ovrColor(Number(player.overall ?? 0)), fontSize: 12 }}>{player.overall ?? "—"} OVR</strong>
        </> : <span style={{ color: palette.muted, fontSize: 12 }}>Vacant</span>}
      </div>
    );
  };

  return (
    <>
      <section style={{ ...cardStyle, borderTop: `4px solid ${palette.accent}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <ClubBadge club={opponentName} size={72} />
          <div style={{ flex: "1 1 240px" }}>
            <span style={{ color: palette.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>
              {upcomingMatch.round ?? `ROUND ${seasonState.round ?? 1}`} · OPPOSITION SCOUTING
            </span>
            <h3 style={{ fontSize: 26, margin: "4px 0" }}>{opponentName}</h3>
            <p style={{ color: palette.muted, margin: 0 }}>
              {isHome === null ? "" : isHome ? "Away for them" : "Home for them"}
              {upcomingMatch.venue ? ` · ${upcomingMatch.venue}` : ""}{upcomingMatch.date ? ` · ${upcomingMatch.date}` : ""}
            </p>
          </div>
          {chip(isMatchDay ? "Match day · team sheets lodged" : "Predicted team", palette.blue)}
        </div>
        <p style={{ color: palette.muted, margin: "14px 0 0", fontSize: 13 }}>
          {isMatchDay
            ? "Their team is based on the latest selection model and may change by the time the sheets are published."
            : "Team sheets are not lodged yet. This is the 23 their selectors would pick today from fit, available players."}
        </p>
      </section>

      <section style={cardStyle}>
        {sectionTitle("SEASON SNAPSHOT", "How they are going")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10 }}>
          {[
            ["Ladder", ladderIndex >= 0 ? ordinal(ladderIndex + 1) : "—"],
            ["Record", record.games.length ? `${record.wins}-${record.losses}${record.draws ? `-${record.draws}` : ""}` : "—"],
            ["Avg for", record.averageFor === null ? "—" : record.averageFor.toFixed(0)],
            ["Avg against", record.averageAgainst === null ? "—" : record.averageAgainst.toFixed(0)],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 12, borderRadius: 12, background: palette.surface, border: `1px solid ${palette.border}` }}>
              <small style={{ color: palette.muted, fontWeight: 800 }}>{label.toUpperCase()}</small>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }}>
          <small style={{ color: palette.muted, fontWeight: 800 }}>LAST 5</small>
          {record.games.slice(0, 5).reverse().map((game) => (
            <span key={game.round} title={`R${game.round} v ${game.opponent}: ${game.forPoints}-${game.againstPoints}`}
              style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, color: "#fff",
                background: game.outcome === "W" ? palette.green : game.outcome === "L" ? RED : palette.muted }}>{game.outcome}</span>
          ))}
          {!record.games.length && <span style={{ color: palette.muted, fontSize: 13 }}>No completed games yet this season.</span>}
        </div>
        {lastMeeting && <p style={{ color: palette.muted, fontSize: 13, margin: "12px 0 0" }}>
          Last meeting this season: Round {lastMeeting.round}, {lastMeeting.homeTeam ?? lastMeeting.home} {lastMeeting.homeScore} – {lastMeeting.awayScore} {lastMeeting.awayTeam ?? lastMeeting.away}.
        </p>}
      </section>

      <section style={cardStyle}>
        {sectionTitle("LIKELY LINEUP", `${predictedLineup.length}/23 named`, palette.blue)}
        {predictedLineup.length === 0 && <p style={{ color: palette.muted }}>No available opposition players were found for this fixture.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {GROUND_ROWS.map((row) => (
            <div key={row.label}>
              <small style={{ color: palette.muted, fontWeight: 800 }}>{row.label.toUpperCase()}</small>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>{row.slots.map((slot) => playerCard(slot, bySlot[slot]))}</div>
            </div>
          ))}
          {interchange.length > 0 && <div>
            <small style={{ color: palette.muted, fontWeight: 800 }}>INTERCHANGE</small>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {interchange.map(({ position, player }) => <div key={position} style={{ flex: "1 1 130px", display: "flex" }}>{playerCard(position, player)}</div>)}
            </div>
          </div>}
        </div>
      </section>

      <section style={cardStyle}>
        {sectionTitle("PLAYERS TO WATCH", "Key threats", AMBER)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
          {threats.map(({ position, player }) => {
            const topAttributes = Object.entries(player.attributes ?? {})
              .filter(([key, value]) => Number.isFinite(Number(value)) && !["durability", "professionalism"].includes(key))
              .sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 2);
            const pair = pairs.find((item) => item.opponentSlot === position);
            return (
              <article key={player.id} style={{ padding: 12, borderRadius: 12, background: palette.surface, border: `1px solid ${palette.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{player.name}</strong><strong style={{ color: ovrColor(Number(player.overall ?? 0)) }}>{player.overall}</strong>
                </div>
                <small style={{ color: palette.muted }}>{position}{pair ? ` · faces ${pair.ownName}` : ""}</small>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {topAttributes.map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: palette.muted }}>{readableAttribute(key)}</span><b>{Math.round(Number(value))}</b></div>)}
                </div>
                {pair && <small style={{ display: "block", marginTop: 8, color: pair.edge >= 5 ? palette.green : pair.edge <= -5 ? RED : palette.muted }}>
                  Your edge: {pair.edge > 0 ? "+" : ""}{pair.edge}
                </small>}
              </article>
            );
          })}
        </div>
        {unavailable.length > 0 && <div style={{ marginTop: 14 }}>
          <small style={{ color: palette.muted, fontWeight: 800 }}>OUT OF THEIR SQUAD</small>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {unavailable.slice(0, 8).map(({ player, reason }) => (
              <span key={player.id} style={{ padding: "5px 9px", borderRadius: 8, background: palette.surface, border: `1px solid ${palette.border}`, fontSize: 12 }}>
                {player.name} <b style={{ color: ovrColor(Number(player.overall ?? 0)) }}>{player.overall}</b> <span style={{ color: RED }}>{reason}</span>
              </span>
            ))}
          </div>
        </div>}
      </section>

      <section style={cardStyle}>
        {sectionTitle("HEAD TO HEAD", "Where the game is won", palette.green)}
        {matchupAnalytics ? <>
          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(LINE_LABELS).map(([key, label]) => {
              const edge = matchupAnalytics.lines?.[key]?.edge ?? 0;
              return (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "100px 1fr 170px", alignItems: "center", gap: 10 }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <Meter value={edge} palette={palette} />
                  <span style={{ fontSize: 12, color: edge >= 3 ? palette.green : edge <= -3 ? RED : palette.muted }}>
                    {edge >= 3 ? `You have the edge (+${edge})` : edge <= -3 ? `They have the edge (${edge})` : "Evenly matched"}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12, marginTop: 16 }}>
            <div>
              <small style={{ color: palette.green, fontWeight: 800 }}>YOUR BEST MATCHUPS</small>
              {bestPairs.map((pair) => <div key={pair.ownSlot} style={{ marginTop: 6, fontSize: 13 }}><b>{pair.ownName}</b> v {pair.opponentName} <span style={{ color: palette.green }}>+{pair.edge}</span></div>)}
            </div>
            <div>
              <small style={{ color: RED, fontWeight: 800 }}>DANGER MATCHUPS</small>
              {worstPairs.length ? worstPairs.map((pair) => <div key={pair.ownSlot} style={{ marginTop: 6, fontSize: 13 }}><b>{pair.ownName}</b> v {pair.opponentName} <span style={{ color: RED }}>{pair.edge}</span></div>)
                : <div style={{ marginTop: 6, fontSize: 13, color: palette.muted }}>No clear mismatches against you.</div>}
            </div>
          </div>
          {swap && <p style={{ margin: "14px 0 0", padding: 12, borderRadius: 10, background: palette.surface, border: `1px solid ${palette.border}`, fontSize: 13 }}>
            <b>Suggested swap:</b> move {swap.firstPlayer} ({swap.firstSlot}) and {swap.secondPlayer} ({swap.secondSlot}) for a combined +{swap.improvement} across both matchups.
          </p>}
        </> : <p style={{ color: palette.muted }}>Matchups appear once both sides have a predicted lineup.</p>}
        {ownGroupProfile.length > 0 && <div style={{ marginTop: 16 }}>
          <small style={{ color: palette.muted, fontWeight: 800 }}>ATTRIBUTE PROFILE · YOU v THEM</small>
          {ownGroupProfile.map(({ name, value }) => {
            const theirs = opponentGroupProfile.find((item) => item.name === name)?.value ?? 0;
            const gap = value - theirs;
            return (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 150px", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 13 }}>{name}</span>
                <Meter value={gap} max={8} palette={palette} />
                <span style={{ fontSize: 12, color: palette.muted }}><b style={{ color: palette.blue }}>{value.toFixed(1)}</b> / <b style={{ color: AMBER }}>{theirs ? theirs.toFixed(1) : "—"}</b></span>
              </div>
            );
          })}
        </div>}
      </section>

      <section style={cardStyle}>
        {sectionTitle("TACTICAL READ", "How they will play and how to beat it", palette.purple)}
        {opponentStyle ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 12, background: palette.surface, border: `1px solid ${palette.border}` }}>
            <small style={{ color: palette.muted, fontWeight: 800 }}>THEIR LIKELY APPROACH</small>
            <h4 style={{ margin: "7px 0" }}>{opponentStyleName}</h4>
            <p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>{opponentStyle.style.description}</p>
            <strong style={{ color: palette.green, display: "block", marginTop: 10 }}>{opponentStyle.fit.score}% squad fit</strong>
            {sliderLeanText(opponentStyle.plan).length > 0 && <p style={{ color: palette.muted, fontSize: 12, margin: "8px 0 0" }}>Leaning: {sliderLeanText(opponentStyle.plan).join(" · ")}</p>}
            {(opponentStyle.plan.rationale ?? []).map((reason) => <small key={reason} style={{ display: "block", color: palette.muted, marginTop: 4 }}>• {reason}</small>)}
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: palette.surface, border: `1px solid ${counterDiffers ? palette.accent : palette.border}` }}>
            <small style={{ color: palette.muted, fontWeight: 800 }}>SUGGESTED COUNTER</small>
            {counterStyle ? <>
              <h4 style={{ margin: "7px 0" }}>{counterStyle.name}</h4>
              <p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>
                {idealCounters.includes(counterStyle.id) ? `A recognised answer to ${opponentStyleName}.` : "Your squad's strongest fit against this opposition."}
              </p>
              {sliderLeanText(counterPlan).length > 0 && <p style={{ color: palette.muted, fontSize: 12, margin: "8px 0 0" }}>Leaning: {sliderLeanText(counterPlan).join(" · ")}</p>}
              {(counterPlan.rationale ?? []).map((reason) => <small key={reason} style={{ display: "block", color: palette.muted, marginTop: 4 }}>• {reason}</small>)}
              <button type="button" disabled={!counterDiffers} onClick={() => onApplyCounter?.(counterPlan)}
                style={{ marginTop: 12, padding: "9px 13px", borderRadius: 10, border: `1px solid ${palette.accent}`, color: "#fff", background: counterDiffers ? palette.accent : palette.muted, opacity: counterDiffers ? 1 : 0.6, cursor: counterDiffers ? "pointer" : "default", fontWeight: 700 }}>
                {counterDiffers ? "Apply counter plan" : "Your plan already matches"}
              </button>
            </> : <p style={{ color: palette.muted, fontSize: 13 }}>Not enough squad data to suggest a counter.</p>}
          </div>
        </div> : <p style={{ color: palette.muted }}>There is not enough squad data to estimate their style.</p>}
        <p style={{ color: palette.muted, fontSize: 13, marginBottom: 0, marginTop: 13 }}>
          This is an estimate from their squad, form and your own approach, not a confirmed instruction. They adjust to your style as well.
        </p>
      </section>
    </>
  );
}
