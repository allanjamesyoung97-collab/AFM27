import { useState } from "react";
import ClubBadge from "./ClubBadge.jsx";

export default function JobMarketTab({ market = {}, currentClubName, onApply = () => {}, standalone = false }) {
  const [feedback, setFeedback] = useState("");
  const vacancies = (market.vacancies ?? []).filter(item => item.status === "OPEN")
    .sort((a, b) => Number(a.expectedFinish ?? 19) - Number(b.expectedFinish ?? 19) || a.club.localeCompare(b.club));
  const history = [...(market.history ?? [])].reverse().slice(0, 12);
  const unemployed = market.userStatus === "UNEMPLOYED";
  const applied = new Set((market.applications ?? []).map(item => item.vacancyId));

  function apply(clubName) {
    const result = onApply(clubName);
    setFeedback(result?.message ?? (result?.accepted ? `${clubName} has appointed you as coach.` : result?.error ?? "Application could not be submitted."));
  }

  return <section style={{ color: "#f8fafc" }}>
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 22 }}>Job Market</h3>
      <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
        Clubs review their coaches against results, list strength and board confidence. Vacancies close when a club appoints a replacement.
      </p>
    </div>
    {unemployed && <div role="alert" style={{ ...notice, background: "#451a1a", borderColor: "#991b1b", color: "#fecaca" }}>
      {market.dismissedFrom} dismissed you after a board review. Apply for an open role to resume your coaching career.
    </div>}
    {!unemployed && <div style={notice}>Current club: <strong>{currentClubName}</strong>. You can apply for another club’s vacancy while employed.</div>}
    {feedback && <p role="status" style={{ ...notice, borderColor: "#ea580c" }}>{feedback}</p>}
    <div style={{ display: "grid", gridTemplateColumns: standalone ? "repeat(auto-fit, minmax(270px, 1fr))" : "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 22 }}>
      {vacancies.map(vacancy => {
        const blocked = applied.has(vacancy.id) || unemployed && vacancy.club === market.dismissedFrom && Number(vacancy.seasonYear) === Number(market.dismissedSeason);
        return <article key={vacancy.id} style={{ padding: 17, background: "#0f172a", border: "1px solid #334155", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}><ClubBadge club={vacancy.club} size={26} /><strong style={{ fontSize: 17 }}>{vacancy.club}</strong></div>
          <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
            {vacancy.actualFinish != null && <div>Ladder <strong>{vacancy.actualFinish}/18</strong> · Projected <strong>{vacancy.expectedFinish}/18</strong></div>}
            {vacancy.boardScore != null && <div>Board review <strong>{vacancy.boardScore}/100</strong></div>}
            <div style={{ color: "#94a3b8", marginTop: 6 }}>{vacancy.reason}</div>
          </div>
          <button type="button" disabled={blocked} onClick={() => apply(vacancy.club)} style={{ marginTop: 15, padding: "9px 13px", border: 0, borderRadius: 8, background: blocked ? "#334155" : "#ea580c", color: "#fff", fontWeight: 800, cursor: blocked ? "not-allowed" : "pointer" }}>
            {blocked ? vacancy.club === market.dismissedFrom ? "Former club" : "Already applied" : "Apply for role"}
          </button>
        </article>;
      })}
      {!vacancies.length && <div style={{ ...notice, gridColumn: "1 / -1", color: "#94a3b8" }}>No coaching vacancies are open. Clubs review their coaches after the season.</div>}
    </div>
    <h4 style={{ margin: "0 0 8px" }}>Recent coaching changes</h4>
    {history.length ? <div style={{ border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
      {history.map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 13px", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
        <span><strong>{item.club}</strong> · {item.coach} {item.type === "SACKED" ? "sacked" : item.type === "DEPARTED" ? "departed" : "appointed"}</span>
        <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{item.date}</span>
      </div>)}
    </div> : <p style={{ color: "#94a3b8" }}>No coaching changes recorded yet.</p>}
  </section>;
}

const notice = { padding: 13, marginBottom: 15, background: "#172033", border: "1px solid #334155", borderRadius: 10 };
