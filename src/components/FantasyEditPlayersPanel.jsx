import { useState } from "react";
import FantasyPlayerFields, { fantasyButtonStyle } from "./FantasyPlayerFields.jsx";
import { validatePlayerFields } from "../engine/fantasyToolsEngine.js";
import { getPlayerTraitIds, TRAIT_DEFINITIONS } from "../data/footballData.js";

export default function FantasyEditPlayersPanel({ players, seasonState, onSeasonStateChange, lightMode }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [values, setValues] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  const term = query.trim().toLowerCase();
  const matches = term ? players.filter((player) => player.name.toLowerCase().includes(term)).slice(0, 25) : [];

  const choosePlayer = (player) => {
    setSelectedId(String(player.id));
    setValues({
      name: player.name,
      age: player.age,
      heightCm: player.heightCm ?? 185,
      positions: player.positions ?? [],
      overall: player.overall,
      potential: player.development?.potential ?? player.overall,
      salary: seasonState?.playerContracts?.[String(player.id)]?.salary ?? player.contract?.salary ?? 0,
      yearsRemaining: seasonState?.playerContracts?.[String(player.id)]?.yearsRemaining ?? player.contract?.yearsRemaining ?? 1,
      attributes: { ...(player.attributes ?? {}) },
      activeTraits: getPlayerTraitIds(player).filter((id) => TRAIT_DEFINITIONS[id] && !TRAIT_DEFINITIONS[id].automatic),
    });
    setMessage({ type: "", text: "" });
  };

  const save = (event) => {
    event.preventDefault();
    const result = validatePlayerFields(values);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onSeasonStateChange((previous) => ({
      ...previous,
      fantasyPlayerEdits: { ...(previous.fantasyPlayerEdits ?? {}), [selectedId]: result },
      playerContracts: {
        ...(previous.playerContracts ?? {}),
        [selectedId]: {
          ...(previous.playerContracts?.[selectedId] ?? {}),
          club: previous.playerContracts?.[selectedId]?.club ?? players.find((player) => String(player.id) === selectedId)?.club ?? null,
          salary: result.salary,
          yearsRemaining: result.yearsRemaining,
        },
      },
      playerDevelopment: {
        ...(previous.playerDevelopment ?? {}),
        [selectedId]: {
          ...(previous.playerDevelopment?.[selectedId] ?? {}),
          overall: result.overall,
          potential: result.potential,
          attributeRatings: result.attributes,
          activeTraits: result.activeTraits,
        },
      },
    }));
    setMessage({ type: "success", text: `${result.name} has been updated.` });
  };

  return (
    <section aria-label="Edit players" style={{ display: "grid", gap: 20, maxWidth: 760 }}>
      <div>
        <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>Edit a player</h2>
        <input
          type="search"
          aria-label="Search players"
          placeholder="Search by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`, background: lightMode ? "#fff" : "#0f172a", color: lightMode ? "#0f172a" : "#f8fafc" }}
        />
        {matches.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
            {matches.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => choosePlayer(player)}
                  aria-pressed={selectedId === String(player.id)}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: `1px solid ${selectedId === String(player.id) ? "#ea580c" : lightMode ? "#cbd5e1" : "#334155"}`, background: lightMode ? "#fff" : "#0f172a", color: lightMode ? "#0f172a" : "#e2e8f0", cursor: "pointer" }}
                >
                  {player.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>· {player.club} · {player.overall} ovr</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {values && (
        <form onSubmit={save} style={{ display: "grid", gap: 18 }}>
          <FantasyPlayerFields values={values} onChange={setValues} lightMode={lightMode} showContract />
          {message.text && (
            <p role="status" style={{ margin: 0, color: message.type === "error" ? "#f87171" : "#4ade80", fontWeight: 700 }}>{message.text}</p>
          )}
          <div>
            <button type="submit" style={fantasyButtonStyle}>Save player</button>
          </div>
        </form>
      )}
    </section>
  );
}
