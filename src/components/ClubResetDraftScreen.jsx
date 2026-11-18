import { useEffect, useMemo, useRef, useState } from "react";
import { getClubResetDraftEligibility, getClubResetDraftStatus, resetDraftPositionGroup } from "../engine/clubResetDraftEngine.js";
import ClubBadge from "./ClubBadge.jsx";
import PotentialStars from "./PotentialStars.jsx";

const money = value => `$${Math.round(Number(value ?? 0)).toLocaleString("en-AU")}`;
const positionName = { DEF: "Defender", MID: "Midfielder", FWD: "Forward", RUC: "Ruckman" };

export default function ClubResetDraftScreen({ draft, onDraftPlayer, onAutofill, autofillBusy = false, error = "", onExit }) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sortBy, setSortBy] = useState("overall");
  const orderRef = useRef(null);
  const currentPickRef = useRef(null);
  const status = getClubResetDraftStatus(draft);
  const onClock = draft?.pickOwners?.[draft?.pickIndex];
  const selectedPicks = useMemo(() => new Map((draft?.picks ?? []).map(pick => [pick.pick, pick])), [draft?.picks]);
  useEffect(() => {
    const list = orderRef.current;
    const row = currentPickRef.current;
    if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 3);
  }, [draft?.pickIndex]);
  const eligibility = useMemo(() => getClubResetDraftEligibility(draft, draft?.userClub), [draft]);
  const available = useMemo(() => (draft?.availableIds ?? [])
    .map(id => draft.playersById[id])
    .filter(player => player && (!search.trim() || `${player.name} ${player.juniorClub ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())))
    .filter(player => position === "ALL" || resetDraftPositionGroup(player) === position)
    .sort((a, b) => sortBy === "name"
      ? a.name.localeCompare(b.name)
      : sortBy === "salary"
        ? Number(draft.playerContracts[String(a.id)]?.salary ?? 0) - Number(draft.playerContracts[String(b.id)]?.salary ?? 0)
        : sortBy === "potential"
          ? Number(b.development?.potential ?? b.potential ?? 0) - Number(a.development?.potential ?? a.potential ?? 0)
          : Number(b.overall ?? 0) - Number(a.overall ?? 0)),
  [draft, search, position, sortBy]);

  return <main style={{ minHeight: "100vh", padding: "clamp(16px, 3vw, 38px)", color: "#f8fafc", background: "#020617", fontFamily: "Arial, sans-serif" }}>
    <div style={{ maxWidth: 1380, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div><div style={{ color: "#fb923c", fontSize: 12, letterSpacing: 3, fontWeight: 800 }}>CLUB RESET MODE · LEAGUE DRAFT</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: "clamp(24px, 4vw, 36px)" }}>Build {draft.userClub} from scratch</h1>
          <div style={{ color: "#94a3b8" }}>Every listed AFL player and 50 new prospects entered the pool. The opening order is redrawn for each new game; later drafts follow the ladder.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onAutofill && <button type="button" onClick={onAutofill} disabled={autofillBusy || draft.completed}
            title="Fill your remaining picks automatically within the salary cap and position minimums"
            style={{ ...buttonStyle, background: "#0f766e", opacity: autofillBusy ? 0.65 : 1, cursor: autofillBusy ? "wait" : "pointer" }}>
            {autofillBusy ? "Autofilling draft…" : `Autofill remaining ${status.remainingPicks} picks`}
          </button>}
          {onExit && <button type="button" onClick={onExit} disabled={autofillBusy} style={{ ...buttonStyle, background: "#1e293b", opacity: autofillBusy ? 0.5 : 1 }}>Exit draft</button>}
        </div>
      </header>
      {error && <p role="alert" style={{ padding: "10px 12px", color: "#fecaca", background: "#7f1d1d", borderRadius: 8 }}>{error}</p>}
      <section style={{ ...panelStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div><small style={muted}>ON THE CLOCK</small><strong style={{ display: "block", marginTop: 4, fontSize: 19 }}>{onClock ?? "Draft complete"}</strong><span style={muted}>Pick {Math.min(draft.pickIndex + 1, draft.totalPicks)} of {draft.totalPicks}</span></div>
        <div><small style={muted}>YOUR LIST</small><strong style={{ display: "block", marginTop: 4, fontSize: 19 }}>{status.rostered} / {status.rosterSize}</strong><span style={muted}>{status.remainingPicks} picks remaining for your club</span></div>
        <div><small style={muted}>SALARY CAP REMAINING</small><strong style={{ display: "block", marginTop: 4, fontSize: 19, color: status.remainingCap < 2_000_000 ? "#fbbf24" : "#34d399" }}>{money(status.remainingCap)}</strong><span style={muted}>{money(status.payroll)} committed of {money(status.salaryCap)}</span></div>
        <div><small style={muted}>POSITION MINIMUMS</small><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 7 }}>{Object.entries(status.minimums).map(([group, minimum]) => <span key={group} style={{ ...badgeStyle, color: status.counts[group] >= minimum ? "#34d399" : "#fbbf24" }}>{group} {status.counts[group]}/{minimum}</span>)}</div></div>
      </section>

      <div className="club-reset-draft-layout">
      <section style={{ ...panelStyle, minWidth: 0 }} aria-label="Draft order">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Draft order</h2>
          <span style={muted}>{draft.picks.length} / {draft.totalPicks} selected</span>
        </div>
        <p style={{ ...muted, margin: "0 0 12px" }}>Selections appear here as every club drafts.</p>
        <div ref={orderRef} className="club-reset-draft-order" role="list">
          {draft.pickOwners.slice(0, draft.totalPicks).map((club, index) => {
            const pickNumber = index + 1;
            const selection = selectedPicks.get(pickNumber);
            const current = index === draft.pickIndex && !draft.completed;
            const userPick = club === draft.userClub;
            return <div key={pickNumber} ref={current ? currentPickRef : undefined} role="listitem" aria-current={current ? "step" : undefined}
              className={`club-reset-draft-order-row${current ? " current" : ""}${userPick ? " user" : ""}`}>
              <span style={{ color: current ? "#fb923c" : "#94a3b8", fontWeight: 800, fontSize: 12 }}>#{pickNumber}</span>
              <ClubBadge club={club} size={22} />
              <span className="club-reset-draft-order-club" title={club}>{club}</span>
              <span className="club-reset-draft-order-selection" title={selection?.playerName ?? ""}>
                {selection?.passed ? "Pass" : selection?.playerName ?? (current ? "On the clock" : "—")}
              </span>
            </div>;
          })}
        </div>
      </section>

      <section style={{ ...panelStyle, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={labelStyle}>Search players<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or junior club" style={inputStyle} /></label>
          <label style={labelStyle}>Position group<select value={position} onChange={event => setPosition(event.target.value)} style={inputStyle}><option value="ALL">All positions</option>{Object.entries(positionName).map(([group, label]) => <option key={group} value={group}>{group === "RUC" ? "Ruckmen" : `${label}s`}</option>)}</select></label>
          <label style={labelStyle}>Sort by<select value={sortBy} onChange={event => setSortBy(event.target.value)} style={inputStyle}><option value="overall">Overall · high to low</option><option value="potential">Potential · high to low</option><option value="salary">Contract value · low to high</option><option value="name">Name · A–Z</option></select></label>
          <span style={{ ...muted, paddingBottom: 10 }}>{available.length} shown · {draft.availableIds.length} available</span>
        </div>
        <div style={{ maxHeight: "58vh", overflow: "auto", border: "1px solid #263449", borderRadius: 10 }}>
          <table style={{ width: "100%", minWidth: 670, borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#111c30", color: "#94a3b8", textAlign: "left" }}><tr>{["Player", "Position", "Age", "OVR", "Potential", "Contract value", ""].map(label => <th key={label} style={{ padding: "10px 9px", borderBottom: "1px solid #334155" }}>{label}</th>)}</tr></thead>
            <tbody>{available.map(player => {
              const validation = eligibility[String(player.id)] ?? { ok: false, reason: "This player is not available for this selection." };
              const salary = Number(draft.playerContracts[String(player.id)]?.salary ?? player.contract?.salary ?? 0);
              return <tr key={player.id} style={{ opacity: validation.ok ? 1 : 0.55 }}>
                <td style={cellStyle}><strong>{player.name}</strong>{player.isDraftProspect && <small style={{ display: "block", color: "#60a5fa" }}>Draft prospect · #{player.draftRank} · {player.juniorClub}</small>}</td>
                <td style={cellStyle}>{positionName[resetDraftPositionGroup(player)]}</td><td style={cellStyle}>{player.age ?? 18}</td><td style={cellStyle}>{player.overall ?? "—"}</td><td style={cellStyle}><PotentialStars player={player} size="15px" /></td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{money(salary)} / year</td>
                <td style={cellStyle}><button type="button" disabled={autofillBusy || !validation.ok || draft.pickOwners[draft.pickIndex] !== draft.userClub} title={validation.ok ? "Draft player" : validation.reason} onClick={() => onDraftPlayer(player.id)} style={{ ...buttonStyle, opacity: validation.ok && !autofillBusy ? 1 : 0.6, cursor: validation.ok && !autofillBusy ? "pointer" : "not-allowed" }}>Draft</button></td>
              </tr>;
            })}</tbody>
          </table>
          {!available.length && <p style={{ padding: 16, color: "#94a3b8" }}>No available players match this search.</p>}
        </div>
      </section>
      </div>
      <p style={{ color: "#64748b", fontSize: 12, textAlign: "center" }}>Minimums apply to your 44-player list: 6 defenders, 6 midfielders, 6 forwards and 2 ruckmen. Contract amounts are shown as annual player payments.</p>
    </div>
    <style>{`
      .club-reset-draft-layout { display: grid; grid-template-columns: minmax(285px, 330px) minmax(0, 1fr); gap: 14px; align-items: start; }
      .club-reset-draft-order { max-height: 58vh; overflow-y: auto; border: 1px solid #263449; border-radius: 10px; background: #0b1220; }
      .club-reset-draft-order-row { display: grid; grid-template-columns: 34px 22px minmax(68px, 0.75fr) minmax(0, 1.25fr); align-items: center; gap: 8px; min-height: 39px; padding: 5px 9px; border-bottom: 1px solid #1e293b; }
      .club-reset-draft-order-row:last-child { border-bottom: 0; }
      .club-reset-draft-order-row.current { background: #43200d; outline: 1px solid #fb923c; outline-offset: -1px; }
      .club-reset-draft-order-row.user:not(.current) { background: #1e293b; }
      .club-reset-draft-order-club, .club-reset-draft-order-selection { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
      .club-reset-draft-order-club { font-weight: 700; }
      .club-reset-draft-order-selection { color: #cbd5e1; text-align: right; }
      .club-reset-draft-order-row.current .club-reset-draft-order-selection { color: #fb923c; font-weight: 800; }
      @media (max-width: 900px) { .club-reset-draft-layout { grid-template-columns: minmax(0, 1fr); } .club-reset-draft-order { max-height: 260px; } }
    `}</style>
  </main>;
}

const panelStyle = { padding: 16, marginBottom: 14, border: "1px solid #334155", borderRadius: 14, background: "#0f172a" };
const muted = { color: "#94a3b8", fontSize: 12 };
const badgeStyle = { padding: "5px 8px", background: "#1e293b", borderRadius: 7, fontWeight: 800, fontSize: 12 };
const labelStyle = { display: "grid", gap: 5, color: "#94a3b8", fontSize: 12, minWidth: 180 };
const inputStyle = { padding: 9, color: "#f8fafc", background: "#0b1220", border: "1px solid #475569", borderRadius: 8 };
const cellStyle = { padding: "9px", borderBottom: "1px solid #1e293b", fontSize: 13 };
const buttonStyle = { padding: "8px 12px", color: "#fff", background: "#ea580c", border: 0, borderRadius: 8, fontWeight: 800, cursor: "pointer" };
