import { useMemo, useState } from "react";
import { players } from "../data/players.js";
import { clubs } from "../data/clubs.js";
import ClubBadge from "./ClubBadge.jsx";
import { createInboxMail } from "./InboxScreen.jsx";
import { getCareerContract, getContractStatus, CONTRACT_STATUS } from "../engine/contractEngine.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { getTeamSelectionStatus } from "../engine/teamSelectionEngine.js";
import { delegationOptions, defaultDelegationSettings } from "../data/trainingCategories.js";
import {
  calculateBoardReview,
  calculateClubFinances,
  createClubAdministrationState,
} from "../engine/clubAdministrationEngine.js";

const EMPTY = Object.freeze({});
const noop = () => {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const money = (value) => {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return abs >= 1_000_000 ? `${sign}$${(abs / 1_000_000).toFixed(1)}M` : `${sign}$${Math.round(abs / 1000)}k`;
};

const ordinal = (n) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
};

const boardGrade = (score) => (score >= 90 ? "A+" : score >= 82 ? "A" : score >= 74 ? "B" : score >= 64 ? "C" : "D");

const luminance = (hex) => {
  const value = String(hex ?? "#000000").replace("#", "").padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const s = parseInt(value.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const sideNames = (match) => ({ home: match.homeTeam ?? match.home, away: match.awayTeam ?? match.away });

// One club's result in a completed match, from that club's point of view.
function resultFor(result, clubName) {
  const { home, away } = sideNames(result);
  const isHome = home === clubName;
  const own = Number(isHome ? result.homeScore : result.awayScore);
  const opp = Number(isHome ? result.awayScore : result.homeScore);
  return {
    opponent: isHome ? away : home,
    isHome,
    own,
    opp,
    outcome: own > opp ? "W" : own < opp ? "L" : "D",
  };
}

function clubResults(roundHistory, clubName) {
  return (roundHistory ?? [])
    .flatMap((entry) => (entry.results ?? []).map((result) => ({ ...result, round: entry.round })))
    .filter((result) => {
      const { home, away } = sideNames(result);
      return home === clubName || away === clubName;
    })
    .sort((a, b) => a.round - b.round)
    .map((result) => ({ round: result.round, ...resultFor(result, clubName) }));
}

// Ladder positions from results alone (4 points a win, 2 a draw, then percentage), so a
// position change can be shown without replaying the season.
function standingsThrough(roundHistory, throughRound) {
  const table = new Map();
  const row = (name) => {
    if (!table.has(name)) table.set(name, { name, points: 0, pf: 0, pa: 0 });
    return table.get(name);
  };
  (roundHistory ?? []).filter((entry) => entry.round <= throughRound).forEach((entry) => {
    (entry.results ?? []).forEach((result) => {
      const { home, away } = sideNames(result);
      if (!home || !away) return;
      const h = row(home);
      const a = row(away);
      h.pf += Number(result.homeScore ?? 0); h.pa += Number(result.awayScore ?? 0);
      a.pf += Number(result.awayScore ?? 0); a.pa += Number(result.homeScore ?? 0);
      if (result.homeScore > result.awayScore) h.points += 4;
      else if (result.homeScore < result.awayScore) a.points += 4;
      else { h.points += 2; a.points += 2; }
    });
  });
  return [...table.values()]
    .sort((x, y) => (y.points - x.points) || ((y.pf / Math.max(1, y.pa)) - (x.pf / Math.max(1, x.pa))))
    .map((item, index) => ({ ...item, position: index + 1 }));
}

function lastMeeting(seasonState, clubName, opponentName) {
  const rounds = [
    ...(seasonState.roundHistory ?? []).map((entry) => ({ ...entry, year: seasonState.seasonYear })),
    ...[...(seasonState.seasonArchive ?? [])].reverse().flatMap((archive) =>
      [...(archive.roundHistory ?? [])].reverse().map((entry) => ({ ...entry, year: archive.seasonYear }))),
  ];
  for (const entry of [...rounds].reverse()) {
    const found = (entry.results ?? []).find((result) => {
      const { home, away } = sideNames(result);
      return (home === clubName && away === opponentName) || (home === opponentName && away === clubName);
    });
    if (found) return { ...resultFor(found, clubName), round: entry.round, year: entry.year };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Card({ title, action, children, style, palette }) {
  return (
    <section
      style={{
        background: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        padding: 18,
        color: palette.text,
        ...style,
      }}
    >
      {(title || action) && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          {title && <h3 style={{ margin: 0, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: palette.muted }}>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function LinkButton({ children, onClick, palette, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: accent ?? palette.muted, fontSize: "0.8rem", fontWeight: 700 }}
    >
      {children}
    </button>
  );
}

function FormChips({ results, palette }) {
  if (!results.length) return <span style={{ color: palette.muted, fontSize: "0.85rem" }}>No games yet</span>;
  const colour = { W: "#16a34a", L: "#dc2626", D: "#64748b" };
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      {results.map((item) => {
        const abbreviation = clubs.find((c) => c.name === item.opponent)?.abbreviation ?? "";
        return (
          <span
            key={`${item.round}-${item.opponent}`}
            title={`Round ${item.round}: ${item.outcome === "W" ? "Won" : item.outcome === "L" ? "Lost" : "Drew"} ${item.own}–${item.opp} ${item.isHome ? "vs" : "at"} ${item.opponent}`}
            style={{ minWidth: 30, textAlign: "center", padding: "3px 6px", borderRadius: 8, background: colour[item.outcome], color: "#fff", fontWeight: 800, fontSize: "0.72rem" }}
          >
            {item.outcome}
            <span style={{ display: "block", fontSize: "0.58rem", fontWeight: 600, opacity: 0.85 }}>{abbreviation}</span>
          </span>
        );
      })}
    </span>
  );
}

const SEVERITY = {
  high: { colour: "#ef4444", label: "Urgent" },
  medium: { colour: "#f59e0b", label: "Soon" },
  low: { colour: "#38bdf8", label: "FYI" },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard({
  club = clubs[0],
  players: playerPool = players,
  appearance = "dark",
  seasonState = EMPTY,
  playerFitness = EMPTY,
  teamSelection = EMPTY,
  calendarEvents = [],
  currentDate = null,
  readMessageIds = [],
  delegationSettings = defaultDelegationSettings,
  onDelegationChange = noop,
  selectionResponsibility = "COACH",
  onSelectionResponsibilityChange = noop,
  assistantManagedTraining = true,
  onTrainingModeChange = noop,
  onNavigate = noop,
  onOpenClub = noop,
  onPlayMatch = noop,
}) {
  const [showDelegationPanel, setShowDelegationPanel] = useState(false);
  const light = appearance === "light";
  const palette = {
    text: light ? "#0f172a" : "#f8fafc",
    muted: light ? "#64748b" : "#94a3b8",
    card: light ? "#ffffff" : "#0f172a",
    raised: light ? "#f1f5f9" : "#1e293b",
    border: light ? "#cbd5e1" : "#334155",
  };
  const primary = club.colours?.primary ?? "#334155";
  const secondary = club.colours?.secondary ?? "#e2e8f0";
  // Near-black club colours vanish on a dark theme, so accent with the second colour there.
  const accent = !light && luminance(primary) < 0.05 ? secondary : light && luminance(primary) > 0.8 ? secondary : primary;
  // A club's secondary colour can be white (for example Collingwood), which
  // needs a contrasting active foreground and a fallback for filled buttons.
  const activeButtonBackground = luminance(accent) > 0.72 ? "#ea580c" : accent;
  const activeButtonText = luminance(activeButtonBackground) > 0.58 ? "#0f172a" : "#ffffff";
  const allDelegationSelected = assistantManagedTraining
    && selectionResponsibility === "ASSISTANT"
    && delegationOptions.every(option => Boolean(delegationSettings[option.id]));
  const setAllDelegation = enabled => {
    onTrainingModeChange(enabled);
    onSelectionResponsibilityChange(enabled ? "ASSISTANT" : "COACH");
    onDelegationChange({
      ...delegationSettings,
      ...Object.fromEntries(delegationOptions.map(option => [option.id, enabled])),
    });
  };
  const renderSwitch = (checked, label, onChange) => <button type="button" role="switch" aria-checked={Boolean(checked)} aria-label={label}
    onClick={() => onChange(!checked)}
    style={{ width: 52, height: 28, border: 0, borderRadius: 999, background: checked ? "#16a34a" : "#475569", cursor: "pointer", position: "relative", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 3, left: checked ? 27 : 3, width: 22, height: 22, borderRadius: "50%", background: "white", transition: "left 0.2s ease" }} />
  </button>;

  const seasonYear = Number(seasonState.seasonYear ?? 2027);
  const round = Number(seasonState.round ?? 1);
  const phase = seasonState.phase ?? "HOME_AND_AWAY";
  const totalRounds = seasonState.fixture?.length ?? 23;
  const playerContracts = seasonState.playerContracts ?? EMPTY;

  // ----- squad -----
  const roster = useMemo(
    () => playerPool.filter((player) => getCareerPlayer(player, seasonState.playerDevelopment ?? EMPTY, seasonYear, playerContracts).club === club.name),
    [playerPool, club.name, seasonState.playerDevelopment, seasonYear, playerContracts],
  );
  const careerRoster = useMemo(
    () => roster.map((player) => getCareerPlayer(player, seasonState.playerDevelopment ?? EMPTY, seasonYear, playerContracts)),
    [roster, seasonState.playerDevelopment, seasonYear, playerContracts],
  );
  const rosterWithContracts = useMemo(
    () => roster.map((player) => ({ ...player, contract: getCareerContract(player, playerContracts) })),
    [roster, playerContracts],
  );

  // ----- results, form, ladder -----
  const myResults = useMemo(() => clubResults(seasonState.roundHistory, club.name), [seasonState.roundHistory, club.name]);
  const ladder = seasonState.ladder ?? [];
  const ladderIndex = ladder.findIndex((item) => item.club === club.name);
  const ladderRow = ladderIndex >= 0 ? ladder[ladderIndex] : null;
  const position = ladderIndex + 1;
  const positionChange = useMemo(() => {
    const lastRound = (seasonState.roundHistory ?? []).reduce((max, entry) => Math.max(max, entry.round), 0);
    if (lastRound < 2) return null;
    const now = standingsThrough(seasonState.roundHistory, lastRound).find((item) => item.name === club.name);
    const before = standingsThrough(seasonState.roundHistory, lastRound - 1).find((item) => item.name === club.name);
    return now && before ? before.position - now.position : null;
  }, [seasonState.roundHistory, club.name]);
  const miniLadder = useMemo(() => {
    if (ladderIndex < 0) return [];
    const start = Math.max(0, Math.min(ladderIndex - 2, ladder.length - 5));
    return ladder.slice(start, start + 5).map((row, i) => ({ ...row, position: start + i + 1 }));
  }, [ladder, ladderIndex]);

  // ----- next match -----
  const fixtureRound = (seasonState.fixture ?? []).find((item) => item.round === round);
  const nextMatchRaw = phase === "HOME_AND_AWAY"
    ? fixtureRound?.matches?.find((match) => {
        const { home, away } = sideNames(match);
        return home === club.name || away === club.name;
      })
    : null;
  const nextMatch = nextMatchRaw ? { ...nextMatchRaw, round } : null;
  const opponentName = nextMatch ? (sideNames(nextMatch).home === club.name ? sideNames(nextMatch).away : sideNames(nextMatch).home) : null;
  const opponent = clubs.find((item) => item.name === opponentName) ?? null;
  const opponentPosition = ladder.findIndex((item) => item.club === opponentName) + 1;
  const opponentForm = useMemo(
    () => (opponentName ? clubResults(seasonState.roundHistory, opponentName).slice(-5) : []),
    [seasonState.roundHistory, opponentName],
  );
  const meeting = useMemo(
    () => (opponentName ? lastMeeting(seasonState, club.name, opponentName) : null),
    [seasonState, club.name, opponentName],
  );

  // ----- lineup and availability -----
  const selection = useMemo(() => getTeamSelectionStatus(teamSelection, roster, playerFitness), [teamSelection, roster, playerFitness]);
  const idByName = useMemo(() => new Map(roster.map((player) => [player.name, player.id])), [roster]);
  const isOut = (id) => Number(playerFitness[id]?.injury?.weeksRemaining ?? 0) > 0;
  const injuredPlayers = useMemo(
    () => roster
      .filter((player) => isOut(player.id))
      .map((player) => ({ player, injury: playerFitness[player.id].injury }))
      .sort((a, b) => b.injury.weeksRemaining - a.injury.weeksRemaining),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, playerFitness],
  );
  const selectedNames = Object.values(teamSelection.selectedSide ?? EMPTY).filter(Boolean);
  const injuredSelected = selectedNames.filter((name) => isOut(idByName.get(name)));
  const tired = useMemo(
    () => roster
      .filter((player) => !isOut(player.id) && Number(playerFitness[player.id]?.fitness ?? 100) < 65)
      .sort((a, b) => Number(playerFitness[a.id].fitness) - Number(playerFitness[b.id].fitness)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, playerFitness],
  );
  const available = roster.length - injuredPlayers.length;

  // ----- finance and board -----
  const administration = useMemo(
    () => seasonState.clubAdministration ?? createClubAdministrationState(club, roster, seasonYear, playerContracts),
    [seasonState.clubAdministration, club, roster, seasonYear, playerContracts],
  );
  const finance = useMemo(
    () => calculateClubFinances({ club, roster: rosterWithContracts, playerContracts, administrationState: administration, seasonState }),
    [club, rosterWithContracts, playerContracts, administration, seasonState],
  );
  const board = useMemo(
    () => calculateBoardReview({ finance, seasonState, club, administrationState: administration, roster: careerRoster }),
    [finance, seasonState, club, administration, careerRoster],
  );
  const grade = boardGrade(board.score);

  // ----- contracts -----
  const expiring = useMemo(() => {
    const out = [];
    const finalYear = [];
    rosterWithContracts.forEach((player) => {
      const status = getContractStatus(player.contract);
      if (status === CONTRACT_STATUS.OUT_OF_CONTRACT) out.push(player);
      else if (status === CONTRACT_STATUS.FINAL_YEAR) finalYear.push(player);
    });
    return { out, finalYear };
  }, [rosterWithContracts]);

  // ----- squad highlights (developed ratings, not the static ones) -----
  const bestPlayer = useMemo(
    () => [...careerRoster].filter((player) => !isOut(player.id)).sort((a, b) => b.overall - a.overall)[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [careerRoster, playerFitness],
  );
  const riser = useMemo(() => {
    const baseline = new Map(roster.map((player) => [player.id, player.overall]));
    return [...careerRoster]
      .map((player) => ({ player, change: player.overall - (baseline.get(player.id) ?? player.overall) }))
      .filter((item) => item.change > 0)
      .sort((a, b) => b.change - a.change)[0] ?? null;
  }, [careerRoster, roster]);

  // ----- mail and calendar -----
  const mail = useMemo(() => createInboxMail(club, seasonState), [club, seasonState]);
  const unread = mail.filter((message) => !readMessageIds.includes(message.id));
  const comingUp = useMemo(() => {
    const from = currentDate ? new Date(currentDate) : null;
    return (calendarEvents ?? [])
      .filter((event) => event.type !== "TRAINING" && !event.resolved && event.date && (!from || new Date(event.date) >= from))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  }, [calendarEvents, currentDate]);

  // ----- what needs the manager -----
  const attention = useMemo(() => {
    const items = [];
    const go = (screen, options) => () => onNavigate(screen, options);
    if (phase === "HOME_AND_AWAY" && nextMatch) {
      if (!selection.complete) {
        items.push({ id: "lineup", level: "high", title: "Team not selected", detail: `${selection.filled} of ${selection.required} positions filled for Round ${round}.`, label: "Select team", onClick: go("SQUAD") });
      } else if (injuredSelected.length) {
        items.push({ id: "injured-selected", level: "high", title: `${injuredSelected.length} injured player${injuredSelected.length === 1 ? "" : "s"} in your side`, detail: injuredSelected.slice(0, 3).join(", "), label: "Fix lineup", onClick: go("SQUAD") });
      }
    }
    if (finance.cashBalance < 0) {
      items.push({ id: "debt", level: "high", title: `Club is ${money(Math.abs(finance.cashBalance))} in debt`, detail: "Facility upgrades are blocked until cash is positive.", label: "Review finances", onClick: go("FINANCES", { tab: "OVERVIEW" }) });
    }
    if (finance.playerPayments > finance.salaryCap) {
      items.push({ id: "over-cap", level: "high", title: "Over the salary cap", detail: `Payments are ${money(finance.playerPayments - finance.salaryCap)} above the ${money(finance.salaryCap)} cap.`, label: "Open contracts", onClick: go("FINANCES", { tab: "CONTRACTS" }) });
    } else if (finance.playerPayments < finance.minimumSpend) {
      items.push({ id: "under-min", level: "medium", title: "Below the minimum spend", detail: `${money(finance.minimumSpend - finance.playerPayments)} short of the ${money(finance.minimumSpend)} minimum. Re-sign or extend players.`, label: "Open contracts", onClick: go("FINANCES", { tab: "CONTRACTS" }) });
    }
    if (expiring.out.length) {
      const first = expiring.out[0];
      items.push({ id: "out-of-contract", level: "high", title: `${expiring.out.length} player${expiring.out.length === 1 ? " is" : "s are"} out of contract`, detail: expiring.out.slice(0, 3).map((player) => player.name).join(", "), label: expiring.out.length === 1 ? "Negotiate" : "Open contracts", onClick: expiring.out.length === 1 ? go("FINANCES", { tab: "NEGOTIATION", playerId: first.id }) : go("FINANCES", { tab: "CONTRACTS" }) });
    }
    if (expiring.finalYear.length) {
      const first = expiring.finalYear[0];
      items.push({ id: "final-year", level: "medium", title: `${expiring.finalYear.length} player${expiring.finalYear.length === 1 ? " is" : "s are"} in the final year of a contract`, detail: expiring.finalYear.slice(0, 3).map((player) => player.name).join(", "), label: expiring.finalYear.length === 1 ? "Negotiate" : "Open contracts", onClick: expiring.finalYear.length === 1 ? go("FINANCES", { tab: "NEGOTIATION", playerId: first.id }) : go("FINANCES", { tab: "CONTRACTS" }) });
    }
    if (board.score < 65) {
      items.push({ id: "board", level: board.score < 55 ? "high" : "medium", title: `Board confidence is low (${grade}, ${board.score}/100)`, detail: "Check which objectives are slipping.", label: "See board review", onClick: go("FINANCES", { tab: "BOARD" }) });
    }
    if (phase === "HOME_AND_AWAY" && !administration.commercial?.activeSponsor) {
      items.push({ id: "sponsor", level: "medium", title: `No sponsorship deal for ${seasonYear}`, detail: "Offers are waiting in Commercial.", label: "View offers", onClick: go("FINANCES", { tab: "COMMERCIAL" }) });
    }
    if (tired.length >= 3) {
      items.push({ id: "fatigue", level: "medium", title: `${tired.length} players are carrying heavy fatigue`, detail: tired.slice(0, 3).map((player) => player.name).join(", "), label: "Medical room", onClick: go("INJURY_LIST") });
    }
    const report = seasonState.contractReport;
    if (report?.freeAgency?.length && Number(report.seasonYear) === seasonYear - 1) {
      items.push({ id: "free-agency", level: "low", title: "Free agency results are in", detail: `${report.freeAgency.length} of your players reached the market.`, label: "See results", onClick: go("FINANCES", { tab: "CONTRACTS" }) });
    }
    if (unread.length) {
      items.push({ id: "mail", level: "low", title: `${unread.length} unread message${unread.length === 1 ? "" : "s"}`, detail: unread[0].subject ?? "", label: "Open inbox", onClick: go("INBOX") });
    }
    if (phase === "POST_SEASON") {
      items.push({ id: "post-season", level: "medium", title: "The season is over", detail: "Review the season and move on to the next one.", label: "Season hub", onClick: go("SEASON") });
    }
    const order = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => order[a.level] - order[b.level]);
  }, [phase, nextMatch, selection, injuredSelected, finance, expiring, board, grade, administration, tired, seasonState.contractReport, seasonYear, unread, round, onNavigate]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const record = ladderRow ? `${ladderRow.wins}-${ladderRow.losses}${ladderRow.draws ? `-${ladderRow.draws}` : ""}` : "0-0";
  const phaseLabel = phase === "HOME_AND_AWAY" ? `Round ${Math.min(round, totalRounds)} of ${totalRounds}` : phase === "POST_SEASON" ? "Post-season" : phase === "WILDCARD" ? "Wildcard round" : "Finals";
  const isHome = nextMatch ? sideNames(nextMatch).home === club.name : false;
  const kpi = (label, value, note, tone) => (
    <Card palette={palette} key={label} style={{ padding: 16 }}>
      <div style={{ color: palette.muted, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.55rem", fontWeight: 800, color: tone ?? palette.text, marginTop: 4 }}>{value}</div>
      <div style={{ color: palette.muted, fontSize: "0.8rem", marginTop: 2 }}>{note}</div>
    </Card>
  );

  return (
    <main className="dash" style={{ color: palette.text, display: "grid", gap: 14, maxWidth: 1180 }}>
      <style>{`
        .dash button:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
        .dash .dash-row:hover { background: ${palette.raised}; }
      `}</style>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          padding: "16px 20px",
          borderRadius: 16,
          background: `linear-gradient(100deg, ${accent}33, ${palette.card} 70%)`,
          border: `1px solid ${palette.border}`,
          borderLeft: `6px solid ${accent}`,
        }}
      >
        <ClubBadge club={club.name} size={56} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0 }}><button type="button" onClick={() => onOpenClub(club.name)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>{club.name}</button></h2>
          <div style={{ color: palette.muted, fontSize: "0.9rem" }}>
            {phaseLabel} · Season {seasonYear}
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: palette.muted, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ladder</div>
            <strong style={{ fontSize: "1.3rem" }}>{position > 0 ? ordinal(position) : "—"}</strong>
            {positionChange !== null && positionChange !== 0 && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: positionChange > 0 ? "#22c55e" : "#ef4444" }} title="Change since last round">
                {positionChange > 0 ? "▲" : "▼"}{Math.abs(positionChange)}
              </span>
            )}
          </div>
          <div>
            <div style={{ color: palette.muted, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Record</div>
            <strong style={{ fontSize: "1.3rem" }}>{record}</strong>
          </div>
          <div>
            <div style={{ color: palette.muted, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Percentage</div>
            <strong style={{ fontSize: "1.3rem" }}>{Number(ladderRow?.percentage ?? 100).toFixed(1)}</strong>
          </div>
        </div>
        <button type="button" onClick={() => setShowDelegationPanel((value) => !value)} aria-expanded={showDelegationPanel} style={{ padding: "9px 14px", border: `1px solid ${showDelegationPanel ? activeButtonBackground : palette.border}`, borderRadius: 10, background: showDelegationPanel ? activeButtonBackground : palette.raised, color: showDelegationPanel ? activeButtonText : palette.text, fontWeight: 700, cursor: "pointer" }}>
          Delegation
        </button>
      </header>

      {showDelegationPanel && (
        <Card palette={palette} title="Delegation settings">
          <p style={{ color: palette.muted, fontSize: 13, margin: "0 0 14px" }}>
            Choose which football department functions your assistant coaching team handles automatically. Match day cannot be delegated.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button type="button" onClick={() => setAllDelegation(!allDelegationSelected)}
              style={{ padding: "8px 13px", border: "1px solid #16a34a", borderRadius: 8, background: allDelegationSelected ? "#166534" : "#16a34a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              {allDelegationSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "12px 14px", background: palette.raised, borderRadius: 10 }}>
              <div><strong>Training mode</strong><div style={{ color: palette.muted, fontSize: 13, marginTop: 3 }}>{assistantManagedTraining ? "Assistant coaches automatically schedule and run training." : "You select and schedule training sessions manually."}</div></div>
              {renderSwitch(assistantManagedTraining, "Assistant managed training", onTrainingModeChange)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "12px 14px", background: palette.raised, borderRadius: 10 }}>
              <div><strong>Team selection</strong><div style={{ color: palette.muted, fontSize: 13, marginTop: 3 }}>{selectionResponsibility === "ASSISTANT" ? "Assistant coaches select and confirm the team sheet for each round." : "You select and confirm the team sheet before each round."}</div></div>
              {renderSwitch(selectionResponsibility === "ASSISTANT", "Assistant managed team selection", enabled => onSelectionResponsibilityChange(enabled ? "ASSISTANT" : "COACH"))}
            </div>
            {delegationOptions.map((option) => (
              <div key={option.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "10px 14px", background: palette.raised, borderRadius: 8 }}>
                <div><strong style={{ fontSize: 14 }}>{option.label}</strong><div style={{ color: palette.muted, fontSize: 12, marginTop: 2 }}>{option.description}</div></div>
                {renderSwitch(Boolean(delegationSettings[option.id]), `Delegate ${option.label}`, enabled => onDelegationChange({ ...delegationSettings, [option.id]: enabled }))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next match */}
      <Card palette={palette} title="Next match" action={<LinkButton palette={palette} onClick={() => onNavigate("CALENDAR")}>Calendar</LinkButton>}>
        {nextMatch && opponent ? (
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <ClubBadge club={club.name} size={64} />
              <span style={{ color: palette.muted, fontWeight: 800 }}>{isHome ? "vs" : "at"}</span>
              <ClubBadge club={opponent.name} size={64} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800 }}><button type="button" onClick={() => onOpenClub(opponent.name)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>{opponent.name}</button></div>
              <div style={{ color: palette.muted, fontSize: "0.9rem" }}>
                {isHome ? "Home" : "Away"} · {nextMatch.venue ?? club.venue} · {nextMatch.date}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", fontSize: "0.85rem" }}>
                <span>Ladder <strong>{opponentPosition > 0 ? ordinal(opponentPosition) : "—"}</strong></span>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>Form <FormChips results={opponentForm} palette={palette} /></span>
              </div>
              {meeting && (
                <div style={{ marginTop: 8, color: palette.muted, fontSize: "0.85rem" }}>
                  Last meeting: {meeting.outcome === "W" ? "won" : meeting.outcome === "L" ? "lost" : "drew"} {meeting.own}–{meeting.opp} (Round {meeting.round}, {meeting.year})
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: 8, minWidth: 190 }}>
              <div style={{ fontSize: "0.82rem", color: selection.complete && !injuredSelected.length ? "#22c55e" : "#f59e0b", fontWeight: 700 }}>
                {!selection.complete ? `Team: ${selection.filled}/${selection.required} selected` : injuredSelected.length ? `${injuredSelected.length} injured in your side` : "Team selected"}
              </div>
              <button
                type="button"
                onClick={() => onPlayMatch(nextMatch)}
                style={{ padding: "11px 16px", border: "none", borderRadius: 10, background: "#ea580c", color: "#fff", fontWeight: 800, cursor: "pointer" }}
              >
                {selection.complete ? "Play match" : "Select team and play"}
              </button>
              <button
                type="button"
                onClick={() => onNavigate("SQUAD")}
                style={{ padding: "9px 14px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.raised, color: palette.text, fontWeight: 700, cursor: "pointer" }}
              >
                Team selection
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: palette.muted }}>
            {phase === "POST_SEASON"
              ? "The season is complete."
              : phase === "HOME_AND_AWAY"
                ? `You have the bye in Round ${round}.`
                : "Finals fixtures are in the Season Hub."}{" "}
            <LinkButton palette={palette} accent={accent} onClick={() => onNavigate("SEASON")}>Open Season Hub</LinkButton>
          </div>
        )}
      </Card>

      {/* Attention + form/ladder */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <Card palette={palette} title="Needs your attention">
          {attention.length === 0 ? (
            <div style={{ color: palette.muted }}>All clear. Nothing needs a decision right now.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
              {attention.map((item) => (
                <li
                  key={item.id}
                  className="dash-row"
                  style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 10px", borderRadius: 10, borderLeft: `4px solid ${SEVERITY[item.level].colour}` }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{item.title}</div>
                    {item.detail && <div style={{ color: palette.muted, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis" }}>{item.detail}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={item.onClick}
                    style={{ flexShrink: 0, padding: "6px 12px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.raised, color: palette.text, fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card palette={palette} title="Form and ladder" action={<LinkButton palette={palette} onClick={() => onNavigate("SEASON")}>Full ladder</LinkButton>}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ color: palette.muted, fontSize: "0.85rem" }}>Last 5</span>
            <FormChips results={myResults.slice(-5)} palette={palette} />
          </div>
          {miniLadder.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ color: palette.muted, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px", width: 28 }}>#</th>
                  <th style={{ padding: "4px 6px" }}>Club</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Pts</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {miniLadder.map((row) => (
                  <tr key={row.club} style={{ background: row.club === club.name ? `${accent}30` : "transparent", fontWeight: row.club === club.name ? 800 : 400 }}>
                    <td style={{ padding: "5px 6px" }}>{row.position}</td>
                    <td style={{ padding: "5px 6px" }}><button type="button" onClick={() => onOpenClub(row.club)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>{row.club}</button></td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{row.points}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{Number(row.percentage ?? 100).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: palette.muted }}>The ladder starts after Round 1.</div>
          )}
        </Card>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        {kpi("Cap space", money(finance.remainingCap), `${money(finance.playerPayments)} of ${money(finance.salaryCap)} cap`, finance.remainingCap < 0 ? "#ef4444" : undefined)}
        {kpi("Cash", money(finance.cashBalance), `${money(finance.projectedEndBalance)} projected at season end`, finance.cashBalance < 0 ? "#ef4444" : undefined)}
        {kpi("Squad", `${available}/${roster.length}`, injuredPlayers.length ? `${injuredPlayers.length} injured` : "Everyone available", injuredPlayers.length ? "#f59e0b" : undefined)}
        {kpi("Board", grade, `${board.score}/100${board.trend ? ` · ${board.trend > 0 ? "up" : "down"} ${Math.abs(board.trend)}` : ""}`, board.score < 65 ? "#ef4444" : board.score >= 82 ? "#22c55e" : undefined)}
      </div>

      {/* Squad, coming up, news */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Card palette={palette} title="Squad" action={<LinkButton palette={palette} onClick={() => onNavigate("INJURY_LIST")}>Medical room</LinkButton>}>
          {bestPlayer && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: palette.muted, fontSize: "0.75rem" }}>Highest rated, available</div>
              <strong>{bestPlayer.name}</strong> <span style={{ color: palette.muted }}>OVR {bestPlayer.overall}</span>
            </div>
          )}
          {riser && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: palette.muted, fontSize: "0.75rem" }}>Biggest improver</div>
              <strong>{riser.player.name}</strong> <span style={{ color: "#22c55e" }}>+{riser.change}</span>
            </div>
          )}
          <div style={{ color: palette.muted, fontSize: "0.75rem", marginBottom: 4 }}>{injuredPlayers.length ? "Injured" : "Injuries"}</div>
          {injuredPlayers.length === 0 ? (
            <div style={{ fontSize: "0.85rem" }}>No one is missing.</div>
          ) : (
            injuredPlayers.slice(0, 4).map(({ player, injury }) => (
              <div key={player.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "2px 0" }}>
                <span>{player.name}</span>
                <span style={{ color: palette.muted }}>{injury.name} · {injury.weeksRemaining}w</span>
              </div>
            ))
          )}
        </Card>

        <Card palette={palette} title="Coming up" action={<LinkButton palette={palette} onClick={() => onNavigate("CALENDAR")}>Calendar</LinkButton>}>
          {comingUp.length === 0 ? (
            <div style={{ color: palette.muted }}>Nothing scheduled.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {comingUp.map((event) => (
                <li key={event.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{ flexShrink: 0, minWidth: 54, color: palette.muted, fontSize: "0.78rem" }}>
                    {new Date(event.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                  <span style={{ fontSize: "0.88rem" }}>{event.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card palette={palette} title="Latest news" action={<LinkButton palette={palette} onClick={() => onNavigate("INBOX")}>Inbox</LinkButton>}>
          {mail.length === 0 ? (
            <div style={{ color: palette.muted }}>No news yet. Messages appear after your first match.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {mail.slice(0, 3).map((message) => (   /* createInboxMail returns newest first */
                <li key={message.id}>
                  <div style={{ fontWeight: readMessageIds.includes(message.id) ? 500 : 800, fontSize: "0.88rem" }}>{message.subject}</div>
                  <div style={{ color: palette.muted, fontSize: "0.8rem" }}>{message.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
