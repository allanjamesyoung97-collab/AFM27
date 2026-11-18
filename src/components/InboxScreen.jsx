import { useEffect, useState } from "react";
import { ensureMatchCoachesVotes } from "../engine/statisticsEngine.js";
import ClubBadge from "./ClubBadge.jsx";

const MAIL_FILTERS = [
  ["ALL", "All mail"],
  ["MATCH", "Match"],
  ["TRADES", "Trades"],
  ["OFFSEASON", "Offseason"],
  ["AWARDS", "Awards"],
  ["MEDICAL", "Injuries/Suspensions"],
  ["CLUB_UPDATES", "Club Updates"],
];

function mailCategory(message) {
  const type = message?.type ?? "";
  const subject = `${message?.subject ?? ""} ${message?.heading ?? ""}`.toLowerCase();
  if (type === "MATCH_RESULT" || /match report|match result|match preview|\bround \d+ vote results/.test(subject)) return "MATCH";
  if (["TRADE_OFFER", "AI_TRADE_NEWS", "TRADE_PERIOD_ROUNDUP"].includes(type) || /trade offer|trade period|trades completed|league trade|free agency/.test(subject)) {
    if (type === "AI_TRADE_NEWS" && /draft selection|draft pick|national draft/.test(subject)) return "OFFSEASON";
    return "TRADES";
  }
  if (type === "RETIREMENT_NEWS" || /retir|contract|renewal|retention|contract expiry/.test(subject)) return "OFFSEASON";
  if (["INJURY_UPDATE", "TRIBUNAL"].includes(type) || /injur|suspension|tribunal|match review/.test(subject)) return "MEDICAL";
  if (type === "AFLCA_VOTES" || /brownlow|medal|award|coaches.? votes/.test(subject)) return "AWARDS";
  if (type === "SEASON_UPDATE" || type === "CALENDAR_EVENT") return "CLUB_UPDATES";
  return "CLUB_UPDATES";
}

const MAIL_CATEGORY_LABELS = {
  MATCH: "Match", TRADES: "Trades", OFFSEASON: "Offseason", AWARDS: "Awards",
  MEDICAL: "Injuries/Suspensions", CLUB_UPDATES: "Club Updates",
};

function makeResultMessage(result, id, heading, date) {
  const review = result.matchReview;
  const best = review?.bestPlayer;
  return {
    id,
    type: "MATCH_RESULT",
    heading: "Match Result",
    subject: heading,
    date: result.date ?? date,
    summary: `${result.homeTeam} ${result.homeScore} — ${result.awayScore} ${result.awayTeam}`,
    detail: [result.venue, review?.summary, best ? `Best on ground: ${best.name} (${best.club})` : null, review?.tacticalSummary ? `Game plans: ${review.tacticalSummary}` : null, result.extraTime ? "Decided in extra time" : null].filter(Boolean).join("\n"),
  };
}

function groupTradeRoundupByClub(transactions = []) {
  const groups = new Map();
  const getGroup = (clubName) => {
    if (!clubName) return null;
    if (!groups.has(clubName)) groups.set(clubName, { clubName, playersIn: [], playersOut: [], picksIn: [], picksOut: [] });
    return groups.get(clubName);
  };

  for (const transaction of transactions) {
    for (const move of transaction.playerMoves ?? []) {
      getGroup(move.toClub)?.playersIn.push({ name: move.playerName, freeAgent: Boolean(move.freeAgent) });
      getGroup(move.fromClub)?.playersOut.push(move.playerName);
    }
    for (const move of transaction.pickMoves ?? []) {
      getGroup(move.toClub)?.picksIn.push(move.pickName);
      getGroup(move.fromClub)?.picksOut.push(move.pickName);
    }
  }

  return [...groups.values()].sort((a, b) => a.clubName.localeCompare(b.clubName));
}

