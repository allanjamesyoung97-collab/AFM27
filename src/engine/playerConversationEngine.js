export function resolveMatchStory(previous, result, clubName, seasonYear, round, clubPlayers, playerFitness = {}) {
  const isHome = result.homeTeam === clubName;
  const rows = (isHome ? result.playerStats?.home : result.playerStats?.away) ?? [];
  const minutesByPlayer = result.matchTimeOnGround
    ? { ...result.matchTimeOnGround }
    : Object.fromEntries(rows.map((row) => [String(row.playerId), Number(row.timeOnGround ?? 0)]));
  const selectedIds = new Set([...Object.keys(minutesByPlayer), ...rows.map((row) => String(row.playerId))]);
  if (!selectedIds.size) return {
    playerDevelopment: previous.playerDevelopment ?? {},
    playerContracts: previous.playerContracts ?? {},
    chatMessages: previous.chatMessages ?? [],
    clubMorale: previous.clubMorale ?? {},
  };

  const playerDevelopment = { ...(previous.playerDevelopment ?? {}) };
  const playerContracts = { ...(previous.playerContracts ?? {}) };
  const chatMessages = [...(previous.chatMessages ?? [])];
  const clubMorale = { ...(previous.clubMorale ?? {}) };
  const margin = Number(result.homeScore ?? 0) - Number(result.awayScore ?? 0);
  const ownMargin = isHome ? margin : -margin;
  if (!previous.calendarClock) clubMorale[clubName] = Math.max(0, Math.min(100, Number(clubMorale[clubName] ?? 50) + (ownMargin > 0 ? 2 : ownMargin < 0 ? -2 : 1)));
  const pendingPlayers = new Set(chatMessages.filter((message) => message.type === "PLAYER_REQUEST" && message.status === "PENDING").map((message) => String(message.playerId)));
  const availablePlayers = clubPlayers;
  for (const player of availablePlayers) {
    const id = String(player.id);
    const state = { ...(playerDevelopment[id] ?? {}) };
    const minutes = Number(minutesByPlayer[id] ?? 0);
    const consecutiveBenchings = minutes > 0 ? 0 : Number(state.consecutiveBenchings ?? 0) + 1;
    playerDevelopment[id] = { ...state, consecutiveBenchings, consecutiveGames: minutes > 0 ? Number(state.consecutiveGames ?? 0) + 1 : 0 };
    const overall = Number(state.overall ?? player.overall ?? 0);
    const alreadyAskedThisSeason = Number(state.lastPlayingTimeRequestSeason) === seasonYear;
  }

  // Player conversations are driven by selection, workload, and contract context.
  // Limit each player to one pending conversation and one request per type per season.
  const candidates = [...clubPlayers].sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0));
  let newPlayerChats = 0;
  for (const player of candidates) {
    if (newPlayerChats >= 2) break;
    const id = String(player.id);
    const state = playerDevelopment[id] ?? {};
    if (pendingPlayers.has(id)) continue;
    const minutes = Number(minutesByPlayer[id] ?? 0);
    const fitness = Number(playerFitness?.[id]?.fitness ?? 100);
    const savedContract = previous.playerContracts?.[id] ?? {};
    const contractYears = Number(savedContract.yearsRemaining ?? savedContract.years ?? player.contract?.yearsRemaining ?? player.contract?.years ?? 99);
    const requestTypes = [
      consecutiveBenchRequest(player, state, seasonYear),
      minutes > 0 && (fitness < 48 || Number(state.consecutiveGames ?? 0) >= 5) && state.lastRestRequestSeason !== seasonYear
        ? { kind: "REST", subject: "Requests a rest", body: "I've been carrying a heavy workload and could use a recovery week. Can we manage my minutes or give me a rest?", options: [{ value: "APPROVE_REST", label: "Approve a rest" }, { value: "DECLINE_REST", label: "Keep me available" }] } : null,
      contractYears <= 1 && Number(state.lastContractRequestSeason) !== seasonYear
        ? { kind: "CONTRACT", subject: "Wants to discuss a new contract", body: "My contract is getting close to its end. I'd like to understand whether the club sees me as part of its plans.", options: [{ value: "START_CONTRACT_TALKS", label: "Start contract talks" }, { value: "DEFER_CONTRACT_TALKS", label: "Discuss later" }] } : null,
      Number(state.happiness ?? 50) < 34 && Number(state.lastLeaveRequestSeason) !== seasonYear
        ? { kind: "LEAVE", subject: "Expresses a desire to leave", body: "I'm unhappy with how things are going and want to discuss whether a move elsewhere is best for my career.", options: [{ value: "RETAIN_PLAYER", label: "Work to retain them" }, { value: "ALLOW_MOVE", label: "Allow them to explore a move" }] } : null,
    ].filter(Boolean);
    const request = requestTypes[0];
    if (!request) continue;
    const chatId = `player-${request.kind.toLowerCase()}-${seasonYear}-${round}-${id}`;
    chatMessages.push({ id: chatId, type: "PLAYER_REQUEST", requestKind: request.kind, status: "PENDING", playerId: id, subject: request.subject, sender: player.name, date: result.date ?? `Round ${round}`, body: request.body, responseOptions: request.options, relatedResult: `${result.homeTeam} ${result.homeScore} — ${result.awayScore} ${result.awayTeam}` });
    const moodKey = request.kind === "REST" ? "lastRestRequestSeason" : request.kind === "CONTRACT" ? "lastContractRequestSeason" : request.kind === "LEAVE" ? "lastLeaveRequestSeason" : "lastPlayingTimeRequestSeason";
    playerDevelopment[id] = { ...state, [moodKey]: seasonYear, happiness: Math.max(0, Number(state.happiness ?? 50) - 2) };
    const contract = playerContracts[id] ?? {};
    playerContracts[id] = { ...contract, mood: { ...(contract.mood ?? {}), leaveDesireDelta: Math.max(-100, Math.min(100, Number(contract.mood?.leaveDesireDelta ?? 0) + 2)) } };
    clubMorale[clubName] = Math.max(0, Number(clubMorale[clubName] ?? 50) - 1);
    pendingPlayers.add(id);
    newPlayerChats += 1;
  }

  for (const player of clubPlayers) {
    const id = String(player.id);
    const state = playerDevelopment[id] ?? {};
    const promise = state.playingTimePromise;
    if (promise?.status !== "OPEN" || Number(promise.dueRound) > round) continue;
    const kept = Number(minutesByPlayer[id] ?? 0) > 0;
    const happiness = Math.max(0, Math.min(100, Number(state.happiness ?? player.development?.happiness ?? 50) + (kept ? 7 : -12)));
    playerDevelopment[id] = {
      ...state,
      happiness,
      playingTimePromise: { ...promise, status: kept ? "KEPT" : "BROKEN", completedRound: round },
    };
    chatMessages.push({
      id: `playing-time-outcome-${seasonYear}-${round}-${id}`,
      type: "PROMISE_OUTCOME",
      status: "RESOLVED",
      playerId: id,
      sender: "Head of Football Strategy and Coaching",
      subject: kept ? `Promise kept · ${player.name}` : `Promise broken · ${player.name}`,
      date: result.date ?? `Round ${round}`,
      body: kept
        ? `${player.name} was included in the matchday rotation. Their confidence has improved.`
        : `${player.name} missed the matchday rotation after being promised more minutes. Their happiness has fallen and the promise is now broken.`,
      relatedResult: `${result.homeTeam} ${result.homeScore} — ${result.awayScore} ${result.awayTeam}`,
    });
  }
  return { playerDevelopment, playerContracts, chatMessages, clubMorale };
}

function consecutiveBenchRequest(player, state, seasonYear) {
  if (Number(state.consecutiveBenchings ?? 0) >= 2 && Number(player.overall ?? 0) >= 83 && Number(state.lastPlayingTimeRequestSeason) !== seasonYear) {
    return { kind: "PLAYING_TIME", subject: "Wants to discuss their role", body: "I've been left out of the on-field rotation again. I want a clear path to more match minutes. Can we talk about my role?", options: [{ value: "PROMISE_MINUTES", label: "Promise more minutes" }, { value: "DEVELOPMENT_PLAN", label: "Discuss development plan" }] };
  }
  return null;
}

