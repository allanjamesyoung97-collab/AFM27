import { useState, useEffect } from "react";
import {
  datesEqual,
  formatDateForCalendar,
  getNextEvent,
  isMandatoryStop,
  getScreenForEvent,
  getEventTypeInfo,
} from "../engine/calendarEngine.js";
import { defaultDelegationSettings, trainingCategories } from "../data/trainingCategories.js";
import ClubBadge from "./ClubBadge.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_TYPES = {
  MATCH: "Match",
  TRAINING: "Training",
  CONTRACT: "Contract",
  TRADE: "Trade",
  DRAFT: "Draft",
  CLUB_EVENT: "Club Event",
};

export default function CalendarScreen({
  club,
  appearance = "dark",
  seasonState,
  events = [],
  currentDate,
  delegationSettings = defaultDelegationSettings,
  onEventClick,
  onContinue,
  nextEvent,
  assistantManagedTraining = true,
  userTrainingSchedule = [],
  onScheduleTraining,
  navigationTab = null,
  navigationSequence = 0,
}) {
  const selectedClubName = typeof club === "string" ? club : club?.name ?? "";
  const lightMode = appearance === "light";

  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc",
    muted: lightMode ? "#64748b" : "#94a3b8",
    card: lightMode ? "#ffffff" : "#0f172a",
    surface: lightMode ? "#f1f5f9" : "#1e293b",
    border: lightMode ? "#cbd5e1" : "#334155",
    accent: "#ea580c",
  };

  const today = currentDate instanceof Date ? currentDate : new Date(currentDate ?? Date.now());
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarView, setCalendarView] = useState("WEEK");
  const [trainingCategoryId, setTrainingCategoryId] = useState("SKILLS");
  useEffect(() => { if (navigationTab) setCalendarView(navigationTab); }, [navigationSequence, navigationTab]);

  useEffect(() => {
    setSelectedDate(new Date(today));
  }, [currentDate]);

  const weekStart = new Date(selectedDate);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const gridStart = new Date(weekStart);
  if (calendarView === "MONTH") { gridStart.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), 1); gridStart.setDate(1 - gridStart.getDay()); }
  if (calendarView === "DAY") gridStart.setTime(selectedDate.getTime());
  const calendarCells = Array.from({ length: calendarView === "MONTH" ? 42 : calendarView === "DAY" ? 1 : 7 }, (_, index) => {
    const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date;
  });
  const weekLabel = calendarView === "MONTH" ? selectedDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" }) : `${calendarCells[0].toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${calendarCells[calendarCells.length - 1].toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;

  function shiftWeek(amount) {
    const nextDate = new Date(selectedDate);
    if (calendarView === "MONTH") { nextDate.setDate(1); nextDate.setMonth(nextDate.getMonth() + amount); } else nextDate.setDate(nextDate.getDate() + amount * (calendarView === "DAY" ? 1 : 7));
    setSelectedDate(nextDate);
  }

  function jumpToToday() {
    setSelectedDate(today);
  }

  function jumpToNextEvent() {
    if (!nextEvent?.date) return;
    const d = nextEvent.date instanceof Date ? nextEvent.date : new Date(nextEvent.date);
    setSelectedDate(d);
    onEventClick?.(nextEvent);
  }

  function getEventsForDate(date) {
    return events.filter((e) => e.date && datesEqual(e.date, date));
  }

  function hasUnresolvedEvents(date) {
    return getEventsForDate(date).some((e) => !e.resolved);
  }

  function isToday(date) {
    return datesEqual(date, today);
  }

  function isSelected(date) {
    return datesEqual(date, selectedDate);
  }

  const cardStyle = {
    color: palette.text,
    background: palette.card,
    padding: 18,
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
  };

  function handleEventClick(event) {
    if (onEventClick) {
      onEventClick(event);
    }
  }

  const nextEventInfo = nextEvent ? getEventTypeInfo(nextEvent.type) : null;
  const nextEventIsMandatory = nextEvent ? isMandatoryStop(nextEvent, delegationSettings) : false;

  return (
    <div style={{ color: palette.text, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ ...{ color: palette.muted }, fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>
            SEASON HUB
          </div>
          <h2 style={{ margin: "4px 0 0" }}>Calendar</h2>
        </div>
      </div>

      {/* Next Event Banner */}
      {nextEvent && (
        <section
          style={{
            ...cardStyle,
            marginBottom: 16,
            borderLeft: `4px solid ${nextEventInfo?.color ?? palette.accent}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1,
                  background: nextEventInfo?.bgColor,
                  color: nextEventInfo?.color,
                }}
              >
                {nextEventInfo?.label?.toUpperCase()}
              </div>
              <h3 style={{ margin: "6px 0 2px" }}>{nextEvent.title}</h3>
              <div style={{ color: palette.muted, fontSize: 13 }}>
                {formatDateForCalendar(nextEvent.date)} · {nextEvent.description}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {nextEventIsMandatory ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>
                  ACTION REQUIRED
                </div>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6ee7b7" }}>
                  AUTO-RESOLVED
                </div>
              )}
              {nextEvent.type === "MATCH" && (
                <div style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>
                  Match day cannot be delegated
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Event Types key */}
      <div role="group" aria-label="Event types" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", margin: "0 0 12px", padding: "8px 12px", borderRadius: 10, background: palette.card, border: `1px solid ${palette.border}` }}>
        <strong style={{ color: palette.muted, fontSize: 11, letterSpacing: 1 }}>EVENT TYPES</strong>
        {Object.entries(EVENT_TYPES).map(([type, label]) => {
          const info = getEventTypeInfo(type);
          return <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, whiteSpace: "nowrap" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: info.color }} />
            <span>{label}</span>
          </div>;
        })}
      </div>

      {/* Week Calendar */}
      <div>
        <section style={cardStyle}>
          {/* Week navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button
              onClick={() => shiftWeek(-1)}
              style={{
                padding: "8px 14px",
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                background: palette.surface,
                color: palette.text,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ◀
            </button>
            <h3 style={{ margin: 0 }}>{weekLabel}</h3>
            <button
              onClick={() => shiftWeek(1)}
              style={{
                padding: "8px 14px",
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                background: palette.surface,
                color: palette.text,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ▶
            </button>
          </div>

          {/* Quick jump buttons */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button
              onClick={jumpToToday}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                border: `1px solid ${palette.border}`,
                borderRadius: 6,
                background: palette.surface,
                color: palette.text,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Today
            </button>
            <button
              onClick={jumpToNextEvent}
              disabled={!nextEvent}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                border: `1px solid ${palette.border}`,
                borderRadius: 6,
                background: nextEvent ? palette.accent : palette.surface,
                color: nextEvent ? "#fff" : palette.muted,
                cursor: nextEvent ? "pointer" : "default",
                fontWeight: 600,
              }}
            >
              View Next Event
            </button>
          </div>

          {!assistantManagedTraining && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 8, marginBottom: 14, padding: 10, borderRadius: 9, background: palette.surface }}>
              <label style={{ display: "grid", gap: 4, color: palette.muted, fontSize: 12, fontWeight: 700 }}>
                Schedule training for {selectedDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                <select value={trainingCategoryId} onChange={(event) => setTrainingCategoryId(event.target.value)} style={{ padding: "7px 9px", borderRadius: 7, border: `1px solid ${palette.border}`, color: palette.text, background: palette.card }}>
                  {trainingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={selectedDate < today || getEventsForDate(selectedDate).some((event) => event.type === "MATCH")}
                onClick={() => onScheduleTraining?.({ date: new Date(selectedDate), categoryId: trainingCategoryId })}
                style={{ padding: "8px 12px", border: 0, borderRadius: 8, color: "#fff", background: palette.accent, fontWeight: 700, cursor: "pointer" }}
              >
                Schedule session
              </button>
            </div>
          )}

          <nav aria-label="Calendar view" style={{ display: "flex", gap: 6, margin: "10px 0" }}>{["DAY", "WEEK", "MONTH", "FIXTURES"].map(view => <button key={view} type="button" aria-pressed={view === calendarView} onClick={() => setCalendarView(view)} style={{ border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer", background: view === calendarView ? palette.accent : palette.surface, color: palette.text }}>{view === "DAY" ? "Daily" : view === "WEEK" ? "Weekly" : view === "MONTH" ? "Monthly" : "Fixtures"}</button>)}</nav>
          {calendarView === "FIXTURES" && <div style={{ display: "grid", gap: 6 }}>{events.filter(e => e.type === "MATCH").map(event => <button key={event.id} type="button" onClick={() => onEventClick?.(event)} style={{ padding: 12, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.surface, color: palette.text, textAlign: "left", cursor: "pointer" }}>{formatDateForCalendar(event.date)} · {event.title} · {event.resolved ? "Played — view results" : "Upcoming"}</button>)}</div>}
          {/* Weekday headers */}
          <div style={{ display: ["DAY", "FIXTURES"].includes(calendarView) ? "none" : "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: palette.muted,
                  padding: "6px 0",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Week cells */}
          <div style={{ display: calendarView === "FIXTURES" ? "none" : "grid", gridTemplateColumns: calendarView === "DAY" ? "1fr" : "repeat(7, minmax(0, 1fr))", gap: 6 }}>
            {calendarCells.map((date) => {
              const dayEvents = getEventsForDate(date);
              const todayFlag = isToday(date);

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    minHeight: 110,
                    padding: 7,
                    borderRadius: 8,
                    border: isSelected(date)
                      ? `2px solid ${palette.accent}`
                      : todayFlag
                        ? `1px solid ${palette.accent}66`
                        : `1px solid ${palette.border}`,
                    background: todayFlag
                      ? lightMode ? "#fff7ed" : "#1c1208"
                      : isSelected(date)
                        ? lightMode ? "#f0f4ff" : "#0c1525"
                        : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: todayFlag ? 800 : 600,
                      color: todayFlag ? palette.accent : palette.text,
                      marginBottom: 2,
                    }}
                  >
                    {date.getDate()}
                  </div>
                  {dayEvents.slice(0, 3).map((event) => {
                    const info = getEventTypeInfo(event.type);
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 4px",
                          marginBottom: 2,
                          borderRadius: 4,
                          background: info.bgColor,
                          color: info.color,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: "pointer",
                        }}
                      >
                        {event.resolved ? "✓ " : ""}
                        {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: palette.muted, paddingLeft: 4 }}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
