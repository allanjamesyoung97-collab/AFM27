import { useState } from "react";
import "./ClubProfile.css";

import ClubBadge
  from "./ClubBadge.jsx";

import { clubHistory }
  from "../data/clubHistory/clubHistory.js";
import { buildStatisticsSummary, collectSeasonMatches } from "../engine/statisticsEngine.js";
import { formatDraftPick } from "../engine/draftEngine.js";
import { BEST_TEAM_LINES, getClubBestTeam } from "../engine/clubStrengthEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import { getConfiguredSalaryCap, isSalaryCapEnforced } from "../engine/salaryCap.js";

export default function ClubProfile({
  club,
  players = [],
  seasonState,
  appearance = "dark",
  onBack
}) {
  const [activeTab,
    setActiveTab] =
    useState("OVERVIEW");
  const [playingListView, setPlayingListView] = useState("TOTAL");

  if (!club) {
    return null;
  }

  const tabStyle = (
    active
  ) => ({
    padding: "10px 14px",
    border: "none",
    borderRadius: "10px",
    background: active
      ? "#ea580c"
      : appearance === "light" ? "#e2e8f0" : "#1e293b",
    color: active ? "white" : appearance === "light" ? "#172033" : "white",
    cursor: "pointer",
    fontWeight: "bold"
  });

  const cardStyle = {
    background: appearance === "light" ? "#f1f5f9" : "#111827",
    padding: "12px",
    borderRadius: "10px",
    marginBottom: "10px"
  };

  const clubDraftPicks = (seasonState?.draftPickAssets ?? [])
    .filter((pick) => pick.currentOwner === club.name)
    .sort((a, b) => a.year - b.year || a.round - b.round);

  const clubPlayers =
    players.filter(
      (player) =>
        player.club ===
        club.name
    );
  const bestTeam = getClubBestTeam(clubPlayers);
  const administration = club.name === seasonState?.managerClubName
    ? seasonState?.clubAdministration ?? {}
    : seasonState?.leagueAdministration?.[club.name] ?? {};
  const currentSalaryCap = getConfiguredSalaryCap(seasonState?.seasonYear ?? 2027, administration);
  const capEnforced = isSalaryCapEnforced(administration);
  const currentPlayerPayments = clubPlayers.reduce((sum, player) => sum + Number(
    seasonState?.playerContracts?.[String(player.id)]?.salary ?? player.contract?.salary ?? 0,
  ), 0);
  const sortedClubPlayers = [...clubPlayers].sort((a, b) =>
    Number(b.overall ?? 0) - Number(a.overall ?? 0) || a.name.localeCompare(b.name));

  const history =
  clubHistory[club.name];
  const seasonMatches = collectSeasonMatches(seasonState).filter((match) => match.seasonYear === seasonState?.seasonYear);
  const seasonSummary = buildStatisticsSummary(seasonMatches);
  const clubStats = seasonSummary.teams.find((team) => team.club === club.name);
  const teamStatRows = [
    ["Disposals", "disposals"], ["Marks", "marks"], ["Tackles", "tackles"],
    ["Clearances", "clearances"], ["Inside 50s", "inside50s"], ["Hitouts", "hitouts"],
    ["Contested possessions", "contestedPossessions"], ["Uncontested possessions", "uncontestedPossessions"],
    ["Disposal efficiency", "disposalEfficiency"], ["Goal accuracy", "goalAccuracy"],
  ];

  return (
    <>
      <button
        onClick={onBack}
        style={{
          marginBottom: "16px",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "none",
          background: "#ea580c",
          color: "white",
          cursor: "pointer"
        }}
      >
        ← Back
      </button>

      <div
        className={`club-profile ${appearance === "light" ? "club-profile--light" : ""}`}
        style={{
          background: appearance === "light" ? "#ffffff" : "#0f172a",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "20px"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "20px"
          }}
        >
          <ClubBadge
            club={club.name}
            size={70}
          />

          <div>
            <h2
              style={{
                margin: 0
              }}
            >
              {club.name}
            </h2>

            <div
              style={{
                color: "#94a3b8"
              }}
            >
              {club.abbreviation}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "20px"
          }}
        >
          <button
            style={tabStyle(
              activeTab ===
                "OVERVIEW"
            )}
            onClick={() =>
              setActiveTab(
                "OVERVIEW"
              )
            }
          >
            Overview
          </button>

          <button
            style={tabStyle(
              activeTab ===
                "PLAYERS"
            )}
            onClick={() =>
              setActiveTab(
                "PLAYERS"
              )
            }
          >
            Playing List
          </button>

          <button
            style={tabStyle(
              activeTab ===
                "DRAFT"
            )}
            onClick={() =>
              setActiveTab("DRAFT")
            }
          >
            Draft Picks
          </button>

          <button style={tabStyle(activeTab === "STATS")} onClick={() => setActiveTab("STATS")}>
            Season Stats
          </button>

          <button
  style={tabStyle(
    activeTab ===
      "HISTORY"
  )}
  onClick={() =>
    setActiveTab(
      "HISTORY"
    )
  }
