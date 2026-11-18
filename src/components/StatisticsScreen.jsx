import { useEffect, useMemo, useState } from "react";
import { collectSeasonMatches, buildStatisticsSummary } from "../engine/statisticsEngine.js";
import TrophyCollection from "./TrophyCollection.jsx";
import BrownlowCount from "./BrownlowCount.jsx";

const PLAYER_CATEGORIES = [
  ["disposals", "Disposals"], ["kicks", "Kicks"], ["handballs", "Handballs"],
  ["marks", "Marks"], ["tackles", "Tackles"], ["goals", "Goals"],
  ["behinds", "Behinds"], ["hitouts", "Hitouts"], ["clearances", "Clearances"],
  ["inside50s", "Inside 50s"], ["rebound50s", "Rebound 50s"], ["intercepts", "Intercepts"],
  ["disposalEfficiency", "Disposal efficiency %"], ["timeOnGround", "Time on ground %"],
];
const TEAM_CATEGORIES = [
  ["disposals", "Disposals"], ["marks", "Marks"], ["tackles", "Tackles"],
  ["clearances", "Clearances"], ["inside50s", "Inside 50s"], ["hitouts", "Hitouts"],
  ["contestedPossessions", "Contested possessions"], ["uncontestedPossessions", "Uncontested possessions"],
  ["disposalEfficiency", "Disposal efficiency"], ["goalAccuracy", "Goal accuracy"],
];

