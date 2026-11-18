import { useMemo, useState } from "react";
import { getAttributeLabel, getPlayerTraitIds, getPlayerTraitTier, POSITIVE_TRAIT_MINIMUM, TRAIT_PLUS_MINIMUM, TRAIT_DEFINITIONS } from "../data/footballData.js";
import TraitBadge, { TraitIcon } from "./TraitBadge.jsx";

export default function SquadTraitsPage({ players = [], playerFitness = {}, theme, onOpenPlayer }) {
  const [query, setQuery] = useState("");
  const [traitFilter, setTraitFilter] = useState("ALL");
  const catalogue = Object.values(TRAIT_DEFINITIONS);
  const traitRows = useMemo(() => players.map((player) => ({ player, fitness: playerFitness?.[player.id] ?? {}, ids: getPlayerTraitIds(player, playerFitness?.[player.id]) }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name)), [players, playerFitness]);
  const filtered = traitRows.filter(({ player, ids }) => player.name.toLowerCase().includes(query.trim().toLowerCase())
    && (traitFilter === "ALL" || ids.includes(traitFilter)));
  const holders = (id) => traitRows.filter((row) => row.ids.includes(id)).length;
  const goldCount = traitRows.reduce((total, row) => total + row.ids.filter((id) => getPlayerTraitTier(row.player, id) === "plus").length, 0);
  const control = { padding: "9px 12px", borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.input, color: theme.text };

  return <section aria-label="Player traits" style={{ display: "grid", gap: 16 }}>
    <details style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.panel }}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>Trait guide · all {catalogue.length} traits</summary>
      <p style={{ color: theme.muted, fontSize: 12 }}>A trait must match a player's position and meet every minimum and maximum shown. Injury Prone is earned from repeated injuries across seasons; match context, fitness and direct opposition determine when other effects activate.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 10 }}>
        {catalogue.map((item) => <article key={item.id} style={{ padding: 12, border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: item.category === "drawback" ? "#ff65c8" : "#22f5d2" }}><TraitIcon id={item.id} size={23} /><strong>{item.label}</strong><small style={{ marginLeft: "auto", color: theme.muted }}>{holders(item.id)} players</small></div>
          <p style={{ margin: "8px 0", fontSize: 12, color: theme.text }}>{item.description}</p>
          <small style={{ display: "block", color: theme.muted }}>Roles: {item.eligiblePositionFamilies.join(", ")}</small>
          <small style={{ display: "block", color: theme.muted, marginTop: 3 }}>Attributes: {[...Object.entries(item.assignmentMinimums).map(([key, value]) => `${getAttributeLabel(key)} ${value}+`), ...Object.entries(item.assignmentMaximums ?? {}).map(([key, value]) => `${getAttributeLabel(key)} ≤${value}`)].join(" · ")}</small>
        </article>)}
      </div>
    </details>
    <div style={{ padding: 18, borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.panel }}>
      <h3 style={{ margin: "0 0 6px" }}>Player traits</h3>
      <p style={{ color: theme.muted, margin: "0 0 12px", fontSize: 13 }}>Most traits come from playing position and current attributes. Injury Prone appears for players with documented recurring history or after at least three recorded injuries across two or more seasons in a rolling three-season span. Positive traits need at least {POSITIVE_TRAIT_MINIMUM} in every required attribute. Neon icons show a trait; gold icons show Trait+, which needs at least {TRAIT_PLUS_MINIMUM} in each.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: theme.muted, fontSize: 13 }}><span>{catalogue.length} trait types</span><span>{traitRows.filter((row) => row.ids.length).length} players with traits</span><span style={{ color: "#facc15" }}>{goldCount} gold traits</span></div>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <input type="search" aria-label="Search players by name" placeholder="Search players" value={query} onChange={(event) => setQuery(event.target.value)} style={{ ...control, flex: "1 1 220px" }} />
      <select aria-label="Filter players by trait" value={traitFilter} onChange={(event) => setTraitFilter(event.target.value)} style={{ ...control, flex: "1 1 220px" }}><option value="ALL">All traits</option>{catalogue.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 285px), 1fr))", gap: 10 }}>
      {filtered.map(({ player, ids }) => <button key={player.id} type="button" onClick={() => onOpenPlayer(player)} style={{ textAlign: "left", padding: 14, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.panel, color: theme.text, cursor: "pointer" }}>
        <strong style={{ display: "block" }}>{player.name}</strong><small style={{ color: theme.muted, display: "block", margin: "4px 0 9px" }}>{player.positions?.join(" / ") ?? "—"} · OVR {player.overall ?? "—"}</small>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{ids.length ? ids.map((id) => <TraitBadge key={id} id={id} player={player} compact />) : <small style={{ color: theme.muted }}>No qualifying traits</small>}</span>
      </button>)}
      {!filtered.length && <p style={{ color: theme.muted }}>No players match these filters.</p>}
    </div>
  </section>;
}
