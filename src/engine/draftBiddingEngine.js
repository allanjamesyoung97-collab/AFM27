// Father-son and academy bidding for the national draft.
//
// Modelled on the AFL's revised bidding rules:
//  - Any club may bid on a father-son or academy (NGA / Northern Academy)
//    prospect at its own pick. The prospect's home club can match the bid by
//    paying draft value index (DVI) points with its own later picks.
//  - Ladder loadings: clubs that finished 1st-2nd pay 20% more points, 3rd-4th
//    pay 10% more, and clubs that missed finals (11th or lower) pay 10% less.
//    Applied to bids placed at picks 1-18.
//  - A bid at picks 1-36 can be matched with a maximum of two picks.
//  - A club that cannot cover the points may go into deficit, capped at 412
//    points, repaid by forfeiting its next first-round pick.
//  - A matched bid pushes the bidding club's pick back one place. A club from
//    the bottom five on the ladder that is pushed back receives a compensation
//    pick at the start of round two (one per club).
//
// Assumptions where the published rules are not specific are noted inline.
// Everything here is pure; draftEngine.js applies the results to draft state.

export const MATCH_PICK_CAP = 2;
export const MATCH_PICK_CAP_THROUGH = 36;
export const LOADING_BID_LIMIT = 18; // loadings/discounts apply to bids at picks 1-18 (assumption)
export const MAX_DEFICIT = 412;
export const COMPENSATION_BOTTOM_CLUBS = 5;
export const MATCHING_REQUIRES_OWN_PICKS = false;
export const FINALS_PLACES = 10; // clubs finishing 11th or lower missed finals

// Approximate draft value index. Calibrated to the values in the AFL's examples:
// pick 1 = 3000, pick 2 = 2481, pick 6 = 1659, picks 14 + 15 ~ pick 6,
// picks 7 + 8 ~ pick 2 with a 20% loading.
const DVI_KNOTS = [
  [1, 3000], [2, 2481], [3, 2210], [4, 1990], [5, 1810], [6, 1659], [7, 1545], [8, 1445],
  [10, 1240], [12, 1030], [14, 860], [15, 800], [18, 640], [20, 560], [24, 440], [28, 355],
  [32, 290], [36, 240], [40, 200], [45, 160], [54, 110], [63, 75], [72, 50], [90, 25],
];

export function draftValueIndex(pickNumber) {
  const n = Math.max(1, Math.round(Number(pickNumber) || 1));
  if (n >= DVI_KNOTS[DVI_KNOTS.length - 1][0]) {
    return Math.max(10, Math.round(25 * Math.exp(-(n - 90) / 60)));
  }
  for (let i = 1; i < DVI_KNOTS.length; i += 1) {
    const [x1, y1] = DVI_KNOTS[i];
    if (n <= x1) {
      const [x0, y0] = DVI_KNOTS[i - 1];
      const t = (n - x0) / (x1 - x0);
      return Math.round(Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * t));
    }
  }
  return 25;
}

export function matchAdjustment(ladderRank, bidPickNumber) {
  if (!Number.isFinite(Number(ladderRank)) || bidPickNumber > LOADING_BID_LIMIT) return 0;
  if (ladderRank <= 2) return 0.2;
  if (ladderRank <= 4) return 0.1;
  if (ladderRank > FINALS_PLACES) return -0.1;
  return 0;
}

// Ladder finish (1 = premier) derived from the draft order, where the worst
// club picks first. Works for every draft, including ones with no ladder.
export function getLadderRank(draftState, clubName) {
  const order = draftState?.draftOrder ?? [];
  const index = order.indexOf(clubName);
  return index < 0 ? null : order.length - index;
}

// ---------------------------------------------------------------------------
// Pick metadata kept alongside draftState.pickOwners
// ---------------------------------------------------------------------------
export function getPickMeta(draftState) {
  const owners = draftState?.pickOwners ?? [];
  if (Array.isArray(draftState?.pickMeta) && draftState.pickMeta.length === owners.length) return draftState.pickMeta;
  const order = draftState?.draftOrder ?? [];
  return owners.map((owner, index) => {
    const originalClub = order.length ? order[index % order.length] : owner;
    return { id: `slot-${index}`, owner, originalClub, round: order.length ? Math.floor(index / order.length) + 1 : 1, traded: owner !== originalClub };
  });
}