function inboxMessageTimestamp(message, seasonState) {
  const explicit = [message.receivedAt, message.createdAt, message.timestamp, message.date]
    .map((value) => value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value ?? ""))
    .find(Number.isFinite);
  if (explicit != null) return explicit;

  const text = `${message.heading ?? ""} ${message.subject ?? ""} ${message.date ?? ""} ${message.id ?? ""}`;
  const roundMatch = text.match(/round[-\s·]*(\d+)/i);
  if (roundMatch) {
    const roundNumber = Number(roundMatch[1]);
    const round = (seasonState.roundHistory ?? []).find((entry) => Number(entry.round) === roundNumber);
    const roundDate = (round?.results ?? []).map((result) => Date.parse(result.date ?? ""))
      .find(Number.isFinite);
    if (roundDate != null) return roundDate;
    const yearMatch = text.match(/20\d{2}/);
    const year = Number(yearMatch?.[0] ?? seasonState.seasonYear ?? 2027);
    return new Date(year, 2, 18 + (roundNumber - 1) * 7).getTime();
  }

  const seasonDate = Date.parse(seasonState.currentDate ?? seasonState.date ?? "");
  return Number.isFinite(seasonDate) ? seasonDate : 0;
}

/** Build mail from real match events, plus event mail supplied by future career systems. */
export function createInboxMail(club, seasonState) {
  if (!club || !seasonState) return [];
  const mail = [];

  for (const round of seasonState.roundHistory ?? []) {
    const completedMatches = (round.results ?? []).map((match) => ensureMatchCoachesVotes(match));
    const result = completedMatches.find((match) => match.homeTeam === club.name || match.awayTeam === club.name);
    if (result) {
      mail.push(makeResultMessage(result, `round-${seasonState.seasonYear}-${round.round}`, "Home & away result", `Round ${round.round}`));
    }
    if (completedMatches.some((match) => match.coachesVotes?.totals?.length)) {
      const votesByPlayer = new Map();
      for (const match of completedMatches) {
        for (const vote of match.coachesVotes?.totals ?? []) {
          const entry = votesByPlayer.get(String(vote.playerId)) ?? { ...vote, votes: 0 };
          entry.votes += vote.votes;
          votesByPlayer.set(String(vote.playerId), entry);
        }
      }
      for (const previousRound of (seasonState.roundHistory ?? []).filter((entry) => entry.round <= round.round)) {
        if (previousRound.round === round.round) continue;
        for (const rawMatch of previousRound.results ?? []) for (const vote of ensureMatchCoachesVotes(rawMatch).coachesVotes?.totals ?? []) {
          const entry = votesByPlayer.get(String(vote.playerId)) ?? { ...vote, votes: 0 };
          entry.votes += vote.votes;
          votesByPlayer.set(String(vote.playerId), entry);
        }
      }
      const leaderboard = [...votesByPlayer.values()].sort((a, b) => b.votes - a.votes).slice(0, 10);
      const matchSummaries = completedMatches.map((match) => ({
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        bestPlayer: match.coachesVotes?.bestPlayer?.playerName ?? "—",
        votes: (match.coachesVotes?.totals ?? []).slice().sort((a, b) => b.votes - a.votes),
      }));
      const topTen = leaderboard.map((player, index) => `${index + 1}. ${player.playerName} · ${player.club} · ${player.votes} votes`).join("\n");
      mail.push({
        id: `aflca-${seasonState.seasonYear}-${round.round}`,
        type: "AFLCA_VOTES",
        heading: "Coaches’ votes",
        subject: `Round ${round.round} vote results`,
        date: `Round ${round.round}`,
        summary: `${completedMatches.length} matches · Season leader: ${leaderboard[0]?.playerName ?? "Votes available"}${leaderboard[0] ? ` (${leaderboard[0].votes})` : ""}`,
        detail: `Round results\n${matchSummaries.map((match) => `${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam} · Best: ${match.bestPlayer} · Votes: ${match.votes.map((vote) => `${vote.playerName} ${vote.votes}`).join(", ")}`).join("\n")}\n\nSeason leaderboard\n${topTen || "Votes will appear here."}`,
        aflca: { matches: matchSummaries, leaderboard },
      });
    }
  }

  const latestRound = [...(seasonState.roundHistory ?? [])].sort((a, b) => Number(b.round) - Number(a.round))[0];
  if (latestRound && [1, 6, 12, 18, 23].includes(Number(latestRound.round))) {
    const ladderPosition = (seasonState.ladder ?? []).findIndex((entry) => entry.club === club.name) + 1;
    const totalClubs = (seasonState.ladder ?? []).length || 18;
    const inFinalsPlaces = ladderPosition > 0 && ladderPosition <= 8;
    const subject = inFinalsPlaces ? "Finals position within reach" : "Board pressure checkpoint";
    mail.push({
      id: `milestone-${seasonState.seasonYear}-${latestRound.round}-${club.name}`,
      type: "SEASON_UPDATE",
      heading: "Season milestone",
      subject,
      date: `Round ${latestRound.round}`,
      summary: `${club.name} are ${ladderPosition ? `${ladderPosition}${ladderPosition === 1 ? "st" : ladderPosition === 2 ? "nd" : ladderPosition === 3 ? "rd" : "th"}` : "unplaced"} on the ladder.`,
      detail: inFinalsPlaces
        ? `The club is currently inside the top eight. The Board's finals objective is on track with ${Math.max(0, 23 - Number(latestRound.round))} home-and-away rounds remaining.`
        : `The club is outside the top eight of ${totalClubs}. The Board expects a response over the remaining rounds. Review form, player roles and the match plan.`,
    });
  }

  for (const result of seasonState.wildcardResults ?? []) {
    if (result.homeTeam === club.name || result.awayTeam === club.name) {
      mail.push(makeResultMessage(result, `wildcard-${seasonState.seasonYear}-${result.code}`, "Wildcard result", "Wildcard round"));
    }
  }

  for (const week of seasonState.finalsHistory ?? []) {
    const result = week.results?.find((match) => match.homeTeam === club.name || match.awayTeam === club.name);
    if (result) {
      mail.push(makeResultMessage(result, `final-${seasonState.seasonYear}-${result.code}`, week.label, week.label));
    }
  }

  for (const item of seasonState.mailMessages ?? []) {
    const type = ["CALENDAR_EVENT", "INJURY_UPDATE", "TRADE_OFFER", "AI_TRADE_NEWS", "AFLCA_VOTES", "RETIREMENT_NEWS", "TRADE_PERIOD_ROUNDUP", "TRIBUNAL"].includes(item.type) ? item.type : null;
    if (!type) continue;
    const retirementYear = Number(String(item.subject ?? item.date ?? item.id ?? "").match(/20\d{2}/)?.[0] ?? seasonState.seasonYear);
    const historyEntries = (seasonState.retirementHistory ?? [])
      .filter((record) => Number(record.seasonYear) === retirementYear)
      .map(({ playerName, club }) => ({ playerName, club }));
    const legacyDetailEntries = String(item.detail ?? item.body ?? "")
      .split("\n")
      .map((line) => {
        const match = line.match(/^(.+?)\s+\((.+?),\s*age\s+\d+\)\s+has retired/i);
        return match ? { playerName: match[1].trim(), club: match[2].trim() } : null;
      })
      .filter(Boolean);
    const retirementEntries = type === "RETIREMENT_NEWS"
      ? (Array.isArray(item.retirements) && item.retirements.length
        ? item.retirements
        : historyEntries.length ? historyEntries : legacyDetailEntries)
      : undefined;
    mail.push({
      ...item,
      type,
      ...(type === "RETIREMENT_NEWS" ? {
        subject: `Retiring class of ${retirementYear}`,
        retirements: retirementEntries,
      } : {}),
      summary: item.summary ?? item.subject,
      detail: item.detail ?? item.body,
      heading: type === "CALENDAR_EVENT" ? "Club update" : type === "INJURY_UPDATE" ? "Injury update"
        : type === "TRADE_OFFER" ? "Trade offer"
          : type === "AI_TRADE_NEWS" ? "League trade"
          : type === "TRADE_PERIOD_ROUNDUP" ? "Trades completed"
          : type === "RETIREMENT_NEWS" ? "Retiring class"
          : `AFLCA votes · Round ${item.round}`,
    });
  }

  return mail
    .map((message, index) => {
      const category = mailCategory(message);
      return { message: { ...message, category, heading: MAIL_CATEGORY_LABELS[category] ?? message.heading }, index, timestamp: inboxMessageTimestamp(message, seasonState) };
    })
    .sort((a, b) => b.timestamp - a.timestamp || b.index - a.index)
    .map(({ message }) => message)
    .filter((message) => !(seasonState.deletedInboxMessageIds ?? []).includes(message.id));
}

