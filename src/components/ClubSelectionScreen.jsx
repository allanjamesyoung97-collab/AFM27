import { useState } from "react";
import { clubs, tasmaniaDevils } from "../data/clubs.js";
import { getClubStrengthProfile } from "../engine/clubStrengthEngine.js";
import { createInitialLeaguePlayerContracts } from "../engine/clubAdministrationEngine.js";
import { getSalaryCap } from "../engine/salaryCap.js";
import ClubBadge from "./ClubBadge.jsx";
import { CAREER_STARTS, TASMANIA_CAREER } from "../engine/careerStartEngine.js";

export default function ClubSelectionScreen({
 onSelect,
 onBack,
 appearance = "dark",
 textSize = "STANDARD",
 players = [],
 gameMode = "CLASSIC",
}) {
 const lightMode = appearance === "light";
 const baseFontSize = textSize === "LARGE" ? 18 : textSize === "EXTRA_LARGE" ? 20 : 16;
 const [selectedClubId, setSelectedClubId] = useState(null);
 const [careerStart, setCareerStart] = useState("AFTER_GF");
 const selectedClub = [...clubs, tasmaniaDevils].find((club) => club.id === selectedClubId);
 const tasmaniaSelected = selectedClub?.id === tasmaniaDevils.id;
 const tasmaniaAvailable = gameMode === "CLASSIC";
 const sortedClubs = [...clubs].sort((a, b) => a.name.localeCompare(b.name));
 const initialContracts = createInitialLeaguePlayerContracts(players, clubs, 2027);
 const salaryCap = getSalaryCap(2027);
 const strengthProfileFor = (club) => getClubStrengthProfile(players.filter((player) => player.club === club.name));
 const capRoomFor = (club) => {
 const committed = players
 .filter((player) => player.club === club.name)
 .reduce((sum, player) => sum + Number(initialContracts[String(player.id)]?.salary ?? 0), 0);
 return salaryCap - committed;
 };
 const capOutlookFor = (capRoom) => {
 if (capRoom < 0) return "Over cap";
 if (capRoom < salaryCap * 0.05) return "Tight cap";
 if (capRoom > salaryCap * 0.15) return "Healthy cap room";
 return "Balanced cap";
 };
 const formatMillions = (amount) => `${Number(amount ?? 0) < 0 ? "−" : ""}$${(Math.abs(Number(amount ?? 0)) / 1_000_000).toFixed(1)}m`;

 return (
 <main
 style={{
 minHeight: "100vh",
 padding: "clamp(24px, 5vw, 64px)",
 paddingBottom: 170,
 color: lightMode ? "#0f172a" : "#f8fafc",
 fontSize: baseFontSize,
 background: lightMode
 ? "radial-gradient(ellipse at top, #ffffff 0%, #e2e8f0 68%)"
 : "radial-gradient(ellipse at top, #172554 0%, #020617 58%)",
 fontFamily: "Arial, sans-serif"
 }}
 >
 <div style={{ maxWidth: 1240, margin: "0 auto" }}>
 {onBack && (
 <button
 type="button"
 onClick={onBack}
 style={{
 marginBottom: 24,
 padding: "9px 12px",
 border: "1px solid #334155",
 borderRadius: 9,
 color: lightMode ? "#334155" : "#cbd5e1",
 background: lightMode ? "#ffffff" : "#0f172a",
 cursor: "pointer",
 }}
 >
 ← Back to game modes
 </button>
 )}
 <div style={{ color: "#fb923c", fontSize: 12, letterSpacing: 4, fontWeight: 800 }}>
 AFL MANAGER 27
 </div>
 <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.05 }}>
 Choose your club
 </h1>
 <p style={{ color: lightMode ? "#475569" : "#94a3b8", maxWidth: 640, margin: "0 0 28px", fontSize: 16 }}>
 {gameMode === "CLUB_RESET"
 ? "Choose the club you will manage through a league-wide player draft. Every club starts with an empty list, and each selection must fit its salary cap and position minimums."
 : "Take charge of one of the 18 AFL clubs and build your path to a premiership. Squad ratings are calculated from each club’s players, with best-team line averages, list depth, age profile and salary-cap room to help you compare the challenge."}
 </p>

 <fieldset disabled={tasmaniaSelected} style={{ border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 14, padding: 16, margin: "0 0 24px", background: lightMode ? "#fff" : "#0f172a", opacity: tasmaniaSelected ? 0.5 : 1 }}>
 <legend style={{ padding: "0 8px", fontWeight: 800 }}>When do you want to start?{tasmaniaSelected ? " (Tasmania uses its own start)" : ""}</legend>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
 {Object.entries(CAREER_STARTS).map(([key, option]) => <label key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", border: `1px solid ${careerStart === key ? "#ea580c" : lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 10, background: careerStart === key ? (lightMode ? "#fff7ed" : "#431407") : "transparent", cursor: "pointer" }}>
 <input type="radio" name="career-start" value={key} checked={careerStart === key} onChange={() => setCareerStart(key)} style={{ accentColor: "#ea580c" }} />
 <span><strong>{option.label}</strong><small style={{ display: "block", color: lightMode ? "#475569" : "#94a3b8" }}>{key === "AFTER_GF" ? "1 Oct 2026 · trade period and draft ahead" : "1 Feb 2027 · ready for preseason"}</small></span>
 </label>)}
 </div>
 </fieldset>

 <div
 role="radiogroup"
 aria-label="Choose an AFL club"
 style={{
 display: "grid",
 gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
 gap: 12
 }}
 >
 {sortedClubs.map((club) => {
 const selected = club.id === selectedClubId;
 const profile = strengthProfileFor(club);
 const capRoom = capRoomFor(club);
 const capOutlook = capOutlookFor(capRoom);
 const capColor = capRoom < 0 ? "#f87171" : capRoom < salaryCap * 0.05 ? "#fbbf24" : "#34d399";
 return (
 <article
 key={club.id}
 style={{
 display: "flex",
 position: "relative",
 alignItems: "flex-start",
 gap: 14,
 minHeight: 188,
 padding: 13,
 color: lightMode ? "#0f172a" : "#f8fafc",
 background: lightMode
 ? (selected ? "#fff7ed" : "#ffffff")
 : (selected ? "#172554" : "rgba(15, 23, 42, 0.88)"),
 border: `1px solid ${selected ? "#f97316" : (lightMode ? "#cbd5e1" : "#263449")}`,
 borderRadius: 16,
 boxShadow: selected ? "0 0 0 2px #f9731633, 0 12px 30px #0005" : "none"
 }}
 >
 <ClubBadge club={club.name} size={40} />
 <span style={{ flex: 1, minWidth: 0, paddingTop: 23 }}>
 <strong style={{ display: "block", fontSize: 17 }}>{club.name}</strong>
 {gameMode === "CLUB_RESET" ? <>
 <span style={{ display: "block", marginTop: 10, color: "#fb923c", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>EMPTY LIST · LEAGUE DRAFT</span>
 <span style={{ display: "block", marginTop: 5, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 11 }}>Every club starts with the same draft and salary-cap rules.</span>
 </> : <>
 <span style={{ display: "block", color: lightMode ? "#64748b" : "#94a3b8", marginTop: 5, fontSize: 11, letterSpacing: 0.6 }}>BEST 23 · AVG OVR <b style={{ color: lightMode ? "#0f172a" : "#f8fafc" }}>{profile.bestTeamOverall ?? "—"}</b></span>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(32px, 1fr))", gap: 4, marginTop: 11 }}>
 {[["DEF", profile.def], ["MID", profile.mid], ["FWD", profile.fwd], ["RUC", profile.ruc]].map(([label, value]) => <span key={label} style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 10 }}>{label}<b style={{ display: "block", fontSize: 14, color: lightMode ? "#0f172a" : "#f8fafc", marginTop: 2 }}>{value ?? "—"}</b></span>)}
 </div>
 <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 5, marginTop: 11, paddingTop: 8, borderTop: `1px solid ${lightMode ? "#e2e8f0" : "#263449"}`, fontSize: 11 }}>
 <span style={{ color: lightMode ? "#64748b" : "#94a3b8" }}>Squad Avg Ovr: <b style={{ color: lightMode ? "#0f172a" : "#f8fafc" }}>{profile.squadOverall ?? "—"}</b></span>
 <span title={`Projected 2027 salary cap: ${formatMillions(salaryCap)} less current player contract commitments`} style={{ color: capColor }}>{capOutlook} · {formatMillions(Math.abs(capRoom))}{capRoom < 0 ? " above cap" : " cap room"}</span>
 </div>
 <span style={{ display: "block", width: "100%", textAlign: "left", color: lightMode ? "#64748b" : "#94a3b8", marginTop: 5, fontSize: 10 }}>Squad Avg Age: <b style={{ color: lightMode ? "#0f172a" : "#f8fafc" }}>{profile.squadAge ?? "—"}</b></span>
 </>}
 </span>
 <button
 type="button"
 role="radio"
 aria-checked={selected}
 onClick={() => setSelectedClubId(club.id)}
 style={{
 position: "absolute",
 right: 10,
 bottom: 10,
 minWidth: 0,
 padding: "6px 8px",
 border: `1px solid ${selected ? "#fb923c" : "#475569"}`,
 borderRadius: 9,
 color: "white",
 background: selected ? "#ea580c" : "#1e293b",
 fontWeight: 700,
 cursor: "pointer"
 }}
 >
 {selected ? "Selected" : "Select"}
 </button>
 </article>
 );
 })}
 </div>

 {tasmaniaAvailable && (
 <section
 aria-label="Expansion club"
 style={{
 marginTop: 28,
 padding: 18,
 borderRadius: 16,
 border: `1px solid ${tasmaniaSelected ? "#f97316" : (lightMode ? "#cbd5e1" : "#263449")}`,
 background: lightMode ? (tasmaniaSelected ? "#fff7ed" : "#ffffff") : (tasmaniaSelected ? "#172554" : "rgba(15, 23, 42, 0.88)"),
 boxShadow: tasmaniaSelected ? "0 0 0 2px #f9731633, 0 12px 30px #0005" : "none",
 }}
 >
 <div style={{ color: "#fb923c", fontSize: 12, letterSpacing: 3, fontWeight: 800 }}>EXPANSION CAREER</div>
 <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 10 }}>
 <ClubBadge club={tasmaniaDevils.name} size={52} />
 <div style={{ flex: "1 1 320px", minWidth: 0 }}>
 <strong style={{ display: "block", fontSize: 20 }}>Tasmania</strong>
 <span style={{ display: "block", marginTop: 6, color: lightMode ? "#475569" : "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
 Build the 19th AFL club from nothing. The 2026 draft and trade period and the 2027 season are simulated for the 18 existing clubs while Tasmania has no list.
 Control passes to you on 1 October 2027, when Tasmania may sign out-of-contract players from other clubs (one per club, up to 18),
 followed by free agency, the trade period and the draft with Tasmania&apos;s concession picks. Tasmania joins the competition in 2028.
 </span>
 <span style={{ display: "block", marginTop: 8, color: "#fb923c", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
 NO LIST · STARTS {TASMANIA_CAREER.startDate.split("-").reverse().join("/")} · HAND-OVER {TASMANIA_CAREER.handoverDate.split("-").reverse().join("/")}
 </span>
 <span style={{ display: "block", marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 11 }}>
 Simulating the first season can take a minute or two.
 </span>
 </div>
 <button
 type="button"
 role="radio"
 aria-checked={tasmaniaSelected}
 onClick={() => setSelectedClubId(tasmaniaDevils.id)}
 style={{
 padding: "8px 14px",
 border: `1px solid ${tasmaniaSelected ? "#fb923c" : "#475569"}`,
 borderRadius: 9,
 color: "white",
 background: tasmaniaSelected ? "#ea580c" : "#1e293b",
 fontWeight: 700,
 cursor: "pointer",
 }}
 >
 {tasmaniaSelected ? "Selected" : "Select"}
 </button>
 </div>
 </section>
 )}
 </div>

 <footer
 style={{
 position: "fixed",
 zIndex: 20,
 right: 0,
 bottom: 0,
 left: 0,
 padding: "14px clamp(16px, 5vw, 64px) calc(14px + env(safe-area-inset-bottom))",
 borderTop: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
 background: lightMode ? "rgba(255, 255, 255, 0.96)" : "rgba(2, 6, 23, 0.94)",
 backdropFilter: "blur(14px)"
 }}
 >
 <div
 style={{
 maxWidth: 1240,
 margin: "0 auto",
 display: "flex",
 flexWrap: "wrap",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 14
 }}
 >
 <div style={{ color: selectedClub ? (lightMode ? "#0f172a" : "#f8fafc") : (lightMode ? "#64748b" : "#94a3b8") }}>
 {selectedClub ? `Selected: ${selectedClub.name}` : "Select a club to begin"}
 </div>
 <button
 type="button"
 disabled={!selectedClub}
 onClick={() => selectedClub && onSelect(selectedClub, tasmaniaSelected ? TASMANIA_CAREER.id : careerStart)}
 style={{
 border: 0,
 borderRadius: 12,
 padding: "13px 22px",
 color: "white",
 background: selectedClub ? "#ea580c" : "#334155",
 fontSize: 15,
 fontWeight: 800,
 cursor: selectedClub ? "pointer" : "not-allowed"
 }}
 >
 {gameMode === "CLUB_RESET" ? "Choose club and start draft" : tasmaniaSelected ? "Start Tasmania career" : "Confirm selection"}
 </button>
 </div>
 </footer>
 </main>
 );
}
