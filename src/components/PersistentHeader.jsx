import { useState } from "react";
import ClubBadge from "./ClubBadge.jsx";
import { datesEqual, formatDateForCalendar, getEventTypeInfo } from "../engine/calendarEngine.js";
import { FINALS_WEEK_LABELS } from "../engine/finalsEngine.js";

// Persistent header visible on every screen during career mode.
// From left to right: Club name + logo | Round + Season | Current Date | Continue button
export default function PersistentHeader({
  club,
  seasonState,
  currentDate,
  events = [],
  currentDayEvents = [],
  teamSheetConfirmed = false,
  onContinue,
  onOpenClub,
  onTeamSelectionRequired,
  onAdvanceDay,
  appearance = "dark",
  onContinueCommand,
  processing = false,
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const lightMode = appearance === "light";
  const finalsSeriesTheme = ["WILDCARD", "FINALS"].includes(seasonState?.phase);
  const clubName = typeof club === "string" ? club : club?.name ?? "";
  const clubAbbr = typeof club === "object" ? club?.abbreviation ?? "" : "";

  const phaseLabel = (() => {
    const phase = seasonState?.phase ?? "HOME_AND_AWAY";
    const round = seasonState?.round ?? 1;
    const totalRounds = seasonState?.fixture?.length ?? 23;
    if (phase === "HOME_AND_AWAY") return `Round ${Math.min(round, totalRounds)} of ${totalRounds}`;
    if (phase === "WILDCARD") return "Wildcard Finals";
    if (phase === "FINALS") return FINALS_WEEK_LABELS[seasonState?.finalsWeek ?? 0] ?? "Finals";
    if (phase === "POST_SEASON") return "Post-season";
    return phase;
  })();

  const dateLabel = (() => {
    if (!currentDate) return "";
    const d = currentDate instanceof Date ? currentDate : new Date(currentDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  })();

  const isActiveMatchPhase = ["HOME_AND_AWAY", "WILDCARD", "FINALS"].includes(seasonState?.phase ?? "HOME_AND_AWAY");
  const dueToday = currentDayEvents.find((event) => !event.resolved && (event.type === "MATCH" || (event.mandatory && !event.delegated)));
  const todayMatch = isActiveMatchPhase && dueToday?.type === "MATCH";
  const isMatchEvent = Boolean(todayMatch);
  const needsTeamSelection = isMatchEvent && !teamSheetConfirmed;
  const continueLabel = needsTeamSelection
    ? "Match Day — Team Selection Required"
    : isMatchEvent
      ? "Go to Match"
      : dueToday
        ? `Action Required: ${dueToday.title}`
        : "Progress";
  const isActionRequired = needsTeamSelection || (!isMatchEvent && Boolean(dueToday));

  const baseDate = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const upcomingDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + index);
    return { date, events: events.filter((event) => event.date && datesEqual(event.date, date)) };
  });

  const headerBg = finalsSeriesTheme ? (lightMode ? "#fffaf0" : "#1b170b") : lightMode ? "#ffffff" : "#0f172a";
  const headerBorder = finalsSeriesTheme ? "#9b7b2b" : lightMode ? "#cbd5e1" : "#1e293b";
  const textColor = lightMode ? "#0f172a" : "#f8fafc";
  const mutedColor = lightMode ? "#64748b" : "#94a3b8";

  return (
    <header
      className="persistent-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 20px",
        background: headerBg,
        borderBottom: `1px solid ${headerBorder}`,
        color: textColor,
        fontFamily: "Arial, sans-serif",
        flexWrap: "wrap",
      }}
    >
      {/* Club name and logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <ClubBadge club={clubName} size={32} />
        <div style={{ minWidth: 0 }}>
          <button type="button" onClick={() => onOpenClub?.(clubName)} style={{ border: 0, padding: 0, background: "none", color: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{clubName}</button>
          {clubAbbr && (
            <div style={{ fontSize: 11, color: mutedColor, whiteSpace: "nowrap" }}>
              {clubAbbr} · AFL Manager 27
            </div>
          )}
        </div>
      </div>

      {/* Round and season */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: mutedColor, fontWeight: 700, letterSpacing: 1 }}>
          SEASON {seasonState?.seasonYear ?? 2027}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: finalsSeriesTheme ? "#d6b44a" : textColor, textShadow: finalsSeriesTheme && !lightMode ? "0 0 14px rgba(214,180,74,.22)" : "none" }}>{phaseLabel}</div>
      </div>

      {/* Current date */}
      <div style={{ position: "relative", textAlign: "center" }}>
        <button
          type="button"
          aria-expanded={calendarOpen}
          aria-label={`Open calendar. Current date ${dateLabel}`}
          onClick={() => setCalendarOpen((open) => !open)}
          style={{ border: 0, background: "transparent", color: textColor, cursor: "pointer", textAlign: "center", padding: "3px 8px", borderRadius: 8 }}
        >
          <span style={{ display: "block", fontSize: 11, color: mutedColor, fontWeight: 700, letterSpacing: 1 }}>DATE⌄</span>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{dateLabel}</span>
        </button>
        {calendarOpen && (
          <div style={{ position: "absolute", zIndex: 150, top: "calc(100% + 12px)", right: -24, width: "min(360px, calc(100vw - 24px))", padding: 14, border: `1px solid ${headerBorder}`, borderRadius: 14, background: headerBg, color: textColor, textAlign: "left", boxShadow: "0 14px 36px #0007" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <strong>Calendar</strong>
              <span style={{ color: mutedColor, fontSize: 12 }}>Next 7 days</span>
            </div>
            <div style={{ display: "grid", gap: 5, maxHeight: 300, overflowY: "auto" }}>
              {upcomingDays.map(({ date, events: dayEvents }, index) => (
                <div key={date.toISOString().slice(0, 10)} style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr)", gap: 8, padding: "7px 8px", borderRadius: 8, background: index === 0 ? (lightMode ? "#ffedd5" : "#3b1b0b") : "transparent", border: `1px solid ${index === 0 ? "#ea580c66" : headerBorder}` }}>
                  <strong style={{ fontSize: 12, color: index === 0 ? (lightMode ? "#9a3412" : "#fdba74") : textColor }}>{index === 0 ? "TODAY · " : ""}{date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</strong>
                  <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                    {dayEvents.length ? dayEvents.map((event) => {
                      const info = getEventTypeInfo(event.type);
                      return <span key={event.id} style={{ color: event.resolved ? mutedColor : textColor, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ color: info.color }}>●</span> {event.title}{event.resolved ? " · Done" : ""}</span>;
                    }) : <span style={{ color: mutedColor, fontSize: 12 }}>No scheduled events</span>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { onAdvanceDay?.(); setCalendarOpen(false); }} style={{ width: "100%", marginTop: 12, padding: "10px 12px", border: 0, borderRadius: 9, background: dueToday ? "#dc2626" : "#16a34a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              {dueToday ? (dueToday.type === "MATCH" ? (teamSheetConfirmed ? "Open Match Hub" : "Select Team") : `Open: ${dueToday.title}`) : "Advance one day"}
            </button>
          </div>
        )}
      </div>

      {/* Continue button */}
      <button
        onClick={needsTeamSelection ? onTeamSelectionRequired : onContinue}
        disabled={processing}
        style={{
          padding: "10px 24px",
          border: "none",
          borderRadius: 10,
          background: isActionRequired ? "#dc2626" : finalsSeriesTheme ? "#d6b44a" : "#16a34a",
          color: finalsSeriesTheme && !isActionRequired ? "#211a08" : "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: isActionRequired
            ? "0 4px 12px rgba(220,38,38,0.35)"
            : finalsSeriesTheme ? "0 4px 16px rgba(214,180,74,0.28)" : "0 4px 12px rgba(22,163,74,0.35)",
          transition: "all 0.2s ease",
        }}
      >
        {processing ? "Processing…" : continueLabel}
      </button>
    </header>
  );
}
