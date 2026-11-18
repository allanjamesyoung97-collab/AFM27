import { useState } from "react";
import FantasyCreatePlayerPanel from "./FantasyCreatePlayerPanel.jsx";
import FantasyEditPlayersPanel from "./FantasyEditPlayersPanel.jsx";
import FantasyTeamsPanel from "./FantasyTeamsPanel.jsx";
import FantasyLegendsPanel from "./FantasyLegendsPanel.jsx";
import FantasySettingsPanel from "./FantasySettingsPanel.jsx";

const TABS = [
  ["CREATE", "Create player"],
  ["PLAYERS", "Edit players"],
  ["TEAMS", "Edit teams"],
  ["ADD_LEGENDS", "Add Legends"],
  ["LEGENDS_DRAFT", "Legends Draft"],
  ["SETTINGS", "Fantasy settings"],
];

export default function FantasyToolsScreen({ players, clubs, seasonState, onSeasonStateChange, appearance = "dark" }) {
  const [tab, setTab] = useState("CREATE");
  const lightMode = appearance === "light";
  const panelProps = { players, clubs, seasonState, onSeasonStateChange, lightMode };

  return (
    <main style={{ padding: "clamp(16px, 3vw, 32px)", color: lightMode ? "#0f172a" : "#f8fafc", minHeight: "100%", boxSizing: "border-box" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ color: "#fb923c", fontSize: 12, fontWeight: 800, letterSpacing: 3 }}>FANTASY MODE</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 28, lineHeight: 1.2 }}>Fantasy tools</h1>
        <p style={{ margin: 0, color: lightMode ? "#475569" : "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
          Changes apply to this career immediately and are saved with it.
        </p>
      </header>

      <nav aria-label="Fantasy tools sections" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            style={{
              padding: "9px 14px",
              border: `1px solid ${tab === key ? "#ea580c" : lightMode ? "#cbd5e1" : "#334155"}`,
              borderRadius: 9,
              color: tab === key ? "#fff" : lightMode ? "#334155" : "#e2e8f0",
              background: tab === key ? "#ea580c" : lightMode ? "#fff" : "#0f172a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "CREATE" && <FantasyCreatePlayerPanel {...panelProps} />}
      {tab === "PLAYERS" && <FantasyEditPlayersPanel {...panelProps} />}
      {tab === "TEAMS" && <FantasyTeamsPanel {...panelProps} />}
      {tab === "ADD_LEGENDS" && <FantasyLegendsPanel key="add-legends" {...panelProps} view="ADD" />}
      {tab === "LEGENDS_DRAFT" && <FantasyLegendsPanel key="legends-draft" {...panelProps} view="DRAFT" />}
      {tab === "SETTINGS" && <FantasySettingsPanel {...panelProps} />}
    </main>
  );
}