// Rebuild pickOwners and pickMeta from current-year pick assets (sorted by number).
export function draftPickMetaFields(yearPicks) {
  const sorted = [...yearPicks].sort((a, b) => a.number - b.number);
  return {
    pickOwners: sorted.map((pick) => pick.currentOwner),
    pickMeta: sorted.map((pick) => ({
      id: pick.id,
      owner: pick.currentOwner,
      originalClub: pick.originalClub ?? pick.currentOwner,
      round: pick.round ?? 1,
      traded: (pick.originalClub ?? pick.currentOwner) !== pick.currentOwner,
      compensation: Boolean(pick.compensation),
      mandatoryTrade: Boolean(pick.mandatoryTrade),
      expansionConcession: Boolean(pick.expansionConcession),
    })),
  };
}

export function isBiddingActive(draftState) {
  return Boolean(draftState) && !draftState.completed && (!draftState.kind || draftState.kind === "NATIONAL");
}

// ---------------------------------------------------------------------------
// Matching a bid
// ---------------------------------------------------------------------------
export function getMatchOptions(draftState, homeClub, bidIndex) {
  const meta = getPickMeta(draftState);
  const bidPickNumber = bidIndex + 1;
  const dvi = draftValueIndex(bidPickNumber);
  const rank = getLadderRank(draftState, homeClub);
  const adjustment = matchAdjustment(rank, bidPickNumber);
  const requiredPoints = Math.round(dvi * (1 + adjustment));
  const eligiblePicks = meta
    .map((entry, index) => ({ ...entry, index, pickNumber: index + 1, points: draftValueIndex(index + 1) }))
    .filter((entry) => entry.index > bidIndex && entry.owner === homeClub && !entry.matched && (!MATCHING_REQUIRES_OWN_PICKS || !entry.traded));
  const maxPicks = bidPickNumber <= MATCH_PICK_CAP_THROUGH ? MATCH_PICK_CAP : eligiblePicks.length;
  const deficitUsed = Number(draftState?.deficits?.[homeClub] ?? 0);
  return {
    bidIndex, bidPickNumber, homeClub, ladderRank: rank,
    baseValue: dvi, adjustment, requiredPoints,
    eligiblePicks, maxPicks, deficitCap: MAX_DEFICIT, deficitUsed,
    deficitAllowance: Math.max(0, MAX_DEFICIT - deficitUsed),
  };
}

function summarisePlan(options, picks) {
  const points = picks.reduce((sum, entry) => sum + entry.points, 0);
  const deficit = Math.max(0, options.requiredPoints - points);
  return {
    indices: picks.map((entry) => entry.index),
    pickNumbers: picks.map((entry) => entry.pickNumber),
    points,
    requiredPoints: options.requiredPoints,
    deficit,
    surplus: Math.max(0, points - options.requiredPoints),
    feasible: picks.length <= options.maxPicks && deficit <= options.deficitAllowance,
  };
}

// Check a manager-chosen set of picks.
export function validateMatchPlan(draftState, homeClub, bidIndex, pickIndices = []) {
  const options = getMatchOptions(draftState, homeClub, bidIndex);
  const unique = [...new Set(pickIndices.map(Number))];
  const chosen = unique.map((index) => options.eligiblePicks.find((entry) => entry.index === index));
  if (chosen.some((entry) => !entry)) return { ok: false, reason: "One of the selected picks is not available to match with.", options };
  if (chosen.length > options.maxPicks) return { ok: false, reason: `A bid at pick ${options.bidPickNumber} can be matched with at most ${options.maxPicks} picks.`, options };
  const plan = summarisePlan(options, chosen);
  if (plan.deficit > options.deficitAllowance) {
    return { ok: false, reason: `Short by ${plan.deficit} points, more than the ${options.deficitAllowance}-point deficit your club can carry.`, options, plan };
  }
  if (!chosen.length && options.requiredPoints > options.deficitAllowance) {
    return { ok: false, reason: "Select at least one pick to match with.", options, plan };
  }
  return { ok: true, options, plan: { ...plan, feasible: true } };
}