>
  Honours & Records
</button>
        </div>

        {activeTab ===
          "OVERVIEW" && (
          <>
            <div style={cardStyle}>
              <strong>
                Draft Picks
              </strong>

              <div>
                {clubDraftPicks.length
                  ? clubDraftPicks.map(formatDraftPick).join(", ")
                  : (club.draftPicks ?? []).join(", ")}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>
                Salary Cap
              </strong>

              <div>
                {capEnforced ? `$${currentSalaryCap.toLocaleString()}` : "Unrestricted"}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>
                Cap Space
              </strong>

              <div>
                {capEnforced ? `$${(currentSalaryCap - currentPlayerPayments).toLocaleString()}` : "Unrestricted"}
              </div>
            </div>

            <div style={cardStyle}>
              <strong>
                List Size
              </strong>

              <div>
                {
                  clubPlayers.length
                }{" "}
                Players
              </div>
            </div>
          </>
        )}

        {activeTab === "STATS" && (
          <section style={{ ...cardStyle, background: appearance === "light" ? "#f1f5f9" : "#111827", color: appearance === "light" ? "#0f172a" : "#f8fafc" }}>
            <h3 style={{ marginTop: 0 }}>Season team statistics · {seasonState?.seasonYear ?? "—"}</h3>
            {clubStats ? <>
              <p style={{ color: appearance === "light" ? "#64748b" : "#94a3b8" }}>{clubStats.matches} matches completed. League rank is based on per-game average.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
                {teamStatRows.map(([label, key]) => {
                  const average = clubStats.matches ? (clubStats[key] ?? 0) / clubStats.matches : 0;
                  const ranked = [...seasonSummary.teams].sort((a, b) => (b[key] / b.matches) - (a[key] / a.matches));
                  const rank = ranked.findIndex((team) => team.club === club.name) + 1;
                  const percent = key === "disposalEfficiency" || key === "goalAccuracy";
                  return <div key={key} style={{ padding: 10, borderRadius: 8, background: appearance === "light" ? "#fff" : "#0f172a" }}><small style={{ display: "block", color: appearance === "light" ? "#64748b" : "#94a3b8" }}>{label}</small><strong>{average.toFixed(1)}{percent ? "%" : ""} per game</strong><span style={{ display: "block", color: appearance === "light" ? "#64748b" : "#94a3b8", fontSize: 12 }}>League rank {rank} of {ranked.length}</span></div>;
                })}
              </div>
            </> : <p style={{ color: appearance === "light" ? "#64748b" : "#94a3b8" }}>Season statistics will appear after the first completed round.</p>}
          </section>
        )}

        {activeTab ===
          "PLAYERS" && (
          <>
            <div className="club-profile__list-tabs" role="tablist" aria-label="Playing list views">
              <button type="button" role="tab" aria-selected={playingListView === "TOTAL"} className={playingListView === "TOTAL" ? "is-active" : ""} onClick={() => setPlayingListView("TOTAL")}>Total List · {clubPlayers.length}</button>
              <button type="button" role="tab" aria-selected={playingListView === "BEST"} className={playingListView === "BEST" ? "is-active" : ""} onClick={() => setPlayingListView("BEST")}>Best Team · {bestTeam.selectedCount}/23</button>
            </div>
            {clubPlayers.length > 44 && (
              <div role="alert" style={{ ...cardStyle, border: "1px solid #ef4444", color: "#fecaca", fontWeight: 800 }}>
                List over limit: {clubPlayers.length}/44. Delist at least {clubPlayers.length - 44} player{clubPlayers.length - 44 === 1 ? "" : "s"} before the season starts.
              </div>
            )}
            {playingListView === "TOTAL" ? (
              clubPlayers.length ? <div role="tabpanel">
                <p className="club-profile__list-intro">Current list, ordered by overall rating.</p>
                <div className="club-profile__table-wrap"><table className="club-profile__table">
                  <thead><tr><th scope="col">Player</th><th scope="col">Positions</th><th scope="col">Age</th><th scope="col">OVR</th><th scope="col">Potential</th></tr></thead>
                  <tbody>{sortedClubPlayers.map((player) => <tr key={player.id}>
                    <td><strong>{player.name}</strong></td><td>{player.positions?.join(" / ") || "—"}</td>
                    <td>{player.age ?? "—"}</td><td><strong>{player.overall ?? "—"}</strong></td>
                    <td><PotentialStars player={player} size=".9em" /></td>
                  </tr>)}</tbody>
                </table></div>
              </div> : <div style={cardStyle}>No players assigned to this club yet.</div>
            ) : <div role="tabpanel">
              <p className="club-profile__list-intro">Projected best 23 based on each player’s current overall and eligible positions. Positions update when the list changes.</p>
              {BEST_TEAM_LINES.map(({ key, label }) => <section key={key} className="club-profile__line">
                <h4>{label}</h4>
                <div className="club-profile__line-grid">{bestTeam.lines[key].map(({ slot, player }) => <div className="club-profile__player" key={slot}>
                  <small>{slot}</small><strong>{player?.name ?? "Vacant"}</strong>
                  {player && <span>OVR {player.overall} · Age {player.age}</span>}
                </div>)}</div>
              </section>)}
            </div>}
          </>
        )}

        {activeTab ===
          "DRAFT" && (
          <>
            {clubDraftPicks.length ? clubDraftPicks.map((pick) => (
                <div
                  key={pick.id}
                  style={
                    cardStyle
                  }
                >
                  {formatDraftPick(pick)}
                </div>
              )) : (club.draftPicks ?? []).map((pick) => <div key={pick} style={cardStyle}>Pick {pick}</div>)}
          </>
        )}