/** Coach insights are generated from completed results; player conversations can be added as chat events. */
export function createInboxChats(club, seasonState) {
  if (!club || !seasonState) return [];
  const events = [];
  for (const round of seasonState.roundHistory ?? []) {
    const result = round.results?.find((match) => match.homeTeam === club.name || match.awayTeam === club.name);
    if (result) events.push({ result, id: `coach-round-${seasonState.seasonYear}-${round.round}`, title: `Round ${round.round} review`, date: result.date ?? `Round ${round.round}` });
  }
  for (const result of seasonState.wildcardResults ?? []) {
    if (result.homeTeam === club.name || result.awayTeam === club.name) events.push({ result, id: `coach-wildcard-${seasonState.seasonYear}-${result.code}`, title: "Wildcard review", date: "Wildcard round" });
  }
  for (const week of seasonState.finalsHistory ?? []) {
    const result = week.results?.find((match) => match.homeTeam === club.name || match.awayTeam === club.name);
    if (result) events.push({ result, id: `coach-final-${seasonState.seasonYear}-${result.code}`, title: week.label, date: week.label });
  }

  const coachNotes = events.map(({ result, id, title, date }) => {
    const isHome = result.homeTeam === club.name;
    const clubScore = isHome ? result.homeScore : result.awayScore;
    const opponentScore = isHome ? result.awayScore : result.homeScore;
    const margin = clubScore - opponentScore;
    const review = result.matchReview;
    const factor = review?.decisiveFactor;
    const tacticalOutcome = review?.tacticalOutcomes?.find((entry) => entry.club === club.name);
    const rivalryPairs = [["Collingwood", "Carlton"], ["Collingwood", "Essendon"], ["Carlton", "Richmond"], ["Adelaide", "Port Adelaide"], ["Sydney", "GWS"], ["Brisbane", "Gold Coast"], ["West Coast", "Fremantle"], ["Geelong", "Hawthorn"], ["Melbourne", "Western Bulldogs"], ["St Kilda", "North Melbourne"]];
    const opponent = isHome ? result.awayTeam : result.homeTeam;
    const isRivalry = rivalryPairs.some((pair) => pair.includes(club.name) && pair.includes(opponent));
    const rivalryNote = isRivalry ? (margin > 0 ? ` We take the rivalry points from ${opponent}.` : margin < 0 ? `${opponent} have the bragging rights until we meet again.` : `Rivalry honours are shared with ${opponent}.`) : "";
    const insight = review
      ? `${review.outcomeText} ${factor ? `${factor.leader} controlled ${factor.label} (${factor.home}–${factor.away}).` : "The key team statistics were even."} ${tacticalOutcome?.summary ?? (review.tacticalSummary ? `Our plan: ${review.tacticalSummary.split(" · ").find((plan) => plan.startsWith(`${club.name}:`))?.replace(`${club.name}: `, "") ?? "review the match report for the tactical comparison."}` : "Review the match report for the tactical comparison.")}`
      : margin < 0
        ? "We conceded more than we scored. Before the next match, review our defensive pressure and stoppage shape."
        : margin >= 36
          ? "A strong result. Keep the approach that worked and review how we can carry that form into next week."
          : "A close result. Let’s review our ball movement and contest decisions before next week.";
    return {
      id,
      sender: "Head of Football Strategy and Coaching",
      subject: title,
      date,
      body: `${insight}${rivalryNote}`,
      bestPerformer: review?.bestPlayer?.name ?? result.coachesVotes?.bestPlayer?.playerName ?? null,
      relatedResult: `${result.homeTeam} ${result.homeScore} — ${result.awayScore} ${result.awayTeam}`,
    };
  });

  const deletedIds = seasonState.deletedInboxMessageIds ?? [];
  return [...coachNotes, ...(seasonState.chatMessages ?? [])]
    .filter((message) => !deletedIds.includes(message.id))
    .reverse();
}

