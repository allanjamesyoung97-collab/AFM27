import { useEffect, useRef, useState } from "react";
import ClubBadge from "./ClubBadge.jsx";
import { parseFixtureDate } from "../engine/fixtureScheduler.js";

// AFL-style finals bracket. Everything is laid out on a fixed design canvas
// and scaled to the available width, so cards and connectors always line up.
const W = 1490, H = 880, CARD_W = 232, CARD_H = 134;
const COL = { wc: 24, w1: 324, sf: 624, pf: 924, gf: 1224 };
const ROW = { r1: 230, r2: 390, r3: 570, r4: 730 };
const GF_Y = 480;
const GOLD = "#d9c58b", GOLD_DIM = "#d9c58b", WHITE = "#ffffff", INK = "#2a2542";

const right = (x) => x + CARD_W;
const mid = (x) => x + CARD_W / 2;
const top = (y) => y - CARD_H / 2;
const bottom = (y) => y + CARD_H / 2;

const toDate = (value) => value instanceof Date ? value : parseFixtureDate(value);
const shortDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase() : "";
};

function Team({ side, score, isWinner, isLoser, mine, codeFor, onOpenClub }) {
  const known = Boolean(side.club);
  return (
    <div style={{ width: 82, display: "flex", flexDirection: "column", alignItems: "center", opacity: isLoser ? .45 : 1 }}>
      <div style={{ position: "relative", width: 52, height: 52 }}>
        {known ? (
          <div style={{ borderRadius: "50%", boxShadow: mine ? `0 0 0 3px ${WHITE}, 0 0 14px 4px rgba(255,255,255,.55)` : isWinner ? `0 0 0 3px ${GOLD}` : "none" }}>
            <ClubBadge club={side.club} size={52} />
          </div>
        ) : (
          <div style={{ width: 52, height: 52, boxSizing: "border-box", borderRadius: "50%", border: `2px dashed ${GOLD}`, display: "grid", placeItems: "center", color: GOLD, fontWeight: 900, fontSize: 22, opacity: .8 }}>?</div>
        )}
        {side.seed && <span style={{ position: "absolute", left: -6, bottom: -4, width: 20, height: 20, borderRadius: "50%", background: INK, color: GOLD, border: `1px solid ${GOLD}`, fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{side.seed}</span>}
      </div>
      <div style={{ marginTop: 5, height: 20, display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: .4 }}>
        {known ? <button type="button" title={side.club} onClick={() => onOpenClub?.(side.club)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>{codeFor(side.club)}</button> : <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>{side.placeholder ?? "TBD"}</span>}
        {score !== null && <span style={{ color: isWinner ? GOLD : "#fff", fontSize: 16 }}>{score}</span>}
      </div>
    </div>
  );
}

function MatchCard({ match, x, cy, clubName, codeFor, onOpenReport, onOpenClub }) {
  const homeWon = match.winner && match.winner === match.home.club;
  const awayWon = match.winner && match.winner === match.away.club;
  return (
    <div style={{ position: "absolute", left: x, top: top(cy), width: CARD_W, height: CARD_H, boxSizing: "border-box", padding: "7px 8px 6px", borderRadius: 14, background: "rgba(18,15,38,.62)", border: "1px solid rgba(217,197,139,.55)", boxShadow: "0 8px 22px rgba(10,8,26,.35)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, letterSpacing: 1.1, color: GOLD }}>
        <span>{match.title.toUpperCase()}</span><span>{shortDate(match.date)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 4px" }}>
        <Team side={match.home} score={match.homeScore} isWinner={homeWon} isLoser={awayWon} mine={match.home.club === clubName} codeFor={codeFor} onOpenClub={onOpenClub} />
        <span style={{ marginTop: 3, fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 38, lineHeight: "46px", color: GOLD, textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>V</span>
        <Team side={match.away} score={match.awayScore} isWinner={awayWon} isLoser={homeWon} mine={match.away.club === clubName} codeFor={codeFor} onOpenClub={onOpenClub} />
      </div>
      <div style={{ height: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "rgba(255,255,255,.7)" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: match.played ? 150 : 210 }}>{match.venue ?? ""}{match.extraTime ? " · extra time" : ""}</span>
        {match.played && onOpenReport && <button type="button" onClick={() => onOpenReport(match.result)} style={{ border: 0, background: "transparent", color: GOLD, fontSize: 10, fontWeight: 800, textDecoration: "underline", cursor: "pointer", padding: 0 }}>Report</button>}
      </div>
    </div>
  );
}

// Connector definitions. `from` is the match the line leaves, `kind` says
// whether it carries that match's winner (W), loser (L) or is a plain trunk.
function buildConnectors(b) {
  const { r1, r2, r3, r4 } = ROW;
  const wcDone = b.wildcard.every((match) => match.played);
  const list = [
    // Qualifying final 1: trunk along the top, loser drops to SF1, winner to PF1.
    { id: "qf1-trunk", d: `M ${right(COL.w1)} ${r1} H ${mid(COL.sf)}`, from: "QF1", kind: "T" },
    { id: "qf1-l", d: `M ${mid(COL.sf)} ${r1} V ${top(r2) - 3}`, from: "QF1", kind: "L", arrow: true, badge: [mid(COL.sf), (r1 + top(r2)) / 2] },
    { id: "qf1-w", d: `M ${mid(COL.sf)} ${r1} H ${mid(COL.pf)} V ${top(r2) - 3}`, from: "QF1", kind: "W", arrow: true, badge: [mid(COL.pf), (r1 + top(r2)) / 2] },
    // Qualifying final 2: trunk along the bottom, loser rises to SF2, winner to PF2.
    { id: "qf2-trunk", d: `M ${right(COL.w1)} ${r4} H ${mid(COL.sf)}`, from: "QF2", kind: "T" },
    { id: "qf2-l", d: `M ${mid(COL.sf)} ${r4} V ${bottom(r3) + 3}`, from: "QF2", kind: "L", arrow: true, badge: [mid(COL.sf), (r4 + bottom(r3)) / 2] },
    { id: "qf2-w", d: `M ${mid(COL.sf)} ${r4} H ${mid(COL.pf)} V ${bottom(r3) + 3}`, from: "QF2", kind: "W", arrow: true, badge: [mid(COL.pf), (r4 + bottom(r3)) / 2] },
    // Elimination finals feed the semi finals.
    { id: "ef1", d: `M ${right(COL.w1)} ${r2} H ${COL.sf - 3}`, from: "EF1", kind: "W", arrow: true, badge: [right(COL.w1) + 34, r2] },
    { id: "ef2", d: `M ${right(COL.w1)} ${r3} H ${COL.sf - 3}`, from: "EF2", kind: "W", arrow: true, badge: [right(COL.w1) + 34, r3] },
    // Semi final winners cross over into the preliminary finals.
    { id: "sf1", d: `M ${right(COL.sf)} ${r2} H ${right(COL.sf) + 20} V ${r3 - 12} H ${COL.pf - 3}`, from: "SF1", kind: "W", arrow: true, badge: [right(COL.sf) + 20, r2 + 34] },
    { id: "sf2", d: `M ${right(COL.sf)} ${r3} H ${right(COL.sf) + 46} V ${r2 + 12} H ${COL.pf - 3}`, from: "SF2", kind: "W", arrow: true, badge: [right(COL.sf) + 46, r3 - 34] },
    // Preliminary final winners meet in the grand final.
    { id: "pf1", d: `M ${right(COL.pf)} ${r2} H ${right(COL.pf) + 34} V ${GF_Y - 14} H ${COL.gf - 3}`, from: "PF1", kind: "W", arrow: true, badge: [right(COL.pf) + 34, (r2 + GF_Y) / 2 - 7] },
    { id: "pf2", d: `M ${right(COL.pf)} ${r3} H ${right(COL.pf) + 34} V ${GF_Y + 14} H ${COL.gf - 3}`, from: "PF2", kind: "W", arrow: true, badge: [right(COL.pf) + 34, (r3 + GF_Y) / 2 + 7] },
    // Wildcard winners take seeds 7 and 8 and join the elimination finals.
    { id: "wc-1", d: `M ${right(COL.wc)} ${r2} H ${COL.w1 - 3}`, from: "WC_7_10", kind: "W", arrow: true },
    { id: "wc-2", d: `M ${right(COL.wc)} ${r3} H ${COL.w1 - 3}`, from: "WC_8_9", kind: "W", arrow: true },
    { id: "wc-bus", d: `M ${right(COL.wc) + 34} ${r2} V ${r3}`, from: "WC_7_10", kind: "W", badge: [right(COL.wc) + 34, (r2 + r3) / 2], done: wcDone },
  ];
  return list;
}

export default function FinalsBracket({ bracket, clubName, codeFor, onOpenReport, onOpenClub, phase }) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;
    const update = () => setScale(Math.min(1.1, Math.max(0.55, element.clientWidth / W)));
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const nodes = Object.fromEntries([...bracket.wildcard, ...bracket.week1, ...bracket.semis, ...bracket.prelims, bracket.grandFinal].map((match) => [match.code, match]));
  const connectors = buildConnectors(bracket);
  const dateRange = bracket.firstDate && bracket.lastDate ? `${shortDate(bracket.firstDate)} – ${shortDate(bracket.lastDate)}` : "";
  const heading = (label, x, y) => <div key={label} style={{ position: "absolute", left: x, top: y, width: CARD_W, fontSize: 12, fontWeight: 900, letterSpacing: 2.2, color: GOLD }}>{label}</div>;
  const premier = bracket.premier;

  const cards = [
    [nodes.WC_7_10, COL.wc, ROW.r2], [nodes.WC_8_9, COL.wc, ROW.r3],
    [nodes.QF1, COL.w1, ROW.r1], [nodes.EF1, COL.w1, ROW.r2], [nodes.EF2, COL.w1, ROW.r3], [nodes.QF2, COL.w1, ROW.r4],
    [nodes.SF1, COL.sf, ROW.r2], [nodes.SF2, COL.sf, ROW.r3],
    [nodes.PF1, COL.pf, ROW.r2], [nodes.PF2, COL.pf, ROW.r3],
    [nodes.GF, COL.gf, GF_Y],
  ];

  return (
    <div ref={hostRef} style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ width: W * scale, height: H * scale, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", borderRadius: 22, overflow: "hidden", background: "radial-gradient(900px 500px at 88% 96%, rgba(236,176,130,.45), transparent 70%), linear-gradient(160deg, #2a2647 0%, #4a3f6c 48%, #8f7a98 100%)", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
          {/* Title block */}
          <div style={{ position: "absolute", right: 34, top: 26, textAlign: "right" }}>
            <div style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 58, lineHeight: "58px", letterSpacing: 1, color: GOLD, textShadow: "0 3px 0 rgba(0,0,0,.35)" }}>THE FINALS</div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, letterSpacing: 3, color: GOLD }}>{dateRange}{dateRange ? " · " : ""}{bracket.seasonYear}</div>
            {phase === "HOME_AND_AWAY" && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.75)" }}>Projected from the current ladder</div>}
          </div>
          <div style={{ position: "absolute", left: 24, top: 30, fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,.7)" }}>White ring marks your club · bright white line is your path</div>

          {heading("WILDCARD ROUND", COL.wc, 134)}
          {heading("FINALS WEEK ONE", COL.w1, 134)}
          {heading("SEMI FINALS", COL.sf, 134)}
          {heading("PRELIMINARY FINALS", COL.pf, 134)}
          {heading("GRAND FINAL", COL.gf, top(GF_Y) - 28)}

          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              {[["gold", GOLD], ["white", WHITE]].map(([name, colour]) => (
                <marker key={name} id={`bracket-arrow-${name}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={colour} /></marker>
              ))}
            </defs>
            {connectors.map((line) => {
              const source = nodes[line.from];
              const resolved = line.done ?? (source?.played && (line.kind === "T" || Boolean(line.kind === "L" ? source.loser : source.winner)));
              const mine = Boolean(clubName) && source?.played && ((line.kind === "W" && source.winner === clubName) || (line.kind === "L" && source.loser === clubName));
              const stroke = mine ? WHITE : GOLD_DIM;
              return (
                <g key={line.id} opacity={resolved ? 1 : .42}>
                  <path d={line.d} fill="none" stroke={stroke} strokeWidth={mine ? 5 : 3} strokeLinejoin="round" strokeLinecap="round" markerEnd={line.arrow ? `url(#bracket-arrow-${mine ? "white" : "gold"})` : undefined} />
                  {line.badge && (
                    <>
                      <circle cx={line.badge[0]} cy={line.badge[1]} r={12} fill={mine ? WHITE : GOLD} />
                      <text x={line.badge[0]} y={line.badge[1] + 4.5} textAnchor="middle" fontSize="13" fontWeight="900" fill={INK}>{line.kind === "L" ? "L" : "W"}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {cards.map(([match, x, cy]) => <MatchCard key={match.code} match={match} x={x} cy={cy} clubName={clubName} codeFor={codeFor} onOpenReport={onOpenReport} onOpenClub={onOpenClub} />)}

          {premier && (
            <div style={{ position: "absolute", left: COL.gf, top: bottom(GF_Y) + 26, width: CARD_W, boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, background: "#0f0d20", border: `1px solid ${GOLD}`, textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2.4, color: GOLD }}>{bracket.seasonYear} PREMIERS</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <ClubBadge club={premier} size={34} />
                <span style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontSize: 18 }}>{premier.toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Premiership cup */}
          <svg x="0" y="0" width="190" height="240" viewBox="0 0 120 150" style={{ position: "absolute", left: COL.gf + 20, top: 625 }} aria-hidden="true">
            <defs>
              <linearGradient id="bracket-cup" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4e5b0" /><stop offset=".5" stopColor="#b9a56c" /><stop offset="1" stopColor="#6d5f3a" /></linearGradient>
            </defs>
            <path d="M28 28 C2 28 4 68 34 72" fill="none" stroke="url(#bracket-cup)" strokeWidth="6" strokeLinecap="round" />
            <path d="M92 28 C118 28 116 68 86 72" fill="none" stroke="url(#bracket-cup)" strokeWidth="6" strokeLinecap="round" />
            <path d="M26 18 H94 C94 68 80 88 60 92 C40 88 26 68 26 18 Z" fill="url(#bracket-cup)" />
            <rect x="54" y="92" width="12" height="28" fill="url(#bracket-cup)" />
            <path d="M36 126 H84 L92 142 H28 Z" fill="url(#bracket-cup)" />
            <text x="60" y="52" textAnchor="middle" fontSize="12" fontWeight="900" fill="#2a2542" opacity=".75">{bracket.seasonYear}</text>
          </svg>
        </div>
      </div>
    </div>
  );
}