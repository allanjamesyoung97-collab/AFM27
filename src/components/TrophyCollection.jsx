import { useState } from "react";
import { TROPHIES, trophyProgress } from "../engine/trophyEngine.js";

const categories = ["ALL TROPHIES", "COACHING", "CLUB HISTORY", "FINALS", "PLAYER DEVELOPMENT"];

function TrophySvg({ trophy, unlocked, size = 30 }) {
  const color = unlocked ? "#fbbf24" : "#2dd4bf";
  const icons = {
    "overtaking-mick": <><path d="M6 35h36M10 35V21l14-9 14 9v14M16 35V24h16v11"/><path d="M7 18 24 7l17 11"/></>,
    "long-haul": <><circle cx="24" cy="24" r="17"/><path d="M24 13v12l8 5M18 4h12"/></>,
    "first-flag": <><path d="M15 5h18v8h7v4c0 5-4 8-10 9a8 8 0 0 1-3 4v5h7v5H14v-5h7v-5a8 8 0 0 1-3-4c-6-1-10-4-10-9v-4h7Z"/><path d="M15 13H9v4c0 3 2 5 6 6M33 13h6v4c0 3-2 5-6 6"/></>,
    "three-peat": <><path d="M10 18h8v5h-8zM20 13h8v10h-8zM30 8h8v15h-8zM8 28h32M24 23v5"/><path d="m16 33 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"/></>,
    dynasty: <><path d="m7 18 8 7 9-13 9 13 8-7-4 21H11Z"/><path d="M12 32h24M17 44h14"/><circle cx="7" cy="14" r="2"/><circle cx="41" cy="14" r="2"/></>,
    "ultimate-record": <><path d="M10 7h20l8 8v27H10zM30 7v9h8M16 23h16M16 29h16M16 35h10"/><path d="m33 26 2 3 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"/></>,
    "finals-fixture": <><rect x="7" y="10" width="34" height="32" rx="4"/><path d="M15 6v9M33 6v9M7 19h34M14 26h5M25 26h5M14 34h5M25 34h5"/></>,
    "september-specialist": <><path d="m24 5 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z"/><path d="m18 24 4 4 8-9"/></>,
    comeback: <><path d="M8 39V9M8 39h33"/><path d="m13 32 8-8 6 4 12-15"/><path d="M31 13h8v8"/></>,
    "break-drought": <><circle cx="24" cy="24" r="17"/><path d="M24 8v32M18 14h12M17 34h14"/><path d="M24 12c-4 0-6 3-6 6s3 5 6 6 6 3 6 6-2 6-6 6"/></>,
    "end-wait": <><path d="M13 7h22M13 41h22M16 8c0 9 5 10 8 16-3 6-8 7-8 16M32 8c0 9-5 10-8 16 3 6 8 7 8 16"/><path d="M19 17h10M19 31h10"/></>,
    "first-club-flag": <><path d="M12 43V6M13 9h23l-6 7 6 7H13"/><path d="m22 15 3 3 5-6"/></>,
    "back-on-top": <><path d="M24 42V9M15 18l9-9 9 9M10 42h28"/><path d="M15 30h18M18 36h12"/></>,
    "perfect-season": <><circle cx="24" cy="24" r="18"/><path d="m14 24 7 7 14-16"/><path d="M15 5h18"/></>,
    "wooden-spoon-to-winners": <><path d="M10 42h28M14 35h20M18 28h12M21 21h6M24 21V7"/><path d="m18 13 6-6 6 6"/></>,
    "defend-crown": <><path d="M24 5 40 11v12c0 10-7 16-16 20C15 39 8 33 8 23V11Z"/><path d="m16 24 5 5 11-12M17 12h14"/></>,
    "home-ground-heroes": <><path d="m5 22 19-15 19 15M10 19v22h28V19M19 41V28h10v13"/><path d="M17 19h14"/></>,
    "local-legend": <><circle cx="24" cy="24" r="17"/><path d="M14 30h20M17 30l-3 9h20l-3-9M24 7l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/></>,
    "club-immortal": <><path d="M8 24c0-8 7-13 14-7l2 2 2-2c7-6 14-1 14 7 0 9-16 18-16 18S8 33 8 24Z"/><path d="M16 24h5l3-6 4 12 3-6h4"/></>,
    "grand-final-glory": <><path d="M12 8h24v9c0 9-5 14-12 14s-12-5-12-14Z"/><path d="M12 12H7v5c0 6 4 9 9 9M36 12h5v5c0 6-4 9-9 9M24 31v8M17 43h14"/><path d="M18 14h12"/></>,
    "three-grand-finals": <><path d="M6 16h10v14H6zM19 10h10v20H19zM32 5h10v25H32z"/><path d="M8 35h32M13 40h22"/></>,
    "big-stage": <><circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4"/><path d="m24 3 3 5-3 4-3-4z"/></>,
    "greatest-comeback": <><path d="M27 4 11 27h11l-2 17 17-25H26Z"/><path d="M7 9h8M5 15h7"/></>,
    "rivalry-renewed": <><path d="M24 4c3 7 10 10 8 18 5-3 7-7 7-7 6 16-2 28-15 28S3 32 11 20c1 4 4 6 6 7-2-9 3-15 7-23Z"/><path d="M24 26c4 4 6 7 4 11-1 2-3 3-5 3-5 0-7-5-4-9z"/></>,
    "four-quarters": <><circle cx="24" cy="24" r="18"/><path d="M24 6v18l13 7M24 24 11 31M24 24l-1 16M24 24l13-7"/><circle cx="24" cy="24" r="3"/></>,
    "september-sweep": <><path d="m9 11 7 7M39 11l-7 7M8 37l8-8M40 37l-8-8M24 5v11"/><path d="M11 23h26M15 29h18M19 35h10"/></>,
    "hard-way": <><path d="M8 41h32M12 34h24M17 27h14M21 20h6M24 20V7"/><path d="m17 13 7-7 7 7M12 34l-5-5M36 34l5-5"/></>,
    recruiter: <><path d="M8 25h21a9 9 0 1 0-9-9M8 25a9 9 0 1 1 9 9"/><path d="M7 20v10M12 20v10M17 20v10M29 25h11"/></>,
    "built-from-within": <><path d="M8 11h13v13H8zM27 11h13v13H27zM8 30h13v13H8zM27 30h13v13H27z"/><path d="m20 17 4 4 5-6M20 36l4 4 5-6"/></>,
    "great-find": <><path d="m24 5 17 19-17 19L7 24Z"/><path d="m24 5 7 19-7 19-7-19zM7 24h34"/><circle cx="24" cy="24" r="4"/></>,
    "rookie-to-star": <><path d="M24 42V22M24 30c-9 0-14-5-14-13 9 0 14 5 14 13ZM24 25c0-9 5-14 14-14 0 9-5 14-14 14Z"/><path d="m24 7 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"/></>,
    "generational-talent": <><path d="m24 4 4 13 14 1-11 8 4 14-11-8-11 8 4-14-11-8 14-1z"/><path d="m6 8 2 3 4 1-3 2 1 4-4-2-3 2 1-4-3-2 4-1z"/></>,
    "club-champion": <><circle cx="24" cy="24" r="7"/><path d="m24 4 4 10-4 3-4-3zM44 24l-10 4-3-4 3-4zM24 44l-4-10 4-3 4 3zM4 24l10-4 3 4-3 4z"/><path d="m10 10 8 5-1 4-5 1zM38 10l-5 8-4-1-1-5zM38 38l-8-5 1-4 5-1zM10 38l5-8 4 1 1 5z"/></>,
    "golden-generation": <><path d="M9 39h30M12 33h24M16 27h16M20 21h8"/><circle cx="15" cy="12" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="33" cy="12" r="3"/><path d="M15 15v9M24 11v8M33 15v9"/></>,
    "draft-masterclass": <><rect x="10" y="7" width="28" height="35" rx="3"/><path d="M18 7V4h12v3M16 16h16M16 23h5M26 23h6M16 31h5M26 31h6M16 37h16"/><path d="m17 23 2 2 3-4M17 31l2 2 3-4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${trophy.title} trophy icon`}>
    <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{icons[trophy.id] ?? <><circle cx="24" cy="24" r="14"/><path d="m17 24 5 5 10-11"/></>}</g>
  </svg>;
}

export default function TrophyCollection({ seasonState = {}, clubName, appearance = "dark", compact = false, trophies: suppliedTrophies = null }) {
  const [category, setCategory] = useState("ALL TROPHIES");
  const light = appearance === "light";
  const palette = {
    text: light ? "#0f172a" : "#f8fafc", muted: light ? "#64748b" : "#94a3b8",
    card: light ? "#ffffff" : "#0f172a", surface: light ? "#f1f5f9" : "#111c30",
    border: light ? "#cbd5e1" : "#334155", gold: "#fbbf24", neon: "#2dd4bf",
  };
  const trophies = suppliedTrophies ?? trophyProgress(seasonState, clubName);
  const earned = trophies.filter(item => item.unlocked).length;
  const shown = category === "ALL TROPHIES" ? trophies : trophies.filter(item => item.category.toUpperCase() === category);
  const buttonStyle = active => ({ border: `1px solid ${active ? "#ea580c" : palette.border}`, borderRadius: 999, padding: "8px 12px", background: active ? "#ea580c" : palette.surface, color: active ? "#fff" : palette.text, fontWeight: 750, cursor: "pointer" });
  return <section aria-label="Trophy collection" style={{ color: palette.text, textAlign: "left", width: "100%" }}>
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <div><h2 style={{ margin: 0 }}>Trophy cabinet</h2><p style={{ margin: "5px 0 0", color: palette.muted }}>{clubName ? `${clubName} career` : "Career achievements"} · {earned} of {TROPHIES.length} unlocked</p></div>
      <div aria-label={`${earned} of ${TROPHIES.length} trophies unlocked`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 150, padding: "9px 12px", border: `1px solid ${palette.border}`, borderRadius: 11, background: palette.surface, color: palette.gold, fontWeight: 800 }}><TrophySvg trophy={{ title: "Trophy cabinet" }} unlocked size={23} />{Math.round(earned / TROPHIES.length * 100)}% complete</div>
    </header>
    <nav aria-label="Trophy categories" style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>{categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} style={buttonStyle(category === item)}>{item}</button>)}</nav>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))", gap: 10 }}>
      {shown.map(trophy => <article key={trophy.id} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr)", gap: 11, alignItems: "start", padding: 13, minHeight: compact ? 102 : 114, border: `1px solid ${trophy.unlocked ? "rgba(251,191,36,.55)" : palette.border}`, borderRadius: 13, background: palette.card, opacity: trophy.unlocked ? 1 : 0.78, boxShadow: trophy.unlocked ? "0 0 18px rgba(251,191,36,.08)" : "none", textAlign: "left" }}>
        <div style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 12, background: trophy.unlocked ? "rgba(251,191,36,.13)" : "rgba(45,212,191,.10)", border: `1px solid ${trophy.unlocked ? "rgba(251,191,36,.48)" : "rgba(45,212,191,.35)"}` }}><TrophySvg trophy={trophy} unlocked={trophy.unlocked} /></div>
        <div style={{ minWidth: 0, textAlign: "left" }}><div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}><h3 style={{ margin: "1px 0 5px", fontSize: 15, textAlign: "left" }}>{trophy.title}</h3><span title={trophy.unlocked ? "Unlocked" : "Locked"} aria-label={trophy.unlocked ? "Unlocked" : "Locked"} style={{ color: trophy.unlocked ? palette.gold : palette.neon, fontSize: 13 }}>{trophy.unlocked ? "◆" : "◇"}</span></div>
          <p style={{ margin: "0 0 8px", color: palette.muted, fontSize: 12.5, lineHeight: 1.45 }}>{trophy.description}</p>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: palette.muted, fontSize: 11, fontWeight: 700 }}><span>{trophy.tier}</span>{Number.isFinite(trophy.target) && <span>{trophy.progress}/{trophy.target}</span>}</div>
          <div role="progressbar" aria-label={`${trophy.title} progress`} aria-valuemin={0} aria-valuemax={trophy.target} aria-valuenow={Math.min(trophy.target, trophy.progress)} style={{ height: 4, marginTop: 6, overflow: "hidden", borderRadius: 99, background: palette.surface }}><div style={{ width: `${trophy.target ? Math.min(100, trophy.progress / trophy.target * 100) : 0}%`, height: "100%", borderRadius: 99, background: trophy.unlocked ? palette.gold : palette.neon }} /></div>
        </div>
      </article>)}
    </div>
  </section>;
}
