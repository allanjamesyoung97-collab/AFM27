import { useEffect, useMemo, useState } from "react";
import { calculateOverall } from "../engine/playerRatingGenerator.js";
import { isRuckEligible } from "../engine/playerRatingGenerator.js";

const ATTRIBUTE_GROUPS = [
  { label: "Technical", attributes: ["kicking", "handball", "marking", "goalSense", "tackling", "spoiling", "groundBallGet", "contestedBall", "ruckCraft"] },
  { label: "Physical", attributes: ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability", "runAndCarry"] },
  { label: "Football IQ", attributes: ["vision", "decisionMaking", "positioning", "composure", "leadership", "creativity", "gameAwareness"] },
  { label: "Mental", attributes: ["workRate", "professionalism", "determination", "teamwork", "competitiveness", "discipline"] },
];

const formatName = (value) => ({ contestedBall: "Contested ball", runAndCarry: "Run & carry" }[value] ?? value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()));

export default function DeveloperPlayerAttributes({ players = [], appearance = "dark", overrides = {}, onSaveOverrides }) {
  const lightMode = appearance === "light";
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(() => String(players[0]?.id ?? ""));
  const [draftOverrides, setDraftOverrides] = useState(() => ({ ...overrides }));
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const palette = lightMode
    ? { text: "#0f172a", muted: "#64748b", panel: "#fff", border: "#cbd5e1", input: "#f8fafc", surface: "#eef2f8" }
    : { text: "#f8fafc", muted: "#94a3b8", panel: "#0f172a", border: "#334155", input: "#111827", surface: "#1e293b" };

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...players]
      .filter((player) => !query || `${player.name} ${player.club}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, search]);
  const baseSelectedPlayer = visiblePlayers.find((player) => String(player.id) === selectedPlayerId) ?? visiblePlayers[0] ?? null;
  const selectedOverride = baseSelectedPlayer ? draftOverrides[String(baseSelectedPlayer.id)] : null;
  const selectedPlayer = baseSelectedPlayer && selectedOverride
    ? { ...baseSelectedPlayer, ...selectedOverride, attributes: { ...baseSelectedPlayer.attributes, ...(selectedOverride.attributes ?? {}) } }
    : baseSelectedPlayer;
  const hasUnsavedChanges = JSON.stringify(draftOverrides) !== JSON.stringify(overrides);

  useEffect(() => {
    setDraftOverrides({ ...overrides });
  }, [overrides]);

  const updateAttribute = (attribute, rawValue) => {
    if (!selectedPlayer) return;
    if (attribute === "ruckCraft" && !isRuckEligible(selectedPlayer)) return;
    const value = Math.max(1, Math.min(99, Math.round(Number(rawValue) || 1)));
    const attributes = { ...selectedPlayer.attributes, [attribute]: value };
    const overall = calculateOverall(attributes, selectedPlayer.positions?.[0] ?? "MID");
    setDraftOverrides((previous) => ({
      ...previous,
      [String(selectedPlayer.id)]: { ...(previous[String(selectedPlayer.id)] ?? {}), attributes, overall },
    }));
    setSaveStatus("");
  };

  const resetSelectedPlayer = () => {
    if (!selectedPlayer) return;
    setDraftOverrides((previous) => {
      const next = { ...previous };
      delete next[String(selectedPlayer.id)];
      return next;
    });
    setSaveStatus("Generated ratings will be restored when you save.");
  };

  const saveChanges = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setIsSaving(true);
    setSaveStatus("");
    try {
      const result = await onSaveOverrides(draftOverrides);
      if (!result?.ok) throw new Error(result?.error ?? "Could not save player attributes.");
      setSaveStatus(`Saved ${result.savedPlayers ?? Object.keys(draftOverrides).length} player rating${(result.savedPlayers ?? Object.keys(draftOverrides).length) === 1 ? "" : "s"} to the project data file.`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Could not save player attributes.");
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle = {
    background: palette.panel,
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    padding: 16,
    color: palette.text,
  };

  return (
    <main style={{ color: palette.text, display: "grid", gap: 14 }}>
      <header>
        <div style={{ color: "#ea580c", fontWeight: 800, fontSize: 12, letterSpacing: 2 }}>DEVELOPER TOOLS</div>
        <h2 style={{ margin: "6px 0" }}>Player Attribute Editor</h2>
        <p style={{ margin: 0, color: palette.muted }}>Adjustments stay as drafts until saved. Saving writes them to the shared player data file and updates the game.</p>
      </header>

      <section style={{ ...cardStyle, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 2fr)", gap: 12, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, color: palette.muted, fontSize: 13, fontWeight: 700 }}>
          Find a player
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player or club" style={{ padding: 10, border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.input, color: palette.text }} />
        </label>
        <label style={{ display: "grid", gap: 6, color: palette.muted, fontSize: 13, fontWeight: 700 }}>
          Player
          <select value={selectedPlayer ? String(selectedPlayer.id) : ""} onChange={(event) => setSelectedPlayerId(event.target.value)} style={{ padding: 10, border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.input, color: palette.text }}>
            {visiblePlayers.map((player) => <option key={player.id} value={String(player.id)}>{player.name} · {player.club}</option>)}
          </select>
        </label>
      </section>

      {!selectedPlayer ? (
        <section style={cardStyle}>No players match this search.</section>
      ) : (
        <>
          <section style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>{selectedPlayer.name}</h3>
              <span style={{ color: palette.muted }}>{selectedPlayer.club} · {(selectedPlayer.positions ?? []).join(" / ") || "Position unknown"}</span>
              <div style={{ marginTop: 8, fontWeight: 800 }}>Overall: {selectedPlayer.overall}</div>
            </div>
            {selectedOverride && <button type="button" onClick={resetSelectedPlayer} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.surface, color: palette.text, cursor: "pointer", fontWeight: 700 }}>Reset to generated ratings</button>}
          </section>

          <section style={{ ...cardStyle, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span role="status" style={{ color: saveStatus.startsWith("Saved") ? "#16a34a" : palette.muted, fontSize: 13 }}>{saveStatus || (hasUnsavedChanges ? "Unsaved player attribute changes" : "All player attributes are saved")}</span>
            <button type="button" onClick={saveChanges} disabled={!hasUnsavedChanges || isSaving} style={{ padding: "10px 18px", border: 0, borderRadius: 9, background: hasUnsavedChanges && !isSaving ? "#047857" : palette.surface, color: hasUnsavedChanges && !isSaving ? "#fff" : palette.muted, fontWeight: 800, cursor: hasUnsavedChanges && !isSaving ? "pointer" : "not-allowed" }}>
              {isSaving ? "Saving…" : "Save attributes"}
            </button>
          </section>

          {ATTRIBUTE_GROUPS.map((group) => {
            const attributes = group.attributes.filter((attribute) => attribute !== "ruckCraft" || isRuckEligible(selectedPlayer));
            return attributes.length > 0 && (
            <section key={group.label} style={cardStyle}>
              <h3 style={{ margin: "0 0 12px" }}>{group.label}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {attributes.map((attribute) => (
                  <label key={attribute} style={{ display: "grid", gridTemplateColumns: "1fr 64px", gap: "6px 12px", alignItems: "center", color: palette.muted, fontSize: 13 }}>
                    <span style={{ color: palette.text, fontWeight: 600 }}>{formatName(attribute)}</span>
                    <input type="number" min="1" max="99" step="1" value={selectedPlayer.attributes?.[attribute] ?? 1} onChange={(event) => updateAttribute(attribute, event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: `1px solid ${palette.border}`, borderRadius: 7, background: palette.input, color: palette.text }} />
                    <input aria-label={`${formatName(attribute)} slider`} type="range" min="1" max="99" value={selectedPlayer.attributes?.[attribute] ?? 1} onChange={(event) => updateAttribute(attribute, event.target.value)} style={{ gridColumn: "1 / -1", width: "100%", accentColor: "#ea580c" }} />
                  </label>
                ))}
              </div>
            </section>
            );
          })}
        </>
      )}
    </main>
  );
}