// Best plan for the AI (and the manager's "suggested" button): cover the points
// with the least waste; otherwise the smallest deficit within the cap.
export function planBestMatch(draftState, homeClub, bidIndex) {
  const options = getMatchOptions(draftState, homeClub, bidIndex);
  const pool = options.eligiblePicks.slice(0, 8);
  let best = null;
  const subsets = 1 << pool.length;
  for (let mask = 0; mask < subsets; mask += 1) {
    const picks = pool.filter((_, i) => mask & (1 << i));
    if (picks.length > options.maxPicks) continue;
    const plan = summarisePlan(options, picks);
    if (plan.deficit > options.deficitAllowance) continue;
    if (!picks.length && options.requiredPoints > options.deficitAllowance) continue;
    // Lower deficit first, then lower surplus (waste), then fewer picks.
    const score = plan.deficit * 1000 + plan.surplus * 1 + picks.length * 0.5;
    if (!best || score < best.score) best = { plan: { ...plan, feasible: true }, score };
  }
  return { options, plan: best?.plan ?? null, feasible: Boolean(best) };
}

// Would the home club's AI match this bid?
export function decideAIMatch(draftState, prospect, homeClub, bidIndex) {
  const { options, plan, feasible } = planBestMatch(draftState, homeClub, bidIndex);
  if (!feasible || !plan) return { match: false, reason: "Cannot cover the points within the pick and deficit limits.", options, plan: null };
  const bidPick = bidIndex + 1;
  const rank = Number(prospect.rank ?? bidPick);
  // Match when the bid is not far above where the prospect is ranked; accept a
  // deficit only for a prospect worth at least the bid.
  const worthIt = rank <= bidPick + 6;
  const acceptable = plan.deficit === 0 || rank <= bidPick + 2;
  return { match: worthIt && acceptable, reason: worthIt ? (acceptable ? "Matched" : "Not worth a deficit") : "Bid is well above the prospect's value", options, plan };
}

// ---------------------------------------------------------------------------
// Applying a matched bid to the draft order
// ---------------------------------------------------------------------------
// Inserts the home club's selection at the bid slot (pushing the bidding club's
// pick back one place), removes the picks used to match, and adds a compensation
// pick for a bottom-five club that was pushed back. Returns the updated order
// fields plus details for the log. Does not draft the player.
export function reorderForMatchedBid(draftState, { homeClub, bidIndex, plan, prospectId }) {
  const meta = getPickMeta(draftState).map((entry) => ({ ...entry }));
  const slot = { ...meta[bidIndex] };
  const used = new Set(plan.indices);
  const next = meta.filter((_, index) => !used.has(index));
  const inserted = { id: `match-${prospectId}`, owner: homeClub, originalClub: homeClub, round: slot.round ?? 1, traded: true, matched: true };
  next.splice(bidIndex, 0, inserted);

  // The pick that was on the clock is now at bidIndex + 1.
  const pushedBack = next[bidIndex + 1];
  const compensated = new Set(draftState.compensatedClubs ?? []);
  let compensation = null;
  if (pushedBack && !pushedBack.matched && !pushedBack.compensation) {
    const rank = getLadderRank(draftState, pushedBack.originalClub);
    const bottomFive = rank != null && rank > (draftState.draftOrder?.length ?? 18) - COMPENSATION_BOTTOM_CLUBS;
    if (bottomFive && !compensated.has(pushedBack.owner)) {
      const firstRoundTwo = next.findIndex((entry, index) => index > bidIndex && (entry.round ?? 1) >= 2);
      const at = firstRoundTwo < 0 ? next.length : firstRoundTwo;
      compensation = { id: `comp-${prospectId}-${pushedBack.owner}`, owner: pushedBack.owner, originalClub: pushedBack.originalClub, round: 2, traded: false, compensation: true };
      next.splice(at, 0, compensation);
      compensated.add(pushedBack.owner);
    }
  }
  return {
    pickMeta: next,
    pickOwners: next.map((entry) => entry.owner),
    totalPicks: next.length,
    pickIndex: bidIndex + 1,
    compensatedClubs: [...compensated],
    deficits: plan.deficit > 0 ? { ...(draftState.deficits ?? {}), [homeClub]: Number(draftState.deficits?.[homeClub] ?? 0) + plan.deficit } : (draftState.deficits ?? {}),
    compensation,
    pushedBack,
  };
}

