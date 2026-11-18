import { useState } from "react";
import { getCareerClub } from "../engine/contractEngine.js";

export default function FantasyTeamsPanel({ players, clubs, seasonState, onSeasonStateChange, lightMode }) {
  const [clubName, setClubName] = useState(clubs[0]?.name ?? "");
  const [query, setQuery] = useState("");
  const contracts = seasonState.playerContracts ?? {};
  const borderColor = lightMode ? "#cbd5e1" : "#334155";
  const surface = lightMode ? "#fff" : "#0f172a";
  const textColor = lightMode ? "#0f172a" : "#e2e8f0";

  const roster = players
    .filter((player) => getCareerClub(player, contracts) === clubName)
    .sort((a, b) => b.overall - a.overall);
  const term = query.trim().toLowerCase();
  const candidates = term
    ? players
      .filter((player) => getCareerClub(player, contracts) !== clubName && player.name.toLowerCase().includes(term))
      .slice(0, 20)
    : [];

  const movePlayer = (playerId, toClub) => {
    onSeasonStateChange((previous) => ({
      ...previous,
      playerContracts: {
        ...(previous.playerContracts ?? {}),
        [String(playerId)]: { ...(previous.playerContracts?.[String(playerId)] ?? {}), club: toClub },
      },
    }));
  };

  const delistPlayer = (playerId) => {
    onSeasonStateChange((previous) => ({
      ...previous,
      playerContracts: {
        ...(previous.playerContracts ?? {}),
        [String(playerId)]: {
          ...(previous.playerContracts?.[String(playerId)] ?? {}),
          club: clubName,
          delisted: true,
          delistedSeason: Number(previous.seasonYear ?? 2027),
        },
      },
    }));
  };

  const removePlayer = (player) => {
    if (typeof window !== "undefined" && !window.confirm(`Remove ${player.name} from this career? This cannot be undone from this screen.`)) return;
    onSeasonStateChange((previous) => ({
      ...previous,
      fantasyRemovedPlayerIds: [...new Set([...(previous.fantasyRemovedPlayerIds ?? []).map(String), String(player.id)])],
      playerContracts: {
        ...(previous.playerContracts ?? {}),
        [String(player.id)]: {
          ...(previous.playerContracts?.[String(player.id)] ?? {}),
          club: null,
          delisted: true,
          removedFromGame: true,
        },
      },
    }));
  };

  return (
    <section aria-label="Edit teams" style={{ display: "grid", gap: 20, maxWidth: 820 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, maxWidth: 360 }}>
        Team
        <select value={clubName} onChange={(event) => setClubName(event.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
          {clubs.map((club) => <option key={club.id ?? club.name} value={club.name}>{club.name}</option>)}
        </select>
      </label>

      <div>
        <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Current list ({roster.length})</h2>
        {roster.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>No players are listed for this team.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {roster.map((player) => (
              <li key={player.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
                <span>{player.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>· {player.overall} ovr</span></span>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <select
                    aria-label={`Move ${player.name} to another team`}
                    value=""
                    onChange={(event) => event.target.value && movePlayer(player.id, event.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor, maxWidth: 200 }}
                  >
                    <option value="">Move to…</option>
                    {clubs.filter((club) => club.name !== clubName).map((club) => <option key={club.id ?? club.name} value={club.name}>{club.name}</option>)}
                  </select>
                  <button type="button" onClick={() => delistPlayer(player.id)} aria-label={`Delist ${player.name}`} style={{ padding: "6px 9px", border: `1px solid ${borderColor}`, borderRadius: 8, color: textColor, background: surface, fontWeight: 700, cursor: "pointer" }}>Delist</button>
                  <button type="button" onClick={() => removePlayer(player)} aria-label={`Remove ${player.name} from game`} style={{ padding: "6px 9px", border: "1px solid #7f1d1d", borderRadius: 8, color: lightMode ? "#b91c1c" : "#fca5a5", background: lightMode ? "#fef2f2" : "#2b1115", fontWeight: 700, cursor: "pointer" }}>Remove from game</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Add a player to this team</h2>
        <input
          type="search"
          aria-label="Search players to add"
          placeholder="Search by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}
        />
        {candidates.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
            {candidates.map((player) => (
              <li key={player.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
                <span>{player.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>· {getCareerClub(player, contracts)}</span></span>
                <button type="button" onClick={() => movePlayer(player.id, clubName)} style={{ padding: "6px 10px", border: 0, borderRadius: 8, color: "#fff", background: "#ea580c", fontWeight: 700, cursor: "pointer" }}>Add</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
