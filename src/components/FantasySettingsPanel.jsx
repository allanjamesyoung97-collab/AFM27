import { useEffect, useState } from "react";
import { getSalaryCap } from "../engine/salaryCap.js";
import { fantasyButtonStyle } from "./FantasyPlayerFields.jsx";

const DEFAULT_CAP_SETTINGS = { salaryCapEnabled: true };

export default function FantasySettingsPanel({ seasonState, onSeasonStateChange, lightMode, clubs = [] }) {
  const currentYear = Number(seasonState.seasonYear ?? 2027);
  const settings = {
    ...DEFAULT_CAP_SETTINGS,
    salaryCapAmount: getSalaryCap(currentYear),
    salaryCapSeason: currentYear,
    ...(seasonState.fantasySettings ?? {}),
  };
  const [capDraft, setCapDraft] = useState(String(settings.salaryCapAmount));
  const initialFinanceClub = seasonState.managerClubName ?? clubs[0]?.name ?? "";
  const [financeClub, setFinanceClub] = useState(initialFinanceClub);
  const financeRecord = financeClub === seasonState.managerClubName
    ? seasonState.clubAdministration
    : seasonState.leagueAdministration?.[financeClub];
  const [cashDraft, setCashDraft] = useState(String(financeRecord?.cashBalance ?? 0));
  useEffect(() => setCapDraft(String(settings.salaryCapAmount)), [settings.salaryCapAmount]);
  useEffect(() => setCashDraft(String(financeRecord?.cashBalance ?? 0)), [financeClub, financeRecord?.cashBalance]);
  const surface = lightMode ? "#fff" : "#0f172a";
  const text = lightMode ? "#0f172a" : "#e2e8f0";
  const muted = lightMode ? "#475569" : "#94a3b8";
  const border = lightMode ? "#cbd5e1" : "#334155";

  const updateSettings = (patch) => onSeasonStateChange((previous) => {
    const year = Number(previous.seasonYear ?? 2027);
    const next = {
      salaryCapEnabled: true,
      salaryCapAmount: getSalaryCap(year),
      ...(previous.fantasySettings ?? {}),
      ...patch,
      salaryCapSeason: Object.prototype.hasOwnProperty.call(patch, "salaryCapAmount")
        ? year
        : Number(previous.fantasySettings?.salaryCapSeason ?? year),
    };
    const decorateAdministration = (administration = {}) => ({
      ...administration,
      fantasySalaryCapEnabled: next.salaryCapEnabled,
      fantasySalaryCapAmount: next.salaryCapAmount,
      fantasySalaryCapSeason: next.salaryCapSeason,
    });
    const clubNames = new Set([...clubs.map((club) => typeof club === "string" ? club : club.name), ...Object.keys(previous.leagueAdministration ?? {})]);
    const leagueAdministration = Object.fromEntries([...clubNames].filter(Boolean)
      .map((club) => [club, decorateAdministration(previous.leagueAdministration?.[club] ?? {})]));
    const clubAdministration = decorateAdministration(previous.clubAdministration ?? {});
    if (previous.managerClubName) leagueAdministration[previous.managerClubName] = clubAdministration;
    return { ...previous, fantasySettings: next, clubAdministration, leagueAdministration };
  });

  const applyCapAmount = () => {
    const amount = Math.max(1_000_000, Math.min(500_000_000, Math.round(Number(capDraft) || 0)));
    updateSettings({ salaryCapAmount: amount });
  };

  const applyCashBalance = () => {
    const amount = Math.max(-100_000_000, Math.min(500_000_000, Math.round(Number(cashDraft) || 0)));
    onSeasonStateChange((previous) => {
      const finance = { ...(previous.leagueAdministration?.[financeClub] ?? {}), ...(financeClub === previous.managerClubName ? previous.clubAdministration ?? {} : {}) , cashBalance: amount };
      const leagueAdministration = { ...(previous.leagueAdministration ?? {}), [financeClub]: finance };
      return {
        ...previous,
        leagueAdministration,
        ...(financeClub === previous.managerClubName ? { clubAdministration: finance } : {}),
      };
    });
    setCashDraft(String(amount));
  };

  return <section style={{ display: "grid", gap: 16, maxWidth: 860 }}>
    <header>
      <div style={{ color: "#fb923c", fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>FANTASY CAREER</div>
      <h2 style={{ margin: "6px 0", fontSize: 22, color: text }}>Salary cap rules</h2>
      <p style={{ margin: 0, color: muted, lineHeight: 1.5 }}>Choose whether clubs must stay within a salary cap. This setting applies to every club and is saved with this career.</p>
    </header>

    <article style={{ display: "grid", gap: 14, padding: 16, border: `1px solid ${border}`, borderRadius: 10, background: surface, color: text }}>
      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontWeight: 800 }}>
        <input
          type="checkbox"
          checked={settings.salaryCapEnabled}
          onChange={(event) => updateSettings({ salaryCapEnabled: event.target.checked })}
          aria-label="Enforce salary cap"
        />
        Enforce salary cap
      </label>
      <p style={{ margin: 0, color: muted, fontSize: 13 }}>
        {settings.salaryCapEnabled
          ? "Clubs are checked against the selected cap when signing, trading and drafting players. The cap rises with the league economy each season."
          : "Salary cap restrictions are disabled for every club in this Fantasy Mode career. Player contracts and salaries are still recorded."}
      </p>
      <label style={{ display: "grid", gap: 6, maxWidth: 340, opacity: settings.salaryCapEnabled ? 1 : 0.55 }}>
        <span style={{ fontWeight: 700 }}>Salary cap per club</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>$</span>
          <input
            type="number"
            min="1000000"
            max="500000000"
            step="100000"
            disabled={!settings.salaryCapEnabled}
            value={capDraft}
            onChange={(event) => setCapDraft(event.target.value)}
            aria-label="Fantasy salary cap amount"
            style={{ width: "100%", padding: "9px 10px", border: `1px solid ${border}`, borderRadius: 8, background: surface, color: text }}
          />
        </span>
        <span style={{ color: muted, fontSize: 12 }}>Current standard cap: ${getSalaryCap(currentYear).toLocaleString()} · applies to season {currentYear}</span>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={!settings.salaryCapEnabled} onClick={applyCapAmount} style={{ ...fantasyButtonStyle, padding: "8px 12px", opacity: settings.salaryCapEnabled ? 1 : 0.5 }}>Apply custom cap</button>
        <button type="button" onClick={() => { setCapDraft(String(getSalaryCap(currentYear))); updateSettings({ salaryCapEnabled: true, salaryCapAmount: getSalaryCap(currentYear) }); }} style={{ ...fantasyButtonStyle, padding: "8px 12px" }}>Restore standard cap</button>
      </div>
    </article>

    <article style={{ display: "grid", gap: 14, padding: 16, border: `1px solid ${border}`, borderRadius: 10, background: surface, color: text }}>
      <div>
        <h3 style={{ margin: "0 0 5px", fontSize: 18 }}>Club finances</h3>
        <p style={{ margin: 0, color: muted, lineHeight: 1.5 }}>Set a club’s starting cash balance for this Fantasy Mode career. This changes available cash, not salary-cap room.</p>
      </div>
      <label style={{ display: "grid", gap: 6, maxWidth: 360, fontWeight: 700 }}>
        Club
        <select value={financeClub} onChange={(event) => setFinanceClub(event.target.value)} style={{ padding: "9px 10px", border: `1px solid ${border}`, borderRadius: 8, background: surface, color: text }}>
          {clubs.map((club) => <option key={club.id ?? club.name} value={club.name}>{club.name}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 6, maxWidth: 360, fontWeight: 700 }}>
        Cash balance
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>$</span><input type="number" step="100000" min="-100000000" max="500000000" value={cashDraft} onChange={(event) => setCashDraft(event.target.value)} aria-label="Fantasy club cash balance" style={{ width: "100%", padding: "9px 10px", border: `1px solid ${border}`, borderRadius: 8, background: surface, color: text }} /></span>
      </label>
      <div><button type="button" onClick={applyCashBalance} style={{ ...fantasyButtonStyle, padding: "8px 12px" }}>Apply cash balance</button></div>
    </article>
  </section>;
}