// A club in deficit forfeits its next first-round pick (or second-round pick if
// the first has been traded away). Applied when the draft completes.
export function applyDraftDeficits(draftPickAssets, draftState) {
  const deficits = draftState?.deficits ?? {};
  const clubs = Object.keys(deficits).filter((club) => Number(deficits[club]) > 0);
  if (!clubs.length) return draftPickAssets;
  const nextYear = Number(draftState.draftYear) + 1;
  let assets = draftPickAssets;
  for (const club of clubs) {
    const own = (round) => assets.find((pick) => pick.year === nextYear && pick.round === round && pick.originalClub === club && pick.currentOwner === club);
    const target = own(1) ?? own(2);
    if (target) assets = assets.filter((pick) => pick.id !== target.id);
  }
  return assets;
}

// ---------------------------------------------------------------------------
// Prospect connections (father-son and academy)
// ---------------------------------------------------------------------------
const NORTHERN_ACADEMY_CLUBS = ["Brisbane", "Gold Coast", "Sydney", "GWS"];

// Real connections for the opening 2026 class.
const KNOWN_CONNECTIONS = {
  "Cody Walker": { type: "FATHER_SON", club: "Carlton" },
  "Dougie Cochrane": { type: "ACADEMY", academyType: "NGA", club: "Port Adelaide" },
  "Ethan Matthews": { type: "ACADEMY", academyType: "NORTHERN", club: "GWS" },
  "Caylen Murray": { type: "ACADEMY", academyType: "NORTHERN", club: "Brisbane" },
};

function seededRandom(seed) {
  let value = Number(seed) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function connectionLabel(connection) {
  if (!connection) return "";
  if (connection.type === "FATHER_SON") return `Father-son · ${connection.club}`;
  return `${connection.academyType === "NORTHERN" ? "Northern Academy" : "NGA"} · ${connection.club}`;
}

export function assignProspectConnections(prospects, { draftYear, clubNames = [], initial = false, fatherFirstNames = ["Mark", "Brad", "Shane", "Craig", "Dean", "Scott", "Troy", "Glenn"] } = {}) {
  const result = prospects.map((prospect) => ({ ...prospect }));
  const taken = new Set();
  const tie = (index, connection) => {
    if (index < 0 || taken.has(index)) return;
    taken.add(index);
    const prospect = result[index];
    result[index] = { ...prospect, connection, juniorClub: connection.type === "ACADEMY" ? `${connection.club} Academy` : prospect.juniorClub };
  };
  if (initial) {
    result.forEach((prospect, index) => { if (KNOWN_CONNECTIONS[prospect.name]) tie(index, { ...KNOWN_CONNECTIONS[prospect.name] }); });
    if (taken.size) return result;
  }
  if (!clubNames.length || result.length < 20) return result;
  const random = seededRandom(Number(draftYear) * 7919 + result.length);
  const pickIndex = () => {
    // Biased towards the top 40, as most tied prospects are first- or second-round talents.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const index = Math.min(result.length - 1, Math.floor((random() ** 1.6) * Math.min(result.length, 70)));
      if (!taken.has(index)) return index;
    }
    return -1;
  };
  const randomClub = (list) => list[Math.floor(random() * list.length)];
  const northern = NORTHERN_ACADEMY_CLUBS.filter((club) => clubNames.includes(club));
  for (let i = 0; i < 3 && northern.length; i += 1) tie(pickIndex(), { type: "ACADEMY", academyType: "NORTHERN", club: northern[(i + Math.floor(random() * northern.length)) % northern.length] });
  const ngaClubs = clubNames.filter((club) => !northern.includes(club));
  for (let i = 0; i < 2; i += 1) tie(pickIndex(), { type: "ACADEMY", academyType: "NGA", club: randomClub(ngaClubs) });
  for (let i = 0; i < 4; i += 1) {
    const index = pickIndex();
    if (index < 0) continue;
    const surname = String(result[index].name ?? "").split(" ").slice(1).join(" ");
    tie(index, { type: "FATHER_SON", club: randomClub(clubNames), fatherName: `${randomClub(fatherFirstNames)} ${surname}`.trim(), fatherGames: 100 + Math.floor(random() * 220) });
  }
  return result;
}
