import { useMemo, useState } from "react";
import { historicalPlayerStats } from "../data/historicalPlayerStats.js";
import { fantasyLegendProfiles } from "../data/fantasyLegends.js";
import { createLegendPlayer, FANTASY_POSITIONS } from "../engine/fantasyToolsEngine.js";
import {
  canSelectLegend,
  addLegendToClub,
  createLegendsDraftState,
  getLegendsDraftClub,
  passLegendsDraftPick,
  processLegendsDraftAI,
  selectLegendsDraftPlayer,
} from "../engine/legendsDraftEngine.js";
import { fantasyButtonStyle } from "./FantasyPlayerFields.jsx";

const emptyProfile = () => ({ age: "", positions: [], overall: "", potential: "", heightCm: "", salary: "", yearsRemaining: "" });

export default function FantasyLegendsPanel({ players, clubs, seasonState, onSeasonStateChange, lightMode, view = "DRAFT" }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [draftFormat, setDraftFormat] = useState("18");
  const [manualClub, setManualClub] = useState(seasonState.managerClubName ?? clubs[0]?.name ?? "");
  const [legendSort, setLegendSort] = useState("OVERALL");
  const [legendPosition, setLegendPosition] = useState("ALL");
  const takenNames = useMemo(() => new Set([
    ...players.map((player) => player.name),
    ...(seasonState.legendDraftPool ?? []).map((player) => player.name),
  ]), [players, seasonState.legendDraftPool]);
  const curatedProfiles = fantasyLegendProfiles.filter((item) => !takenNames.has(item.name));
  const visibleProfiles = useMemo(() => curatedProfiles
    .filter((profile) => legendPosition === "ALL" || (profile.positions ?? []).includes(legendPosition))
    .sort((a, b) => legendSort === "NAME" ? a.name.localeCompare(b.name) : Number(b.overall ?? 0) - Number(a.overall ?? 0) || a.name.localeCompare(b.name)),
  [curatedProfiles, legendPosition, legendSort]);
  const term = query.trim().toLowerCase();
  const candidates = term
    ? historicalPlayerStats.filter((record) => !takenNames.has(record.name) && record.name.toLowerCase().includes(term)).slice(0, 25)
    : [];
  const borderColor = lightMode ? "#cbd5e1" : "#334155";
  const surface = lightMode ? "#fff" : "#0f172a";
  const textColor = lightMode ? "#0f172a" : "#e2e8f0";
  const pool = seasonState.legendDraftPool ?? [];
  const draft = seasonState.legendDraft ?? null;
  const userClubName = seasonState.managerClubName;
  const currentClub = getLegendsDraftClub(draft);
  const draftPlayers = players;

  const chooseProfile = (preset) => {
    const record = historicalPlayerStats.find((item) => item.name === preset.name) ?? { name: preset.name, games: 0, goals: 0, disposals: 0 };
    setSelectedRecord(record);
    setProfile({
      age: String(preset.age), positions: preset.positions, overall: String(preset.overall),
      potential: String(preset.potential), heightCm: String(preset.heightCm),
      salary: String(preset.salary), yearsRemaining: String(preset.yearsRemaining),
      signatureAttributes: preset.signatureAttributes, suggestedTraits: preset.suggestedTraits,
    });
    setMessage("Profile loaded. You can revise it before adding the legend.");
    if (draft?.status === "ACTIVE") setMessage("A draft is already in progress. You can add this legend directly to a club instead.");
  };

  const addPresetDirectly = (preset) => {
    const record = historicalPlayerStats.find((item) => item.name === preset.name) ?? { name: preset.name, games: 0, goals: 0, disposals: 0 };
    const result = createLegendPlayer(record, null, preset);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const seededState = {
      ...seasonState,
      playerContracts: { ...(seasonState.playerContracts ?? {}), [String(result.player.id)]: result.contract },
    };
    const added = addLegendToClub(seededState, players, result.player, manualClub);
    if (added.error) {
      setMessage(added.error);
      return;
    }
    onSeasonStateChange(added.state);
    setMessage(`${preset.name} added to ${manualClub}.`);
  };

  const addSelectedDirectly = () => {
    if (!selectedRecord) return;
    const result = createLegendPlayer(selectedRecord, null, profile);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const seededState = {
      ...seasonState,
      playerContracts: { ...(seasonState.playerContracts ?? {}), [String(result.player.id)]: result.contract },
    };
    const added = addLegendToClub(seededState, players, result.player, manualClub);
    if (added.error) {
      setMessage(added.error);
      return;
    }
    onSeasonStateChange(added.state);
    setMessage(`${selectedRecord.name} added to ${manualClub}.`);
    setSelectedRecord(null);
    setProfile(emptyProfile());
  };

  const startDraft = () => {
    const eligibleProfiles = curatedProfiles;
    const availableCount = pool.length + eligibleProfiles.length;
    const count = draftFormat === "FULL" ? availableCount : draftFormat === "LUCKY_DIP" ? Math.min(18, availableCount) : Math.min(Number(draftFormat), availableCount);
    const shuffled = [...eligibleProfiles];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const chosen = shuffled.slice(0, Math.max(0, count - pool.length));
    const prepared = chosen.map((preset) => {
      const record = historicalPlayerStats.find((item) => item.name === preset.name) ?? { name: preset.name, games: 0, goals: 0, disposals: 0 };
      return createLegendPlayer(record, null, preset);
    });
    const invalid = prepared.find((result) => result.error);
    if (invalid) {
      setMessage(invalid.error);
      return;
    }
    const generatedPool = [...pool, ...prepared.map((result) => result.player)].slice(0, count);
    const newContracts = Object.fromEntries(prepared.map((result) => [String(result.player.id), result.contract]));
    const created = createLegendsDraftState(clubs, userClubName, generatedPool, { pickCount: generatedPool.length, luckyDip: draftFormat === "LUCKY_DIP" });
    if (created.error) {
      setMessage(created.error);
      return;
    }
    onSeasonStateChange((previous) => {
      const started = {
        ...previous,
        legendDraft: created,
        legendDraftPool: generatedPool,
        playerContracts: { ...(previous.playerContracts ?? {}), ...newContracts },
      };
      const currentPlayers = [...new Map([...draftPlayers, ...(previous.generatedPlayers ?? [])].map((player) => [String(player.id), player])).values()];
      return processLegendsDraftAI(started, currentPlayers, userClubName);
    });
    setMessage(draftFormat === "LUCKY_DIP"
      ? "Lucky dip complete: 18 legends were assigned at random, subject to each club’s list and cap rules."
      : `${draftFormat === "FULL" ? "Full legends draft" : `${generatedPool.length}-player legends draft`} started. Draft pools are generated automatically; clubs protect their Best 23 and stay within the salary cap.`);
  };

  const makePick = (legend) => {
    if (!currentClub || currentClub !== userClubName) return;
    const result = selectLegendsDraftPlayer(seasonState, draftPlayers, userClubName, legend.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    onSeasonStateChange((previous) => processLegendsDraftAI(result.state, draftPlayers, userClubName));
    setMessage(`${legend.name} drafted by ${userClubName}.`);
  };

  const passPick = () => {
    if (currentClub !== userClubName) return;
    const passed = passLegendsDraftPick(seasonState, userClubName);
    onSeasonStateChange((previous) => processLegendsDraftAI(passed, draftPlayers, userClubName));
    setMessage(`${userClubName} passed its selection.`);
  };

  const updateProfile = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  return (
    <section aria-label={view === "ADD" ? "Add Legends" : "Legends Draft"} style={{ display: "grid", gap: 20, maxWidth: 1000 }}>
      {view === "DRAFT" && <section style={{ display: "grid", gap: 12, padding: 16, border: `1px solid ${borderColor}`, borderRadius: 10, background: surface, color: textColor }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Legends Draft setup</h2>
            <p style={{ margin: 0, color: lightMode ? "#475569" : "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
            Choose how many legends enter the automatically generated pool. Multiple rounds use a snake order; clubs at the 44-player limit must replace someone outside their Best 23. Lucky Dip randomly assigns up to one legend to each club. {seasonState.fantasySettings?.salaryCapEnabled === false ? "Salary cap restrictions are disabled for this career." : "Contracted outgoing players remain on that club’s cap."}
            </p>
          </div>
          {!draft && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select aria-label="Legends draft format" value={draftFormat} onChange={(event) => setDraftFormat(event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
              <option value="18">Random 18 legends</option><option value="36">36 players</option><option value="54">54 players</option><option value="FULL">Full legends draft</option><option value="LUCKY_DIP">Lucky dip draft · 18 clubs</option>
            </select>
            <button type="button" disabled={!curatedProfiles.length && !pool.length} onClick={startDraft} style={{ ...fantasyButtonStyle, padding: "10px 14px", opacity: curatedProfiles.length || pool.length ? 1 : 0.55 }}>
              {draftFormat === "LUCKY_DIP" ? "Run Lucky Dip" : "Start Legends Draft"}
            </button>
          </div>}
        </div>
        {draft && <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: draft.status === "ACTIVE" ? "#fbbf24" : "#4ade80", fontWeight: 800 }}>
            {draft.status === "ACTIVE"
              ? currentClub === userClubName ? `Your pick · ${userClubName}` : `${currentClub ?? "Draft complete"} is selecting`
              : `Draft complete · ${draft.picks.length} legend${draft.picks.length === 1 ? "" : "s"} selected`}
          </div>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))" }}>
            {draft.order.map((club, index) => {
              const pick = draft.picks.find((item) => item.pick === index + 1);
              const isOnClock = draft.status === "ACTIVE" && draft.order[draft.pickIndex] === club;
              return <div key={`${club}-${index}`} style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${isOnClock ? "#f59e0b" : borderColor}`, background: isOnClock ? (lightMode ? "#fffbeb" : "#29200f") : "transparent", fontSize: 12 }}>
                <b>Pick {index + 1} · {club}</b><span style={{ display: "block", marginTop: 3, color: lightMode ? "#475569" : "#94a3b8" }}>{pick?.playerName ?? (index < draft.pickIndex ? "Passed" : isOnClock ? "On the clock" : "Awaiting pick")}</span>
              </div>;
            })}
          </div>
        </div>}
        {message && <p role="status" style={{ margin: 0, color: message.includes("cannot") || message.includes("must") || message.includes("Enter") ? "#f87171" : "#4ade80", fontWeight: 700, fontSize: 13 }}>{message}</p>}
      </section>}

      {view === "ADD" && <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 20 }}>Legends</h2><p style={{ margin: "4px 0 0", color: lightMode ? "#475569" : "#94a3b8", fontSize: 13 }}>Use a suggested peak profile or revise it before adding that legend directly to a club.</p></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: lightMode ? "#475569" : "#94a3b8", fontSize: 13 }}>Add directly to<select value={manualClub} onChange={(event) => setManualClub(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>{clubs.map((club) => <option key={club.id ?? club.name} value={club.name}>{club.name}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, color: lightMode ? "#475569" : "#94a3b8", fontSize: 13 }}>Sort by<select aria-label="Sort legends" value={legendSort} onChange={(event) => setLegendSort(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}><option value="OVERALL">Overall</option><option value="NAME">A–Z</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, color: lightMode ? "#475569" : "#94a3b8", fontSize: 13 }}>Position<select aria-label="Filter legends by position" value={legendPosition} onChange={(event) => setLegendPosition(event.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}><option value="ALL">All positions</option>{FANTASY_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))" }}>
          {visibleProfiles.length ? visibleProfiles.map((preset) => <article key={preset.name} style={{ display: "grid", gap: 8, padding: 12, borderRadius: 9, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
            <div><b>{preset.name}</b><span style={{ color: lightMode ? "#64748b" : "#94a3b8" }}> · {preset.club}</span><span style={{ display: "block", color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12, marginTop: 3 }}>OVR {preset.overall} · age {preset.age} · {preset.positions.join(" / ")} · {preset.heightCm} cm</span></div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{!draft && <button type="button" onClick={() => chooseProfile(preset)} style={{ ...fantasyButtonStyle, padding: "7px 10px" }}>Review profile</button>}<button type="button" onClick={() => addPresetDirectly(preset)} style={{ ...fantasyButtonStyle, padding: "7px 10px" }}>Add to {manualClub}</button></div>
          </article>) : <p style={{ margin: 0, color: lightMode ? "#64748b" : "#94a3b8" }}>{curatedProfiles.length ? "No legends match this position filter." : "All currently listed legends are already in this career. Search the records below to create another profile."}</p>}
        </div>
        {message && <p role="status" style={{ margin: 0, color: message.includes("exceed") || message.includes("full list") || message.includes("Enter") ? "#f87171" : "#4ade80", fontWeight: 700, fontSize: 13 }}>{message}</p>}
      </section>}

      {view === "DRAFT" && draft?.status === "ACTIVE" && currentClub === userClubName && <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Available legends</h3>
        {pool.map((legend) => {
          const eligibility = canSelectLegend(seasonState, draftPlayers, userClubName, legend);
          return <article key={legend.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 12, borderRadius: 9, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
            <div>
              <b>{legend.name}</b> · OVR {legend.overall} · {legend.age} yrs · {legend.positions?.join(" / ")}<br />
              <span style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12 }}>${Number(legend.contract?.salary ?? seasonState.playerContracts?.[String(legend.id)]?.salary ?? 0).toLocaleString()}/year · {legend.contract?.yearsRemaining ?? seasonState.playerContracts?.[String(legend.id)]?.yearsRemaining ?? 0} years · {legend.heightCm} cm</span>
              {!eligibility.ok && <span style={{ display: "block", color: "#f87171", fontSize: 12, marginTop: 3 }}>{eligibility.reason}</span>}
            </div>
            <button type="button" disabled={!eligibility.ok} onClick={() => makePick(legend)} style={{ ...fantasyButtonStyle, padding: "8px 12px", opacity: eligibility.ok ? 1 : 0.5 }}>Draft legend</button>
          </article>;
        })}
        <button type="button" onClick={passPick} style={{ ...fantasyButtonStyle, justifySelf: "start", padding: "8px 12px" }}>Pass this pick</button>
      </section>}

      {view === "DRAFT" && !draft && <>
        {pool.length > 0 && <section style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Prepared draft pool · {pool.length}</h3>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {pool.map((legend) => <div key={legend.id} style={{ padding: 10, border: `1px solid ${borderColor}`, borderRadius: 8, background: surface, color: textColor, fontSize: 13 }}>
              <b>{legend.name}</b><span style={{ display: "block", color: lightMode ? "#64748b" : "#94a3b8", marginTop: 3 }}>OVR {legend.overall} · {legend.age} yrs · {legend.positions?.join(" / ")}</span>
            </div>)}
          </div>
        </section>}

      </>}

      {view === "ADD" && <>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Prepare a legend profile</h2>
          <p style={{ margin: "0 0 12px", color: lightMode ? "#475569" : "#94a3b8", fontSize: 14, lineHeight: 1.5 }}>
            Career records provide games and totals only, so enter the peak profile and contract yourself. The Legends Draft creates its own pool automatically.
          </p>
          <input type="search" aria-label="Search legends" placeholder="Search AFL career records by name" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }} />
        </div>
        {candidates.length > 0 && <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {candidates.map((record) => <li key={record.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }}>
            <span>{record.name}<span style={{ display: "block", color: "#94a3b8", fontSize: 12 }}>{record.games} games · {record.goals} goals · {record.disposals} disposals</span></span>
            <button type="button" onClick={() => { setSelectedRecord(record); setProfile(emptyProfile()); setMessage(""); }} style={{ ...fantasyButtonStyle, padding: "8px 12px" }}>Build profile</button>
          </li>)}
        </ul>}

        {selectedRecord && <section aria-label={`Build profile for ${selectedRecord.name}`} style={{ display: "grid", gap: 12, padding: 16, border: `1px solid ${borderColor}`, borderRadius: 10, background: surface, color: textColor }}>
          <div><h3 style={{ margin: "0 0 4px", fontSize: 17 }}>{selectedRecord.name} · Legend profile</h3><p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>Enter the player’s peak profile. Attributes are generated for the selected positions and overall.</p></div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))" }}>
            {[["age", "Age", 17, 45], ["overall", "Peak overall", 40, 99], ["potential", "Potential", 40, 99], ["heightCm", "Height (cm)", 150, 220], ["salary", "Salary ($/year)", 0, 10000000], ["yearsRemaining", "Contract years", 1, 5]].map(([key, label, min, max]) => <label key={key} style={{ display: "grid", gap: 5, fontSize: 12, color: lightMode ? "#475569" : "#94a3b8" }}>{label}<input type="number" min={min} max={max} value={profile[key]} onChange={(event) => updateProfile(key, event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: surface, color: textColor }} /></label>)}
            <fieldset style={{ gridColumn: "1 / -1", border: `1px solid ${borderColor}`, borderRadius: 8, padding: 10 }}>
              <legend style={{ fontSize: 12 }}>Playing positions</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{FANTASY_POSITIONS.map((position) => <label key={position} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 7px", border: `1px solid ${borderColor}`, borderRadius: 7, fontSize: 12 }}><input type="checkbox" checked={profile.positions.includes(position)} onChange={(event) => updateProfile("positions", event.target.checked ? [...profile.positions, position] : profile.positions.filter((item) => item !== position))} />{position}</label>)}</div>
            </fieldset>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={addSelectedDirectly} style={{ ...fantasyButtonStyle, padding: "9px 14px" }}>Add directly to {manualClub}</button><button type="button" onClick={() => setSelectedRecord(null)} style={{ ...fantasyButtonStyle, padding: "9px 14px" }}>Cancel</button></div>
        </section>}
      </>}
    </section>
  );
}