export default function InboxScreen({
  appearance = "dark",
  club,
  seasonState,
  readMessageIds = [],
  onMarkRead,
  onMarkAllRead,
  onResolveChat,
  onDeleteMessages,
  navigationTab = null,
  navigationSequence = 0,
}) {
  const [section, setSection] = useState("MAIL");
  useEffect(() => { if (navigationTab) setSection(navigationTab); }, [navigationSequence, navigationTab]);
  const [mailFilter, setMailFilter] = useState("ALL");
  const [selectedMailIds, setSelectedMailIds] = useState([]);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const lightMode = appearance === "light";
  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc",
    muted: lightMode ? "#64748b" : "#94a3b8",
    card: lightMode ? "#ffffff" : "#0f172a",
    surface: lightMode ? "#f1f5f9" : "#111c30",
    border: lightMode ? "#cbd5e1" : "#334155",
    selected: lightMode ? "#ffedd5" : "#431407",
  };
  const mail = createInboxMail(club, seasonState);
  const chats = createInboxChats(club, seasonState);
  const unreadMail = mail.filter((message) => !readMessageIds.includes(message.id));
  const unreadChat = chats.filter((message) => !readMessageIds.includes(message.id));
  const visibleMail = mailFilter === "ALL" ? mail : mail.filter((message) => (message.category ?? mailCategory(message)) === mailFilter);
  const selectedIds = section === "MAIL" ? selectedMailIds : selectedChatIds;
  const sectionMessages = section === "MAIL" ? visibleMail : chats;
  const setSectionSelectedIds = section === "MAIL" ? setSelectedMailIds : setSelectedChatIds;
  const allVisibleSelected = sectionMessages.length > 0 && sectionMessages.every((message) => selectedIds.includes(message.id));
  const toggleSelectAll = (checked) => setSectionSelectedIds((current) => checked
    ? [...new Set([...current, ...sectionMessages.map((message) => message.id)])]
    : current.filter((id) => !sectionMessages.some((message) => message.id === id)));
  const toggleMessageSelected = (id, checked) => setSectionSelectedIds((current) => checked
    ? [...new Set([...current, id])]
    : current.filter((messageId) => messageId !== id));
  const deleteSelected = () => {
    if (!selectedIds.length) return;
    onDeleteMessages?.(selectedIds);
    setSectionSelectedIds([]);
  };
  const cardStyle = {
    padding: 16,
    marginBottom: 10,
    border: `1px solid ${palette.border}`,
    borderLeft: `4px solid ${palette.border}`,
    borderRadius: 12,
    background: palette.card,
    color: palette.text,
  };
  const sectionButtonStyle = (key) => ({
    padding: "10px 16px",
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    color: section === key ? (lightMode ? "#9a3412" : "#fed7aa") : palette.text,
    background: section === key ? palette.selected : palette.card,
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <main style={{ color: palette.text }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Inbox</h2>
          <p style={{ color: palette.muted, margin: 0 }}>
            {section === "MAIL" ? `${unreadMail.length} unread mail` : `${unreadChat.length} unread chat${unreadChat.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div role="tablist" aria-label="Inbox sections" style={{ display: "flex", gap: 8 }}>
          <button type="button" role="tab" aria-selected={section === "MAIL"} onClick={() => setSection("MAIL")} style={sectionButtonStyle("MAIL")}>Mail{unreadMail.length > 0 ? ` (${unreadMail.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={section === "CHAT"} onClick={() => setSection("CHAT")} style={sectionButtonStyle("CHAT")}>Chat{unreadChat.length > 0 ? ` (${unreadChat.length})` : ""}</button>
        </div>
      </div>

      {section === "MAIL" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12, padding: "10px 12px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.card }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette.text, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" aria-label="Select all visible mail" checked={allVisibleSelected} onChange={(event) => toggleSelectAll(event.target.checked)} />
              Select all{mailFilter !== "ALL" ? " shown" : ""}
            </label>
            <span style={{ color: palette.muted, fontSize: 12 }}>{selectedMailIds.length} selected</span>
            <button type="button" onClick={deleteSelected} disabled={!selectedMailIds.length} style={{ marginLeft: "auto", padding: "8px 12px", border: 0, borderRadius: 8, background: selectedMailIds.length ? "#dc2626" : palette.surface, color: selectedMailIds.length ? "#fff" : palette.muted, cursor: selectedMailIds.length ? "pointer" : "not-allowed", fontWeight: 750 }}>Delete selected</button>
          </div>
          <nav aria-label="Filter mail" style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {MAIL_FILTERS.map(([filter, label]) => (
              <button key={filter} type="button" aria-pressed={mailFilter === filter} onClick={() => setMailFilter(filter)} style={{ padding: "8px 11px", border: `1px solid ${mailFilter === filter ? "#ea580c" : palette.border}`, borderRadius: 999, background: mailFilter === filter ? "#ea580c" : palette.card, color: mailFilter === filter ? "#fff" : palette.text, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{label}</button>
            ))}
            <button type="button" onClick={() => onMarkAllRead(mail.map((message) => message.id))} disabled={!unreadMail.length} style={{ marginLeft: "auto", padding: "8px 11px", border: `1px solid ${palette.border}`, borderRadius: 9, background: palette.card, color: unreadMail.length ? palette.text : palette.muted, cursor: unreadMail.length ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12 }}>Mark all read</button>
          </nav>

          {visibleMail.length ? visibleMail.map((message) => {
            const unread = !readMessageIds.includes(message.id);
            return (
              <article key={message.id} style={{ ...cardStyle, borderLeftColor: unread ? "#ea580c" : palette.border, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input type="checkbox" aria-label={`Select ${message.subject}`} checked={selectedMailIds.includes(message.id)} onChange={(event) => toggleMessageSelected(message.id, event.target.checked)} style={{ marginTop: 4, flexShrink: 0 }} />
                <div style={{ display: "flex", flex: 1, minWidth: 0, justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <details style={{ flex: 1, minWidth: 0 }}>
                    <summary style={{ cursor: "pointer", listStylePosition: "inside", color: palette.text }}>
                      <span style={{ display: "block", color: palette.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>{message.heading} · {message.date}</span>
                      <strong style={{ display: "block", margin: "0 0 4px", color: palette.text }}>{message.subject}</strong>
                      <strong style={{ display: "block", color: palette.text }}>{message.summary}</strong>
                    </summary>
                    {message.type === "AFLCA_VOTES" && message.aflca ? (
                      <div style={{ marginTop: 14, display: "grid", gap: 18 }}>
                        <section>
                          <h4 style={{ margin: "0 0 9px", color: palette.text, fontSize: 14, fontWeight: 750 }}>Round results</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 9 }}>
                            {message.aflca.matches.map((match, index) => (
                              <div key={`${match.homeTeam}-${match.awayTeam}-${index}`} style={{ padding: 12, border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.surface }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, color: palette.text, fontSize: 13, fontWeight: 750 }}>
                                  <span>{match.homeTeam} {match.homeScore} <span style={{ color: palette.muted, fontWeight: 500 }}>—</span> {match.awayScore} {match.awayTeam}</span>
                                </div>
                                <div style={{ marginTop: 7, color: palette.muted, fontSize: 12 }}>Best on ground · <strong style={{ color: palette.text, fontWeight: 650 }}>{match.bestPlayer}</strong></div>
                                {!!match.votes.length && <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {match.votes.map((vote) => <span key={`${vote.playerId}-${vote.playerName}`} style={{ padding: "3px 7px", borderRadius: 999, background: lightMode ? "#e2e8f0" : "#1e293b", color: palette.text, fontSize: 11 }}>{vote.playerName} <strong>{vote.votes}</strong></span>)}
                                </div>}
                              </div>
                            ))}
                          </div>
                        </section>
                        <section>
                          <h4 style={{ margin: "0 0 8px", color: palette.text, fontSize: 14, fontWeight: 750 }}>Season leaderboard</h4>
                          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, overflow: "hidden" }}>
                            {message.aflca.leaderboard.map((player, index) => (
                              <div key={player.playerId} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", alignItems: "center", gap: 9, padding: "7px 10px", borderBottom: index < message.aflca.leaderboard.length - 1 ? `1px solid ${palette.border}` : 0, background: index % 2 === 0 ? palette.card : palette.surface, fontSize: 12 }}>
                                <span style={{ color: palette.muted }}>{index + 1}</span>
                                <span style={{ color: palette.text, minWidth: 0 }}><strong>{player.playerName}</strong><span style={{ color: palette.muted }}> · {player.club}</span></span>
                                <strong style={{ color: palette.text }}>{player.votes}</strong>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    ) : message.type === "TRADE_PERIOD_ROUNDUP" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginTop: 12 }}>
                        {groupTradeRoundupByClub(message.tradeRoundup?.transactions ?? []).map((group) => {
                          const hasAssets = group.playersIn.length || group.playersOut.length || group.picksIn.length || group.picksOut.length;
                          return (
                            <section key={group.clubName} style={{ padding: "10px 12px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.surface }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: palette.text, fontSize: 12, fontWeight: 750 }}>
                                <ClubBadge club={group.clubName} size={20} />
                                <span>{group.clubName}</span>
                              </div>
                              {hasAssets ? <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                                {(group.playersIn.length || group.picksIn.length) > 0 && <div>
                                  <strong style={{ color: palette.text }}>Arrived</strong>
                                  <div style={{ display: "grid", gap: 3, marginTop: 3, color: palette.muted }}>
                                    {group.playersIn.map((player, index) => <span key={`in-${index}-${player.name}`}>{player.name}{player.freeAgent ? <em style={{ color: palette.text, fontStyle: "normal" }}> · Free agent</em> : null}</span>)}
                                    {group.picksIn.map((pickName, index) => <span key={`pick-in-${index}-${pickName}`}>{pickName} · Draft pick</span>)}
                                  </div>
                                </div>}
                                {(group.playersOut.length || group.picksOut.length) > 0 && <div>
                                  <strong style={{ color: palette.text }}>Departed</strong>
                                  <div style={{ display: "grid", gap: 3, marginTop: 3, color: palette.muted }}>
                                    {group.playersOut.map((playerName, index) => <span key={`out-${index}-${playerName}`}>{playerName}</span>)}
                                    {group.picksOut.map((pickName, index) => <span key={`pick-out-${index}-${pickName}`}>{pickName} · Draft pick</span>)}
                                  </div>
                                </div>}
                              </div> : <span style={{ color: palette.muted, fontSize: 12 }}>No assets moved.</span>}
                            </section>
                          );
                        })}
                        {!message.tradeRoundup?.transactions?.length && <p style={{ gridColumn: "1 / -1", margin: 0, color: palette.muted, fontSize: 13 }}>No completed trades or free-agent signings were recorded this week.</p>}
                      </div>
                    ) : message.type === "RETIREMENT_NEWS" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 12 }}>
                        {Object.entries((message.retirements ?? []).reduce((groups, retirement) => {
                          const clubName = retirement.club || "Unattached";
                          (groups[clubName] ??= []).push(retirement.playerName);
                          return groups;
                        }, {})).sort(([clubA], [clubB]) => clubA.localeCompare(clubB)).map(([clubName, playerNames]) => (
                          <section key={clubName} style={{ padding: "10px 12px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.surface }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, color: palette.text, fontSize: 12, fontWeight: 750 }}>
                              <ClubBadge club={clubName} size={20} />
                              <span>{clubName}</span>
                            </div>
                            <div style={{ display: "grid", gap: 3, color: palette.muted, fontSize: 12 }}>
                              {[...playerNames].sort((a, b) => a.localeCompare(b)).map((playerName) => <span key={playerName}>{playerName}</span>)}
                            </div>
                          </section>
                        ))}
                        {!message.retirements?.length && <p style={{ gridColumn: "1 / -1", margin: 0, color: palette.muted, fontSize: 13 }}>No player names were recorded for this retiring class.</p>}
                      </div>
                    ) : message.detail && <div style={{ color: palette.muted, fontSize: 13, lineHeight: 1.55, marginTop: 12, paddingLeft: 22, whiteSpace: "pre-line" }}>{message.detail}</div>}
                  </details>
                  {unread && <button type="button" onClick={() => onMarkRead(message.id)} style={{ flexShrink: 0, padding: "7px 10px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.surface, color: palette.text, cursor: "pointer", fontSize: 12 }}>Mark read</button>}
                </div>
              </article>
            );
          }) : (
            <section style={{ ...cardStyle, color: palette.muted }}>
              {mailFilter === "ALL"
                ? `No mail yet. Match results for ${club?.name ?? "your club"} will appear here.`
                : `No ${MAIL_FILTERS.find(([filter]) => filter === mailFilter)?.[1].toLowerCase()} messages yet.`}
            </section>
          )}
        </>
      ) : (
        <>
          <section style={{ ...cardStyle, background: palette.surface, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><strong>Private team conversations</strong><div style={{ color: palette.muted, fontSize: 13, marginTop: 4 }}>Player requests and coach tactical insights appear here.</div></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {unreadChat.length > 0 && <button type="button" onClick={() => onMarkAllRead(chats.map((chat) => chat.id))} style={{ padding: "9px 12px", border: `1px solid ${palette.border}`, borderRadius: 9, background: palette.card, color: palette.text, cursor: "pointer", fontWeight: 700 }}>Mark all chats read</button>}
              </div>
            </div>
          </section>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12, padding: "10px 12px", border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.card }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette.text, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" aria-label="Select all chats" checked={allVisibleSelected} onChange={(event) => toggleSelectAll(event.target.checked)} />
              Select all chats
            </label>
            <span style={{ color: palette.muted, fontSize: 12 }}>{selectedChatIds.length} selected</span>
            <button type="button" onClick={deleteSelected} disabled={!selectedChatIds.length} style={{ marginLeft: "auto", padding: "8px 12px", border: 0, borderRadius: 8, background: selectedChatIds.length ? "#dc2626" : palette.surface, color: selectedChatIds.length ? "#fff" : palette.muted, cursor: selectedChatIds.length ? "pointer" : "not-allowed", fontWeight: 750 }}>Delete selected</button>
          </div>
          {chats.length ? chats.map((chat) => {
            const unread = !readMessageIds.includes(chat.id);
            return (
              <article key={chat.id} style={{ ...cardStyle, borderLeftColor: unread ? "#ea580c" : palette.border, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input type="checkbox" aria-label={`Select ${chat.subject}`} checked={selectedChatIds.includes(chat.id)} onChange={(event) => toggleMessageSelected(chat.id, event.target.checked)} style={{ marginTop: 4, flexShrink: 0 }} />
                <div style={{ display: "flex", flex: 1, minWidth: 0, justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ color: palette.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{chat.sender} · {chat.date}</div>
                    <h3 style={{ margin: "7px 0" }}>{chat.subject}</h3>
                    <p style={{ lineHeight: 1.55, margin: "0 0 8px" }}>{chat.body}</p>
                    {chat.responseText && <p style={{ color: palette.muted, margin: "0 0 8px" }}><strong>Your response:</strong> {chat.responseText}</p>}
                    <div style={{ color: palette.muted, fontSize: 13 }}>{chat.relatedResult}</div>
                  </div>
                  {unread && <button type="button" onClick={() => onMarkRead(chat.id)} style={{ flexShrink: 0, padding: "7px 10px", border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.surface, color: palette.text, cursor: "pointer", fontSize: 12 }}>Mark read</button>}
                </div>
                {chat.type === "PLAYER_REQUEST" && chat.status === "PENDING" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{(chat.responseOptions ?? [{ value: "PROMISE_MINUTES", label: "Promise more minutes" }, { value: "DEVELOPMENT_PLAN", label: "Discuss development plan" }]).map((option, index) => <button key={option.value} type="button" onClick={() => onResolveChat?.(chat.id, option.value)} style={{ padding: "8px 12px", border: index === 0 ? 0 : `1px solid ${palette.border}`, borderRadius: 8, background: index === 0 ? "#16a34a" : palette.surface, color: index === 0 ? "white" : palette.text, cursor: "pointer", fontWeight: 700 }}>{option.label}</button>)}</div>}
                {chat.type === "PROMISE_OUTCOME" && <div style={{ marginTop: 8, color: chat.subject.startsWith("Promise kept") ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{chat.subject.startsWith("Promise kept") ? "COMMITMENT KEPT" : "COMMITMENT MISSED"}</div>}
              </article>
            );
          }) : (
            <section style={{ ...cardStyle, color: palette.muted }}>No conversations yet. Coach insights and player requests will appear here.</section>
          )}
        </>
      )}
    </main>
  );
}
