import { useEffect, useState } from "react";
import { brownlowCount } from "../engine/brownlowEngine.js";

export default function BrownlowCount({ seasonState, palette, onComplete }) {
  const archives = seasonState?.seasonArchive ?? [];
  const [selectedYear, setSelectedYear] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [subtab, setSubtab] = useState("COUNT");
  const year = selectedYear ?? Number(seasonState?.seasonYear);
  const current = year === Number(seasonState?.seasonYear);
  const archive = archives.find(item => Number(item.year) === year);
  const ready = !current || Boolean(seasonState?.brownlowCountReady) || ["OFFSEASON", "POST_SEASON"].includes(seasonState?.phase);
  const count = brownlowCount(archive?.roundHistory ?? (current ? seasonState?.roundHistory : []) ?? [], archive?.tribunalCases ?? (current ? seasonState?.tribunalCases : []) ?? []);
  const visibleRounds = count.rounds.slice(0, revealed);
  const totals = new Map();
  for (const round of visibleRounds) for (const match of round.matches) for (const vote of match.votes) totals.set(vote.playerId, (totals.get(vote.playerId) ?? 0) + vote.votes);
  const leaders = count.leaderboard.filter(player => totals.has(player.playerId)).map(player => ({ ...player, votes: totals.get(player.playerId) })).sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName));
  const trackerRows = leaders.map(player => {
    const roundVotes = {};
    const matchesByRound = {};
    for (const round of visibleRounds) {
      for (const match of round.matches) {
        const vote = match.votes.find(item => String(item.playerId) === String(player.playerId));
        if (vote) {
          roundVotes[round.round] = (roundVotes[round.round] ?? 0) + Number(vote.votes ?? 0);
          matchesByRound[round.round] = `${match.homeTeam} ${match.homeScore ?? ""}–${match.awayScore ?? ""} ${match.awayTeam}`.trim();
        }
      }
    }
    return { ...player, roundVotes, matchesByRound };
  });
  const complete = revealed === count.rounds.length && revealed > 0;
  useEffect(() => {
    if (current && complete && seasonState?.brownlowCountReady && !seasonState?.brownlowCountCompleted) onComplete?.(count.winners);
  }, [current, complete, seasonState?.brownlowCountReady, seasonState?.brownlowCountCompleted, onComplete]);
  const cell = { padding: "8px 10px", borderBottom: `1px solid ${palette.border}`, textAlign: "left" };
  const trackerCell = { padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, textAlign: "center", minWidth: 38 };
  const trackerColumnStyle = { ...trackerCell, position: "sticky", left: 0, zIndex: 2, textAlign: "left", minWidth: 190, background: palette.card };
  const trackerView = !ready
    ? <p style={{ color: palette.muted }}>Umpire votes are sealed until the end-of-season count.</p>
    : !revealed
      ? <p style={{ color: palette.muted }}>The tracker fills in as each round is revealed in the count.</p>
      : <div style={{ overflow: "auto", maxHeight: "70vh", border: `1px solid ${palette.border}`, borderRadius: 10 }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 230 + visibleRounds.length * 44, width: "100%", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 3, background: palette.surface }}>
              <tr>
                <th style={{ ...trackerColumnStyle, top: 0, zIndex: 4, background: palette.surface }}>Player · Club</th>
                {visibleRounds.map(round => <th key={round.round} style={{ ...trackerCell, top: 0, background: palette.surface, color: palette.muted }} title={`Round ${round.round}`}>{round.round}</th>)}
                <th style={{ ...trackerCell, top: 0, background: palette.surface, color: "#fbbf24", fontWeight: 900 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {trackerRows.map(player => <tr key={player.playerId} style={{ opacity: player.ineligible ? 0.62 : 1 }}>
                <th scope="row" style={{ ...trackerColumnStyle, borderRight: `1px solid ${palette.border}`, fontWeight: 750 }}>
                  <span>{player.playerName}</span><span style={{ color: palette.muted, fontWeight: 500, marginLeft: 7 }}>{player.club}</span>
                  {player.ineligible && <span style={{ display: "block", color: "#f87171", fontSize: 10, letterSpacing: 0.5 }}>INELIGIBLE</span>}
                </th>
                {visibleRounds.map(round => {
                  const votes = player.roundVotes[round.round] ?? 0;
                  const voteColor = votes === 3 ? "#d9a928" : votes === 2 ? "#1d4ed8" : votes === 1 ? "#2563a8" : "transparent";
                  const label = votes ? `${votes} vote${votes === 1 ? "" : "s"} · ${player.matchesByRound[round.round] ?? `Round ${round.round}`}` : `No votes · Round ${round.round}`;
                  return <td key={round.round} title={label} aria-label={label} style={{ ...trackerCell, background: votes ? voteColor : palette.surface, color: votes ? "#fff" : palette.muted, fontWeight: votes ? 850 : 500 }}>{votes || "—"}</td>;
                })}
                <td style={{ ...trackerCell, color: "#fbbf24", fontWeight: 900 }}>{player.votes}</td>
              </tr>)}
            </tbody>
          </table>
          {!trackerRows.length && <p style={{ color: palette.muted, padding: 14 }}>No votes have been revealed yet.</p>}
        </div>;

  return <section style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 16 }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ margin: 0, color: "#fbbf24" }}>Brownlow Medal · {year}</h3><p style={{ color: palette.muted }}>Fairest and best · home-and-away season · 3–2–1 umpire votes</p></div><select aria-label="Brownlow season" value={year} onChange={event => { setSelectedYear(Number(event.target.value)); setRevealed(0); }} style={{ padding: 9, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}>{[...new Set([Number(seasonState?.seasonYear), ...archives.map(item => Number(item.year))])].sort((a, b) => b - a).map(item => <option key={item} value={item}>{item}</option>)}</select></header>
    <nav aria-label="Brownlow sections" style={{ display: "flex", gap: 8, margin: "10px 0 14px" }}>
      {[ ["COUNT", "Count"], ["TRACKER", "Tracker"] ].map(([key, label]) => <button key={key} type="button" aria-pressed={subtab === key} onClick={() => setSubtab(key)} style={{ padding: "9px 14px", border: `1px solid ${subtab === key ? "#ea580c" : palette.border}`, borderRadius: 9, background: subtab === key ? "#ea580c" : palette.surface, color: palette.text, fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
    </nav>
    {subtab === "TRACKER" ? trackerView : !ready ? <p style={{ color: palette.muted }}>Umpire votes are sealed until the end-of-season count.</p> : !count.rounds.length ? <p style={{ color: palette.muted }}>No regular-season votes have been recorded.</p> : <>
      <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}><strong>Round {revealed} of {count.rounds.length}</strong>{!complete && <><button type="button" onClick={() => setRevealed(Math.min(revealed + 1, count.rounds.length))}>Count next round</button><button type="button" onClick={() => setRevealed(count.rounds.length)}>Skip to result</button></>}{revealed > 0 && <button type="button" onClick={() => setRevealed(0)}>Restart count</button>}</div>
      {complete && <div style={{ padding: 14, border: "1px solid #b8860b", borderRadius: 10, background: "rgba(251,191,36,.10)", marginBottom: 12 }}><strong style={{ color: "#fbbf24" }}>{count.winners.length > 1 ? "Joint medallists" : "Brownlow Medallist"}</strong><div>{count.winners.map(player => `${player.playerName} (${player.club}) · ${player.votes} votes`).join(" · ")}</div></div>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(250px, 1fr)", gap: 12 }}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}><thead><tr>{["#", "Player", "Club", "Votes"].map(label => <th key={label} style={{ ...cell, color: palette.muted }}>{label}</th>)}</tr></thead><tbody>{leaders.map((player, index) => <tr key={player.playerId} style={{ background: player.ineligible ? "rgba(239,68,68,.08)" : "transparent" }}><td style={cell}>{index + 1}</td><td style={cell}>{player.playerName}{player.ineligible && <span style={{ color: "#f87171", fontSize: 11, marginLeft: 6 }}>INELIGIBLE</span>}</td><td style={cell}>{player.club}</td><td style={{ ...cell, color: "#fbbf24", fontWeight: 800 }}>{player.votes}</td></tr>)}</tbody></table></div><div style={{ maxHeight: 540, overflowY: "auto" }}>{visibleRounds.slice(-1).map(round => <div key={round.round}><h4>Round {round.round} votes</h4>{round.matches.map((match, index) => <article key={match.fixtureId ?? index} style={{ padding: 10, marginBottom: 8, background: palette.surface, borderRadius: 9 }}><strong>{match.homeTeam} {match.homeScore} – {match.awayScore} {match.awayTeam}</strong>{match.votes.map(vote => <div key={vote.playerId} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontSize: 13 }}><span><b style={{ color: "#fbbf24" }}>{vote.votes}</b> {vote.playerName}</span><span style={{ color: palette.muted }}>{vote.club}</span></div>)}</article>)}</div>)}</div></div>
    </>}
  </section>;
}
