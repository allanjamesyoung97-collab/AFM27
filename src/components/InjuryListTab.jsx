import { useEffect, useMemo, useState } from "react";
import { players } from "../data/players.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { getInjuryCategoryColor, getFitnessColor, getPlayerEndurance } from "../engine/fitnessEngine.js";

const categories = ["ALL", "MINOR", "SHORT", "MEDIUM", "LONG"];

export default function InjuryListTab({ team = "Collingwood", appearance = "dark", playerFitness = {}, seasonState, players: playerPool = players, navigationTab = null, navigationSequence = 0 }) {
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("weeksRemaining");
  const [activeTab, setActiveTab] = useState("CURRENT");
  useEffect(() => { if (navigationTab) setActiveTab(navigationTab); }, [navigationSequence, navigationTab]);

  const lightMode = appearance === "light";
  const colors = {
    ink: lightMode ? "#0f172a" : "#f8fafc",
    muted: lightMode ? "#64748b" : "#94a3b8",
    orange: "#ea580c",
    amber: "#f59e0b",
    tile: lightMode ? "#e2e8f0" : "#1e293b",
    panel: lightMode ? "#ffffff" : "#0f172a",
    border: lightMode ? "#cbd5e1" : "#334155",
    green: lightMode ? "#047857" : "#34d399",
  };
  const panel = { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, color: colors.ink };

  const clubPlayers = useMemo(() => {
    const clubName = typeof team === "string" ? team : team?.name ?? "Collingwood";
    return playerPool
      .map((p) => getCareerPlayer(p, seasonState?.playerDevelopment, seasonState?.seasonYear ?? 2027, seasonState?.playerContracts))
      .filter((p) => p.club === clubName);
  }, [playerPool, team, seasonState?.playerDevelopment, seasonState?.playerContracts, seasonState?.seasonYear]);

  const injuries = useMemo(() => {
    const result = [];
    for (const player of clubPlayers) {
      const state = playerFitness?.[player.id];
      if (!state?.injury || state.injury.weeksRemaining <= 0) continue;
      const replacement = clubPlayers
        .filter((p) => {
          const ps = playerFitness?.[p.id];
          return (!ps?.injury || ps.injury.weeksRemaining <= 0) && p.id !== player.id;
        })
        .filter((p) => p.positions?.some((pos) => player.positions?.includes(pos)))
        .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))[0];
      result.push({
        playerId: player.id,
        player: player.name,
        number: player.id,
        position: player.positions?.join(", ") ?? "—",
        age: player.age ?? "—",
        role: player.positions?.[0] ?? "—",
        overall: player.overall ?? "—",
        fitness: state.fitness ?? 100,
        endurance: getPlayerEndurance(player),
        injury: state.injury.name,
        category: state.injury.category,
        weeksRemaining: state.injury.weeksRemaining,
        baselineWeeks: state.injury.baselineWeeks,
        recovery: state.injury.recovery ?? 0,
        replacement: replacement?.name ?? "No like-for-like available",
        replacementPosition: replacement?.positions?.[0] ?? "—",
        replacementOverall: replacement?.overall ?? "—",
      });
    }
    return result;
  }, [clubPlayers, playerFitness]);

  const suspensions = useMemo(() => clubPlayers.map(player => ({
    player,
    suspension: playerFitness?.[player.id]?.suspension,
    tribunalCase: (seasonState?.tribunalCases ?? []).find(item => item.id === playerFitness?.[player.id]?.suspension?.caseId),
  })).filter(item => Number(item.suspension?.matchesRemaining ?? 0) > 0)
    .sort((a, b) => Number(b.suspension.matchesRemaining) - Number(a.suspension.matchesRemaining) || a.player.name.localeCompare(b.player.name)),
  [clubPlayers, playerFitness, seasonState?.tribunalCases]);

  const counts = useMemo(() => Object.fromEntries(categories.map((category) => [
    category,
    category === "ALL" ? injuries.length : injuries.filter((inj) => inj.category === category).length,
  ])), [injuries]);

  const visibleInjuries = useMemo(() => injuries
    .filter((inj) => filter === "ALL" || inj.category === filter)
    .sort((a, b) => {
      if (sort === "overall") return (b.overall ?? 0) - (a.overall ?? 0);
      if (sort === "player") return a.player.localeCompare(b.player);
      return (b.weeksRemaining ?? 0) - (a.weeksRemaining ?? 0);
    }), [injuries, filter, sort]);

  const summary = [
    ["Total out", counts.ALL, colors.ink],
    ["Minor (0-1w)", counts.MINOR, "#84cc16"],
    ["Short (1-3w)", counts.SHORT, colors.amber],
    ["Medium (3-6w)", counts.MEDIUM, colors.orange],
    ["Long (6w+)", counts.LONG, "#dc2626"],
  ];
  const injuryHistory = useMemo(() => {
    const clubName = typeof team === "string" ? team : team?.name ?? "Collingwood";
    const currentClubIds = new Set(clubPlayers.map(player => String(player.id)));
    const names = new Map(playerPool.map(player => {
      const careerPlayer = getCareerPlayer(player, seasonState?.playerDevelopment, seasonState?.seasonYear ?? 2027, seasonState?.playerContracts);
      return [String(player.id), careerPlayer.name];
    }));
    const matchRounds = new Map();
    const roundResults = [
      ...(seasonState?.roundHistory ?? []).flatMap(entry => (entry.results ?? []).map(result => ({ ...result, round: result.round ?? entry.round }))),
      ...(seasonState?.wildcardResults ?? []),
      ...(seasonState?.finalsHistory ?? []).flatMap(week => (week.results ?? []).map(result => ({ ...result, finalsWeek: result.finalsWeek ?? week.label ?? week.week }))),
      ...(seasonState?.communityResults ?? []),
      ...Object.values(seasonState?.competitions ?? {}).flatMap(competition => competition.results ?? []),
    ];
    for (const result of roundResults) {
      const id = String(result.fixtureId ?? result.id ?? "");
      if (!id) continue;
      const round = result.stage === "FINALS" || result.stage === "WILDCARD"
        ? result.finalsWeek ? `Finals · ${result.finalsWeek}` : result.stage === "WILDCARD" ? "Wildcard Final" : "Finals"
        : Number.isFinite(Number(result.round)) ? `Round ${result.round}` : null;
      matchRounds.set(id, round);
    }
    const pastInjuries = Object.entries(playerFitness ?? {}).flatMap(([playerId, state]) =>
      (state?.injuryEvents ?? [])
        .filter(event => event.club ? event.club === clubName : currentClubIds.has(String(playerId)))
        .map(event => {
          const matchId = String(event.matchId ?? "").replace(/:RESERVES$/, "");
          return {
            ...event,
            recordType: "INJURY",
            round: event.round ?? matchRounds.get(matchId) ?? (event.matchId ? "Match" : "Training"),
            player: names.get(String(playerId)) ?? event.playerName ?? event.player ?? "Player no longer on the list",
          };
        }));
    const activeCaseIds = new Set(Object.values(playerFitness ?? {})
      .filter(state => Number(state?.suspension?.matchesRemaining ?? 0) > 0)
      .map(state => String(state.suspension.caseId ?? "")));
    const archivedCases = [...new Map([
      ...(seasonState?.tribunalCases ?? []),
      ...(seasonState?.seasonArchive ?? []).flatMap(archive => archive.tribunalCases ?? []),
    ].map(item => [String(item.id), item])).values()];
    const pastSuspensions = archivedCases
      .filter(item => item.club === clubName && Number(item.matches ?? 0) > 0 && ["ACCEPTED", "UPHELD"].includes(item.status) && !activeCaseIds.has(String(item.id)))
      .map(item => ({
        id: `suspension-history:${item.id}`,
        recordType: "SUSPENSION",
        date: item.resolvedOn ?? item.date,
        round: matchRounds.get(String(item.fixtureId ?? "")) ?? (item.date ? "Match" : "—"),
        player: names.get(String(item.playerId)) ?? item.playerName ?? "Player no longer at club",
        name: `${item.matches}-match suspension`,
        details: `${item.conduct ?? "Tribunal"} conduct · ${item.impact ?? "Unspecified"} impact · ${item.contact ?? "Unspecified"} contact`,
        outcome: item.status === "UPHELD" ? "Upheld at Tribunal" : "Accepted",
        duration: `${item.matches} ${Number(item.matches) === 1 ? "match" : "matches"}`,
        category: "SUSPENSION",
      }));
    return [...pastInjuries, ...pastSuspensions]
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.player.localeCompare(b.player));
  }, [playerFitness, clubPlayers, playerPool, team, seasonState?.playerDevelopment, seasonState?.seasonYear, seasonState?.playerContracts, seasonState?.roundHistory, seasonState?.finalsHistory, seasonState?.wildcardResults, seasonState?.communityResults, seasonState?.competitions, seasonState?.tribunalCases, seasonState?.seasonArchive]);

  return (
    <main style={{ color: colors.ink, fontFamily: "Inter, system-ui, sans-serif", background: "transparent" }}>
      <section style={{ ...panel, marginBottom: 16 }}>
        <div style={{ color: colors.ink, letterSpacing: 3, fontWeight: 700, fontSize: 12 }}>MEDICAL ROOM</div>
        <nav aria-label="Medical room tabs" style={{ display: "flex", gap: 8, margin: "12px 0 18px", borderBottom: `1px solid ${colors.border}` }}>
          {[["CURRENT", "Current Injuries"], ["SUSPENSIONS", "Suspensions"], ["HISTORY", "History"]].map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-pressed={activeTab === id} style={{ border: 0, borderBottom: activeTab === id ? `3px solid ${colors.orange}` : "3px solid transparent", padding: "10px 14px", background: "transparent", color: activeTab === id ? colors.ink : colors.muted, fontWeight: 700, cursor: "pointer" }}>{label}</button>)}
        </nav>
        <h2 style={{ margin: "8px 0 18px", textTransform: "uppercase" }}>{activeTab === "CURRENT" ? "CURRENT INJURIES" : activeTab === "SUSPENSIONS" ? "SUSPENSIONS" : "HISTORY"}</h2>
        {activeTab === "CURRENT" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {summary.map(([label, value, color]) => (
            <div key={label} style={{ background: colors.tile, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <strong style={{ display: "block", color, fontSize: 25 }}>{value}</strong>
            </div>
          ))}
        </div>}
      </section>

      {activeTab === "HISTORY" ? (
        <section style={panel}>
          {injuryHistory.length === 0 ? <div style={{ textAlign: "center", padding: 24 }}><strong style={{ fontSize: 18 }}>No history recorded yet</strong><p style={{ color: colors.muted }}>Past injuries and completed tribunal suspensions will appear here.</p></div> : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}><thead><tr>{["Round", "Player", "Event", "Details", "Outcome", "Duration"].map(label => <th key={label} style={{ color: colors.muted, textAlign: "left", padding: 10, borderBottom: `1px solid ${colors.border}` }}>{label}</th>)}</tr></thead><tbody>
              {injuryHistory.map(event => <tr key={event.id}><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{event.round}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}`, fontWeight: 700 }}>{event.player}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{event.name}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{event.details ?? event.name}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}`, color: event.recordType === "SUSPENSION" ? colors.amber : getInjuryCategoryColor(event.category) }}>{event.outcome ?? event.category}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{event.duration ?? `${event.weeks} ${Number(event.weeks) === 1 ? "week" : "weeks"}`}</td></tr>)}
            </tbody></table>
          </div>}
        </section>
      ) : activeTab === "SUSPENSIONS" ? (
        <section style={panel}>
          {suspensions.length === 0 ? <div style={{ textAlign: "center", padding: 24 }}><strong style={{ fontSize: 18 }}>No active suspensions</strong><p style={{ color: colors.muted }}>Tribunal bans will appear here until each player has served the required matches.</p></div> : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}><thead><tr>{["Player", "Position", "Matches remaining", "Incident", "Tribunal status"].map(label => <th key={label} style={{ color: colors.muted, textAlign: "left", padding: 10, borderBottom: `1px solid ${colors.border}` }}>{label}</th>)}</tr></thead><tbody>
              {suspensions.map(({ player, suspension, tribunalCase }) => <tr key={player.id}><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}`, fontWeight: 700 }}>{player.name}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{player.positions?.join(", ") || "—"}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}`, color: colors.orange, fontWeight: 800 }}>{suspension.matchesRemaining}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{suspension.reason ?? tribunalCase?.conduct ?? "Tribunal suspension"}</td><td style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>{tribunalCase?.status ?? "Serving ban"}</td></tr>)}
            </tbody></table>
          </div>}
        </section>
      ) : <>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <nav aria-label="Filter injuries" style={{ display: "flex", flexWrap: "wrap", gap: 5, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 11, padding: 5 }}>
          {categories.map((category) => (
            <button key={category} type="button" onClick={() => setFilter(category)} aria-pressed={filter === category} style={{ border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: filter === category ? colors.orange : "transparent", color: colors.ink, fontWeight: 700 }}>
              {category} ({counts[category]})
            </button>
          ))}
        </nav>
        <label style={{ color: colors.muted }}>Sort: {" "}
          <select value={sort} onChange={(event) => setSort(event.target.value)} style={{ padding: 7, borderRadius: 8, background: colors.panel, color: colors.ink, border: `1px solid ${colors.border}` }}>
            <option value="weeksRemaining">Weeks remaining</option>
            <option value="player">A–Z</option>
            <option value="overall">Overall (high to low)</option>
          </select>
        </label>
      </div>

      {visibleInjuries.length === 0 ? (
        <div style={panel}>
          <div style={{ textAlign: "center", padding: 24 }}>
            <strong style={{ fontSize: 18, color: colors.green }}>No players currently injured</strong>
            <p style={{ color: colors.muted, marginTop: 8 }}>Your squad is fully available for selection.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 16 }}>
          {visibleInjuries.map((injury) => {
            const catColor = getInjuryCategoryColor(injury.category);
            const replacementDelta = typeof injury.replacementOverall === "number" && typeof injury.overall === "number"
              ? injury.replacementOverall - injury.overall
              : null;
            return (
              <article key={injury.playerId} style={{ ...panel, borderColor: colors.border, boxShadow: "0 8px 24px #0004" }}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 20 }}><strong>{injury.player}</strong> <span style={{ background: colors.tile, borderRadius: 7, padding: "4px 8px", fontSize: 12 }}>{injury.position}</span></div>
                    <div style={{ color: colors.muted, marginTop: 6 }}>Age {injury.age} · {injury.role} · END {injury.endurance} · FIT <span style={{ color: getFitnessColor(injury.fitness) }}>{Math.round(injury.fitness)}%</span></div>
                  </div>
                  <div style={{ textAlign: "right", color: colors.orange }}><strong style={{ fontSize: 25 }}>{injury.overall}</strong><div style={{ color: colors.muted, fontSize: 12 }}>OVR</div></div>
                </header>

                <section style={{ background: lightMode ? "#fef3c7" : "#292315", border: `1px solid ${catColor}44`, borderRadius: 11, padding: 14, marginBottom: 12, color: catColor }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 18 }}><strong>{injury.injury}</strong> <span style={{ background: colors.tile, color: colors.ink, borderRadius: 7, padding: "5px 8px", fontSize: 12 }}>{injury.category}</span></div>
                    <strong style={{ fontSize: 22 }}>{injury.weeksRemaining}w</strong>
                  </div>
                  <div role="progressbar" aria-label="Recovery progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={injury.recovery} style={{ height: 9, background: colors.border, borderRadius: 9, overflow: "hidden" }}><div style={{ width: `${injury.recovery}%`, height: "100%", background: catColor }} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: 12, marginTop: 6 }}><span>{injury.recovery}% recovered</span><span>baseline {injury.baselineWeeks}w</span></div>
                </section>

                <footer style={{ borderTop: `1px solid ${colors.border}`, marginTop: 14, paddingTop: 12 }}>
                  <div style={{ color: colors.muted, fontSize: 12, letterSpacing: 1 }}>LIKELY REPLACEMENT</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
                    <strong>{injury.replacement}</strong>
                    <span style={{ color: colors.muted }}>{injury.replacementPosition} · {injury.replacementOverall} OVR {replacementDelta != null && <span style={{ color: replacementDelta < 0 ? "#f87171" : colors.green }}>({replacementDelta})</span>}</span>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      </>}
    </main>
  );
}
