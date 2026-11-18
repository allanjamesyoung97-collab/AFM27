import { useState } from "react";
import "./DraftBoard.css";

export default function DraftBoard({ draft, pickMeta, lastRound, displayRound, userClubName, picks }) {
  const [selectedRound, setSelectedRound] = useState(null);
  const activeRound = selectedRound ?? displayRound;
  const rounds = Array.from({ length: lastRound }, (_, index) => index + 1);
  const entries = pickMeta
    .map((entry, index) => {
      const resolved = draft.completed || index < draft.pickIndex;
      const result = resolved ? picks.find((pick) => pick.pick === index + 1) : null;
      return { ...entry, index, resolved, result, onClock: !draft.completed && index === draft.pickIndex };
    });
  const roundEntries = entries.filter((entry) => (entry.round ?? 1) === activeRound);
  const yourPicksThisRound = roundEntries.filter((entry) => entry.owner === userClubName).map((entry) => entry.index + 1);

  return <section className="db-board" aria-label="Draft board">
    <header className="db-header">
      <div>
        <h3 className="db-title">Draft board</h3>
        <p className="db-subtitle">
          {yourPicksThisRound.length
            ? `${userClubName} pick${yourPicksThisRound.length === 1 ? "" : "s"} ${yourPicksThisRound.join(", ")} in round ${activeRound}`
            : `No ${userClubName ?? "club"} picks in round ${activeRound}`}
        </p>
      </div>
      <div className="db-tabs" role="group" aria-label="Draft round">
        {rounds.map((round) => {
          const roundPicks = entries.filter((entry) => (entry.round ?? 1) === round);
          const done = roundPicks.filter((entry) => entry.resolved).length;
          return <button key={round} type="button" className="db-tab" aria-pressed={round === activeRound} onClick={() => setSelectedRound(round)}>
            <span>Round {round}</span>
            <small>{done}/{roundPicks.length}</small>
          </button>;
        })}
      </div>
    </header>

    <div className="db-grid">
      {roundEntries.map((entry) => {
        const mine = entry.owner === userClubName;
        const traded = entry.traded && entry.originalClub && entry.originalClub !== entry.owner;
        const stateClass = entry.onClock ? "db-card--clock" : entry.resolved ? "db-card--done" : "db-card--upcoming";
        return <article key={`${entry.id}-${entry.index}`} className={`db-card ${stateClass}${mine ? " db-card--mine" : ""}`}>
          <div className="db-card-top">
            <span className="db-pick-number">Pick {entry.index + 1}</span>
            {mine && <span className="db-badge db-badge--mine">You</span>}
          </div>
          <div className="db-club">{entry.owner}</div>
          {traded && <div className="db-meta">via {entry.originalClub}</div>}
          {(entry.compensation || entry.matched) && <div className="db-badges">
            {entry.compensation && <span className="db-badge db-badge--comp">Compensation</span>}
            {entry.matched && <span className="db-badge db-badge--matched">Matched bid</span>}
          </div>}
          <div className="db-status">
            {entry.onClock ? <><span className="db-live-dot" aria-hidden="true" />On the clock</>
              : entry.resolved ? (entry.result?.passed || !entry.result?.playerName ? "Passed" : <span className="db-selected">{entry.result.playerName}</span>)
              : "Upcoming"}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
