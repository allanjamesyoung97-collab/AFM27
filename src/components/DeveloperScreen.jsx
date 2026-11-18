import { useEffect, useState } from "react";

const DESTINATIONS = [
  ["FIRST_GAME", "First Game of the Season", "Simulate the offseason and preseason, then stop before your club's first scheduled match."],
  ["FINALS", "Finals", "Simulate the regular season and wildcard round, then stop before the first final."],
  ["DRAFT", "National Draft", "Advance to the next national draft date."],
  ["BROWNLOW", "Brownlow Count", "Simulate to the day after the preliminary final and open the vote count."],
  ["GRAND_FINAL", "Grand Final", "Simulate to the Grand Final date and stop before the match."],
  ["TRADE", "Trade Period", "Advance to the next trade period opening day."],
];

export default function DeveloperScreen({ editor, initialTab = null, navigationSequence = 0, seasonState, appearance = "dark", onSkip }) {
  const [tab, setTab] = useState(initialTab === "SKIP" ? "SKIP" : "EDITOR");
  const [busyTarget, setBusyTarget] = useState("");
  const [message, setMessage] = useState("");
  const light = appearance === "light";
  const palette = {
    text: light ? "#0f172a" : "#f8fafc",
    muted: light ? "#64748b" : "#94a3b8",
    card: light ? "#fff" : "#0f172a",
    surface: light ? "#f1f5f9" : "#111c30",
    border: light ? "#cbd5e1" : "#334155",
  };
  useEffect(() => {
    setTab(initialTab === "SKIP" ? "SKIP" : "EDITOR");
  }, [navigationSequence, initialTab]);
  const buttonStyle = active => ({
    padding: "10px 14px", borderRadius: 9, border: `1px solid ${active ? "#ea580c" : palette.border}`,
    background: active ? "#ea580c" : palette.surface, color: palette.text, fontWeight: 800, cursor: "pointer",
  });
  const skip = async target => {
    if (busyTarget) return;
    setBusyTarget(target);
    setMessage("");
    try {
      const result = await onSkip?.(target);
      if (result?.ok) setMessage(`Advanced to ${result.date}.`);
      else setMessage(result?.error ?? "Could not advance the calendar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not advance the calendar.");
    } finally {
      setBusyTarget("");
    }
  };

  if (tab === "EDITOR") {
    return <main style={{ color: palette.text }}>
      <nav aria-label="Developer sections" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button type="button" style={buttonStyle(true)} aria-current="page">Player Attribute Editor</button>
        <button type="button" style={buttonStyle(false)} onClick={() => setTab("SKIP")}>Skip to</button>
      </nav>
      {editor}
    </main>;
  }

  return <main style={{ display: "grid", gap: 14, color: palette.text }}>
    <nav aria-label="Developer sections" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={buttonStyle(false)} onClick={() => setTab("EDITOR")}>Player Attribute Editor</button>
      <button type="button" style={buttonStyle(true)} aria-current="page">Skip to</button>
    </nav>
    <header>
      <h2 style={{ margin: "4px 0" }}>Skip to a game event</h2>
      <p style={{ color: palette.muted, margin: 0 }}>Current date: {seasonState?.calendarClock?.date ?? "—"}. Matches are simulated in the background; the calendar stops at the selected event.</p>
    </header>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
      {DESTINATIONS.map(([id, title, detail]) => <article key={id} style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
        <div><h3 style={{ margin: "0 0 6px" }}>{title}</h3><p style={{ margin: 0, color: palette.muted, lineHeight: 1.45 }}>{detail}</p></div>
        <button type="button" disabled={Boolean(busyTarget)} onClick={() => skip(id)} style={{ ...buttonStyle(false), justifySelf: "start", opacity: busyTarget ? 0.65 : 1 }}>
          {busyTarget === id ? "Advancing…" : `Skip to ${title}`}
        </button>
      </article>)}
    </section>
    {message && <p role="status" style={{ color: palette.muted, margin: 0 }}>{message}</p>}
  </main>;
}