{activeTab === "HISTORY" && history && (
  <>
    <div style={cardStyle}>
      <strong>Founded</strong>
      <div>{history.founded}</div>
    </div>

    <div style={cardStyle}>
      <strong>Best & Fairest Award</strong>
      <div>
        {history.clubAwards?.bestAndFairest ??
          "N/A"}
      </div>
    </div>

    <div style={cardStyle}>
      <strong>Premierships</strong>
      <div>
        {history.honours?.premierships ??
          0}
      </div>
    </div>

    <div style={cardStyle}>
      <strong>Premiership Years</strong>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "8px"
        }}
      >
        {history.honours?.premiershipYears?.map(
          year => (
            <span
              key={year}
              style={{
                background: "#1e293b",
                padding: "4px 8px",
                borderRadius: "8px"
              }}
            >
              {year}
            </span>
          )
        )}
      </div>
    </div>

    <div style={cardStyle}>
      <strong>Brownlow Medallists</strong>

      {history.brownlowMedallists?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>Coleman Medallists</strong>

      {history.colemanMedallists?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>Norm Smith Medallists</strong>

      {history.normSmithMedallists?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>Leigh Matthews Trophy</strong>

      {history.leighMatthewsTrophy?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>AFLCA Champion Player</strong>

      {history.aflcaChampionPlayer?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>Mark of the Year</strong>

      {history.markOfTheYear?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>

    <div style={cardStyle}>
      <strong>Goal of the Year</strong>

      {history.goalOfTheYear?.map(
        winner => (
          <div
            key={`${winner.player}-${winner.year}`}
          >
            {winner.player} ({winner.year})
          </div>
        )
      )}
    </div>
  </>
)}

      </div>
    </>
  );
}
