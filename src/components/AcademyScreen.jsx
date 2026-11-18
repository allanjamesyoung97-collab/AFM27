import { useEffect, useMemo, useState } from "react";
import {
  EMPHASES,
  POSITION_LABELS,
  academySlots,
  academyView,
} from "../engine/academyEngine.js";
import { resolveAppearance } from "./appearance.js";

const ACADEMY_MAX_LEVEL = 5;
const positionText = (positions = []) => POSITION_LABELS[positions[0]] ?? positions.join(" / ");

export default function AcademyScreen({ academy, seasonState, userClub, appearance, onAcademyAction }) {
  const lightMode = resolveAppearance(appearance) === "light";
  const palette = lightMode
    ? { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", muted: "#64748b", soft: "#f1f5f9", accent: "#ea580c", bar: "#dc2626", track: "#e2e8f0", strong: "#0f172a", strongText: "#ffffff" }
    : { card: "#0f172a", border: "#334155", text: "#f8fafc", muted: "#94a3b8", soft: "#1e293b", accent: "#ea580c", bar: "#ef4444", track: "#334155", strong: "#f8fafc", strongText: "#0f172a" };
  const [message, setMessage] = useState({ text: "", error: false });
  const [section, setSection] = useState("PLAYERS");

  // Older saves have no academy yet; set one up the first time the tab opens.
  useEffect(() => { if (!academy) onAcademyAction?.({ type: "INIT" }); }, [academy, onAcademyAction]);

  const administration = seasonState?.clubAdministration;
  const view = useMemo(() => academyView(academy, administration), [academy, administration]);
  const run = (action, success) => {
    const error = onAcademyAction?.(action);
    setMessage(error ? { text: error, error: true } : { text: success ?? "", error: false });
  };

  const cardStyle = { border: `1px solid ${palette.border}`, borderRadius: 14, background: palette.card, color: palette.text, padding: 18, marginBottom: 16 };
  const label = { color: palette.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase" };
  const smallButton = (active = false, disabled = false) => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    border: `1px solid ${active ? palette.strong : palette.border}`, background: active ? palette.strong : palette.soft, color: active ? palette.strongText : palette.text,
  });

  if (!academy) return <div style={{ ...cardStyle, color: palette.muted }}>Setting up the academy…</div>;

  const club = userClub?.name ?? academy.clubName;
  const coach = academy.coach;
  const nextBand = view.bands.find((band) => band.draftYear === academy.nextDraftYear) ?? null;
  const draftBound = nextBand ? nextBand.players.filter((player) => player.read.centre >= 62) : [];
  const outlook = view.outlook;

  return (
    <section aria-label="Academy" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <div style={cardStyle}>
          <div style={label}>{academy.academyType === "NORTHERN" ? "Northern Academy" : "Next Generation Academy"} · {club}</div>
          <h2 style={{ margin: "6px 0 8px" }}>The Backroom</h2>
          <p style={{ margin: 0, color: palette.muted, fontSize: 14, lineHeight: 1.5 }}>
            Local juniors join {club} as 15 year olds. In their draft year, eligible graduates are tied to {club} in the national draft: rival clubs can bid on them, and you can match with a later pick.
            {nextBand
              ? ` ${draftBound.length} of your ${nextBand.draftYear} group currently read as draftable.`
              : view.bands[0] ? ` There is no draft-year group yet: your first academy draft class arrives in ${view.bands[0].draftYear}.` : ""}
          </p>
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        {[ ["PLAYERS", "Academy Players"], ["PRIORITISED", "Prioritised Players"], ["BACKROOM", "The Backroom"] ].map(([key, title]) => <button key={key} type="button" onClick={() => setSection(key)} style={smallButton(section === key)}>{title}</button>)}
      </div>

      {section === "PLAYERS" && <div style={{ gridColumn: "1 / -1" }}>
        {view.bands.map((band) => (
          <div key={band.draftYear} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <strong style={{ letterSpacing: 1.2, fontSize: 13 }}>{band.draftYear === academy.nextDraftYear ? `DRAFT YEAR · ${band.age} year olds` : `${band.age} year olds`}</strong>
              <span style={label}>{band.players.length} players{band.draftYear === academy.nextDraftYear ? `, ${band.goingOn} of ${band.projected} going on` : ""}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>{["Player", "Now", "Potential", ""].map((heading) => <th key={heading || "action"} style={{ ...label, padding: "8px 8px 10px", borderBottom: `1px solid ${palette.border}`, fontWeight: 800 }}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {band.players.map((player) => {
                    const focusDisabled = !player.focus && view.focusUsed >= view.focusSlots;
                    return (
                      <tr key={player.id} style={{ borderBottom: `1px solid ${palette.border}` }}>
                        <td style={{ padding: "11px 8px" }}>
                          <div style={{ fontWeight: 800 }}>{player.name}</div>
                          <div style={{ color: palette.muted, fontSize: 13 }}>{positionText(player.positions)}</div>
                          <div style={{ color: palette.muted, fontSize: 12 }}>{player.juniorClub}</div>
                        </td>
                        <td style={{ padding: "11px 8px", width: 150 }}>
                          <div role="img" aria-label={`Current level ${Math.round(player.ability)}`} style={{ height: 8, borderRadius: 4, background: palette.track, overflow: "hidden" }}>
                            <div style={{ width: `${clampPercent((player.ability - 25) / 0.7)}%`, height: "100%", background: palette.bar }} />
                          </div>
                        </td>
                        <td style={{ padding: "11px 8px" }}>
                          <div style={{ fontWeight: 600 }}>{player.read.low} to {player.read.high}</div>
                          <div style={{ color: palette.muted, fontSize: 12 }}>{player.read.label}</div>
                        </td>
                        <td style={{ padding: "11px 8px", textAlign: "right" }}>
                          <button type="button" aria-pressed={player.focus} disabled={focusDisabled}
                            onClick={() => run({ type: "TOGGLE_FOCUS", playerId: player.id }, player.focus ? "" : `${player.name} is now a focus player.`)}
                            style={smallButton(player.focus, focusDisabled)}>{player.focus ? "Prioritised" : "Prioritise"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>}

      {section === "PRIORITISED" && <div style={{ gridColumn: "1 / -1" }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Prioritised players</h3>
          {academy.players.filter((player) => player.focus).length === 0 && <p style={{ color: palette.muted }}>Prioritise academy players to assign individual programs here.</p>}
          {academy.players.filter((player) => player.focus).map((player) => <div key={player.id} style={{ padding: "12px 0", borderTop: `1px solid ${palette.border}`, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12 }}>
            <div><strong>{player.name}</strong><div style={{ color: palette.muted, fontSize: 12 }}>{player.draftYear} draft · {player.juniorClub}</div></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>Program <select value={player.trainingCategory ?? "BALANCED"} onChange={(event) => run({ type: "SET_PLAYER_PROGRAM", playerId: player.id, category: event.target.value })} style={{ padding: 8, borderRadius: 8, background: palette.soft, color: palette.text, border: `1px solid ${palette.border}` }}>{Object.entries(EMPHASES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
            <div style={{ gridColumn: "1 / -1", color: palette.muted, fontSize: 12 }}>{player.firstTeamSessions > 0 ? `${player.firstTeamSessions} first-team sessions remain; faster growth, with a small overload setback risk.` : ""}</div>
            <button type="button" onClick={() => run({ type: "FIRST_TEAM_BLOCK", playerId: player.id }, "Six first-team sessions have been scheduled.")} style={smallButton(false, player.firstTeamSessions > 0)} disabled={player.firstTeamSessions > 0}>Train with first team · 6 sessions</button>
          </div>)}
        </div>
      </div>}

      {section === "BACKROOM" && <div style={{ gridColumn: "1 / -1" }}>
        <div style={cardStyle}>
          <div style={{ ...label, marginBottom: 14 }}>The Backroom</div>
          {message.text && <div role={message.error ? "alert" : "status"} style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, fontSize: 13, background: palette.soft, color: message.error ? "#ef4444" : palette.text }}>{message.text}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
            <div><div style={label}>Academy level</div><div style={{ fontWeight: 800, marginTop: 4 }}>{academy.level} of {ACADEMY_MAX_LEVEL}</div></div>
            <div><div style={label}>Prioritised players</div><div style={{ fontWeight: 800, marginTop: 4 }}>{view.focusUsed} of {academySlots(academy.level)}</div></div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={label}>Overall Training Focus</span>
            <div role="group" aria-label="Academy emphasis" style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${palette.border}`, background: palette.soft }}>
              {Object.entries(EMPHASES).map(([key, item]) => <button key={key} type="button" aria-pressed={academy.emphasis === key} onClick={() => run({ type: "SET_EMPHASIS", emphasis: key })} style={smallButton(academy.emphasis === key)}>{item.label}</button>)}
            </div>
          </div>
          <p style={{ margin: "0 0 18px", color: palette.muted, fontSize: 13, lineHeight: 1.5 }}>{EMPHASES[academy.emphasis]?.note}</p>

        </div>

        {outlook && <div style={cardStyle}>
          <div style={{ ...label, marginBottom: 10 }}>What shapes the academy</div>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>Quality of juniors: <strong>{outlook.label}</strong></p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, display: "grid", gap: 4, fontSize: 13, color: palette.muted }}>
            <li>Recruiting facilities: level {outlook.recruitingLevel} of 5</li>
            <li>List Manager: rated {Math.round(outlook.listManager)}</li>
            <li>Academy level: {academy.level} of {ACADEMY_MAX_LEVEL}</li>
            <li>Academy coach: {coach?.specialty ?? "No specialty recorded"} · rated {Math.min(100, Math.round(coach?.rating > 20 ? coach.rating : (coach?.rating ?? 0) * 5))} of 100</li>
          </ul>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>Growth: <strong>{outlook.developmentMultiplier >= 1 ? "+" : ""}{Math.round((outlook.developmentMultiplier - 1) * 100)}%</strong> from your club's training facilities and development staff</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20, display: "grid", gap: 4, fontSize: 13, color: palette.muted }}>
            <li>Training facilities: level {outlook.trainingLevel} of 5</li>
            <li>Development coaches and the Head of Development lift or drag this</li>
          </ul>
          <p style={{ margin: 0, color: palette.muted, fontSize: 12, lineHeight: 1.5 }}>Better recruiting facilities, a better List Manager, a higher academy level and a stronger coach bring in better juniors each year. Training facilities and development staff speed growth and bring players closer to their ceiling by draft day. Draft scouting accuracy ({Math.round(outlook.scoutingAccuracy * 100)}%) sharpens the ceiling read.</p>
        </div>}

        <div style={cardStyle}>
          <div style={{ ...label, marginBottom: 10 }}>Academy history</div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 14 }}>
            {academy.history.map((entry, index) => <li key={`${entry.year}-${index}`}>{entry.year}: {entry.text}</li>)}
          </ul>
        </div>
      </div>}
    </section>
  );
}

function clampPercent(value) { return Math.max(4, Math.min(100, value)); }