export default function StatisticsScreen({ appearance = "dark", seasonState, clubName, onOpenClub, onBrownlowComplete, navigationTab = null, navigationSequence = 0 }) {
  const [tab, setTab] = useState("PLAYER");
  useEffect(() => { if (navigationTab) setTab(navigationTab); }, [navigationSequence, navigationTab]);
  const [playerCategory, setPlayerCategory] = useState("disposals");
  const [teamCategory, setTeamCategory] = useState("disposals");
  const [scope, setScope] = useState("CURRENT");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const light = appearance === "light";
  const palette = {
    text: light ? "#0f172a" : "#f8fafc", muted: light ? "#64748b" : "#94a3b8",
    card: light ? "#fff" : "#0f172a", surface: light ? "#f1f5f9" : "#111c30",
    border: light ? "#cbd5e1" : "#334155",
  };
  const matches = useMemo(() => collectSeasonMatches(seasonState), [seasonState]);
  const currentMatches = matches.filter((match) => match.seasonYear === seasonState?.seasonYear);
  const selectedMatches = scope === "CURRENT" ? currentMatches : matches;
  const summary = useMemo(() => buildStatisticsSummary(selectedMatches), [selectedMatches]);
  const reportMatches = selectedMatches.map((match, index) => ({ ...match, reportId: `${match.seasonYear}-${match.stage}-${match.round}-${match.homeTeam}-${match.awayTeam}-${index}` }));
  const selectedMatch = reportMatches.find((match) => match.reportId === selectedMatchId) ?? reportMatches[reportMatches.length - 1];
  const isPlayerRate = ["disposalEfficiency", "timeOnGround"].includes(playerCategory);
  const playerAverage = (player) => player.games ? (player[playerCategory] ?? 0) / player.games : 0;
  const players = [...summary.players].sort((a, b) => isPlayerRate ? playerAverage(b) - playerAverage(a) : (b[playerCategory] ?? 0) - (a[playerCategory] ?? 0));
  const teams = [...summary.teams].sort((a, b) => {
    const aValue = a.matches ? a[teamCategory] / a.matches : 0;
    const bValue = b.matches ? b[teamCategory] / b.matches : 0;
    return bValue - aValue;
  });
  const card = { background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 16, marginBottom: 12 };
  const button = (active) => ({ padding: "9px 13px", border: `1px solid ${active ? "#ea580c" : palette.border}`, borderRadius: 9, background: active ? "#ea580c" : palette.surface, color: active ? "#fff" : palette.text, fontWeight: 800, cursor: "pointer" });
  const currentSeasonVotes = summary.aflca;
  const allTimeAflcaLeaders = buildStatisticsSummary(matches).aflca;
  const currentAflcaLeaders = buildStatisticsSummary(currentMatches).aflca;
  const archivedAflca = (seasonState?.seasonArchive ?? []).map((archive) => ({ year: archive.year, premier: archive.premier, winner: archive.aflcaWinner, topTen: archive.aflcaTopTen ?? archive.aflcaLeaderboard?.slice(0, 10) ?? [] }));
  const singleSeasonRecord = [...archivedAflca.flatMap((archive) => archive.topTen), ...currentAflcaLeaders].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))[0];

  return <main style={{ color: palette.text }}>
    <h2>Statistics · {seasonState?.seasonYear ?? "Season"}</h2>
    <p style={{ color: palette.muted, marginTop: -6 }}>{tab === "TROPHIES" ? "Career milestones earned across this club’s seasons." : `Match and season records from ${selectedMatches.length} completed games.`}</p>
    {!['TROPHIES', 'BROWNLOW'].includes(tab) && <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><button type="button" onClick={() => setScope("CURRENT")} style={button(scope === "CURRENT")}>Current season</button><button type="button" onClick={() => setScope("ALL_TIME")} style={button(scope === "ALL_TIME")}>All-time records</button></div>}
    <nav aria-label="Statistics sections" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
      {[["PLAYER", "Player stats"], ["TEAM", "Team stats"], ["MATCH", "Match reports"], ["AFLCA", "AFLCA votes"], ["BROWNLOW", "Brownlow Medal"], ["TROPHIES", "🏆 Trophies"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={button(tab === key)}>{label}</button>)}
    </nav>

    {tab === "PLAYER" && <section style={card}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, color: palette.muted, fontWeight: 700 }}>Stat category
        <select value={playerCategory} onChange={(event) => setPlayerCategory(event.target.value)} style={{ padding: 9, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}>{PLAYER_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </label>
      {players.length ? <div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}><thead><tr>{["#", "Player", "Club", "Games", PLAYER_CATEGORIES.find(([key]) => key === playerCategory)?.[1] ?? "Stat", isPlayerRate ? "Average" : "Per game"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${palette.border}`, color: palette.muted }}>{heading}</th>)}</tr></thead><tbody>{players.slice(0, 100).map((player, index) => <tr key={player.playerId}><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{index + 1}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}`, fontWeight: 700 }}>{player.playerName}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.club}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.games}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{isPlayerRate ? playerAverage(player).toFixed(1) : player[playerCategory] ?? 0}{isPlayerRate ? "%" : ""}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{isPlayerRate ? "—" : player.games ? ((player[playerCategory] ?? 0) / player.games).toFixed(1) : "0.0"}</td></tr>)}</tbody></table></div> : <p style={{ color: palette.muted }}>Player leaders appear after the first completed round.</p>}
    </section>}

    {tab === "TEAM" && <section style={card}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, color: palette.muted, fontWeight: 700 }}>Team category
        <select value={teamCategory} onChange={(event) => setTeamCategory(event.target.value)} style={{ padding: 9, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}>{TEAM_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </label>
      {teams.length ? <div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}><thead><tr>{["#", "Club", "Games", ["disposalEfficiency", "goalAccuracy"].includes(teamCategory) ? "Season average" : "Season total", "Per game"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${palette.border}`, color: palette.muted }}>{heading}</th>)}</tr></thead><tbody>{teams.map((team, index) => <tr key={team.club}><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{index + 1}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}`, fontWeight: 700 }}><button type="button" onClick={() => onOpenClub?.(team.club)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>{team.club}</button></td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{team.matches}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{["disposalEfficiency", "goalAccuracy"].includes(teamCategory) ? (team.matches ? ((team[teamCategory] ?? 0) / team.matches).toFixed(1) : "0.0") : (team[teamCategory] ?? 0).toFixed?.(1) ?? team[teamCategory] ?? 0}{["disposalEfficiency", "goalAccuracy"].includes(teamCategory) ? "%" : ""}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{["disposalEfficiency", "goalAccuracy"].includes(teamCategory) ? "—" : team.matches ? ((team[teamCategory] ?? 0) / team.matches).toFixed(1) : "0.0"}</td></tr>)}</tbody></table></div> : <p style={{ color: palette.muted }}>Team rankings appear after the first completed round.</p>}
    </section>}

    {tab === "MATCH" && <section style={card}>
      <h3 style={{ marginTop: 0 }}>Completed match reports</h3>
      {reportMatches.length ? <>
        <label style={{ display: "grid", gap: 6, color: palette.muted, fontWeight: 700 }}>Select match
          <select value={selectedMatch?.reportId ?? ""} onChange={(event) => setSelectedMatchId(event.target.value)} style={{ padding: 10, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}>
            {reportMatches.slice().reverse().map((match) => <option key={match.reportId} value={match.reportId}>Season {match.seasonYear} · {match.round} · {match.homeTeam} {match.homeScore}–{match.awayScore} {match.awayTeam}</option>)}
          </select>
        </label>
        {selectedMatch && <>
          <h4>{selectedMatch.homeTeam} {selectedMatch.homeScore}–{selectedMatch.awayScore} {selectedMatch.awayTeam}</h4>
          <p style={{ color: palette.muted }}>{selectedMatch.round} · {selectedMatch.date ?? "Date not recorded"} · {selectedMatch.venue ?? "Venue not recorded"}</p>
          <h4>Team stats</h4>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}><thead><tr><th style={{ textAlign: "left", padding: 8 }}>Stat</th><th style={{ padding: 8 }}>{selectedMatch.homeTeam}</th><th style={{ padding: 8 }}>{selectedMatch.awayTeam}</th></tr></thead><tbody>{TEAM_CATEGORIES.map(([key, label]) => <tr key={key}><td style={{ padding: 8, borderTop: `1px solid ${palette.border}` }}>{label}</td><td style={{ padding: 8, textAlign: "center", borderTop: `1px solid ${palette.border}` }}>{selectedMatch.teamStats?.home?.[key] ?? "—"}{["disposalEfficiency", "goalAccuracy"].includes(key) && selectedMatch.teamStats?.home ? "%" : ""}</td><td style={{ padding: 8, textAlign: "center", borderTop: `1px solid ${palette.border}` }}>{selectedMatch.teamStats?.away?.[key] ?? "—"}{["disposalEfficiency", "goalAccuracy"].includes(key) && selectedMatch.teamStats?.away ? "%" : ""}</td></tr>)}</tbody></table></div>
          <h4>Player stats</h4>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860, fontSize: 12 }}><thead><tr>{["Player", "Club", "Pos", "D", "K", "HB", "M", "T", "G", "B", "HO", "CLR", "I50", "R50", "INT", "DE%", "ToG%"].map((heading) => <th key={heading} style={{ padding: 7, borderBottom: `1px solid ${palette.border}`, color: palette.muted }}>{heading}</th>)}</tr></thead><tbody>{[...(selectedMatch.playerStats?.home ?? []), ...(selectedMatch.playerStats?.away ?? [])].map((stat) => <tr key={`${stat.club}-${stat.playerId}`}>{[stat.playerName, stat.club, stat.positions.join("/"), stat.disposals, stat.kicks, stat.handballs, stat.marks, stat.tackles, stat.goals, stat.behinds, stat.hitouts, stat.clearances, stat.inside50s, stat.rebound50s, stat.intercepts, stat.disposalEfficiency, stat.timeOnGround].map((value, index) => <td key={index} style={{ padding: 7, borderBottom: `1px solid ${palette.border}`, textAlign: index < 2 ? "left" : "center" }}>{value}</td>)}</tr>)}</tbody></table></div>
          <h4>AFLCA Coaches Votes</h4>
          {(selectedMatch.coachesVotes?.totals ?? []).length ? <ol>{selectedMatch.coachesVotes.totals.map((vote) => <li key={vote.playerId}>{vote.playerName} ({vote.club}) — {vote.votes}</li>)}</ol> : <p style={{ color: palette.muted }}>Finals matches do not award AFLCA votes.</p>}
        </>}
      </> : <p style={{ color: palette.muted }}>Match reports appear here after games are completed.</p>}
    </section>}

    {tab === "TROPHIES" && <section style={card}><TrophyCollection seasonState={seasonState} clubName={clubName} appearance={appearance} /></section>}
    {tab === "BROWNLOW" && <BrownlowCount seasonState={seasonState} palette={palette} onComplete={onBrownlowComplete} />}

    {tab === "AFLCA" && <section style={card}>
      <h3 style={{ marginTop: 0 }}>AFLCA Coaches Votes · {scope === "CURRENT" ? seasonState?.seasonYear ?? "Season" : "All-time"}</h3>
      <p style={{ color: palette.muted }}>Votes are awarded 5–1 by each coach after home-and-away matches. Each player can receive up to 10 votes per match.</p>
      {currentSeasonVotes.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 470 }}><thead><tr>{["#", "Player", "Club", "Votes", "Matches played", "Votes / match"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${palette.border}`, color: palette.muted }}>{heading}</th>)}</tr></thead><tbody>{currentSeasonVotes.slice(0, 100).map((player, index) => <tr key={player.playerId}><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{index + 1}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}`, fontWeight: 700 }}>{player.playerName}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.club}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.votes}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.games}</td><td style={{ padding: 10, borderBottom: `1px solid ${palette.border}` }}>{player.averageVotes.toFixed(2)}</td></tr>)}</tbody></table></div> : <p style={{ color: palette.muted }}>The leaderboard appears after the first completed round.</p>}
      <h4>Season records</h4>
      <p style={{ color: palette.muted }}>All-time vote leader: {allTimeAflcaLeaders[0] ? `${allTimeAflcaLeaders[0].playerName} · ${allTimeAflcaLeaders[0].votes} votes` : "No votes recorded yet"}</p>
      <p style={{ color: palette.muted }}>Highest single-season total: {singleSeasonRecord ? `${singleSeasonRecord.playerName} · ${singleSeasonRecord.votes} votes` : "No season completed yet"}</p>
      {archivedAflca.length > 0 && <div style={{ display: "grid", gap: 8 }}>{archivedAflca.slice().reverse().map((archive) => <article key={archive.year} style={{ padding: 11, borderRadius: 9, background: palette.surface }}><strong>{archive.year} · Premiership: {archive.premier ?? "—"}</strong><div style={{ color: palette.muted, marginTop: 5 }}>AFLCA winner: {archive.winner ? `${archive.winner.playerName} (${archive.winner.club}) · ${archive.winner.votes}` : "Not recorded"}</div><div style={{ color: palette.muted, marginTop: 5 }}>Top 10: {archive.topTen.map((player) => `${player.playerName} ${player.votes}`).join(" · ") || "No leaderboard saved"}</div></article>)}</div>}
    </section>}
  </main>;
}
