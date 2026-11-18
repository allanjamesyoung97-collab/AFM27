import { readAttribute } from "./midfieldAttributes.js";

export const TACTIC_STYLES = [
  { id: "FAST_TRANSITION", name: "Fast Transition", description: "Attack space quickly after a turnover.", suitedTo: "Speed, acceleration and endurance", fitPositions: ["MID", "WING", "HB", "BP"], modifiers: { attack: 3, defence: -1, transition: 4, possession: -1, pressure: 1, territory: 2, stoppage: 0, risk: 2 }, fitAttributes: ["speed", "acceleration", "endurance", "runCarry", "decisionMaking", "gameAwareness"] },
  { id: "POSSESSION_CONTROL", name: "Possession Control", description: "Keep the ball, control the pace, and work for high-quality entries.", suitedTo: "Kicking, handball, vision and composure", fitPositions: ["MID", "WING", "HB", "BP"], modifiers: { attack: 1, defence: 1, transition: -1, possession: 4, pressure: -1, territory: -1, stoppage: 1, risk: -1 }, fitAttributes: ["kicking", "handball", "vision", "decisionMaking", "composure", "teamwork", "gameAwareness"] },
  { id: "FORWARD_HALF_PRESSURE", name: "Forward Half Pressure", description: "Lock the ball inside your attacking half and force turnovers.", suitedTo: "Endurance, tackling, work rate and competitiveness", fitPositions: ["HF", "FF", "KPF", "MID", "WING"], modifiers: { attack: 1, defence: 1, transition: 1, possession: 1, pressure: 4, territory: 2, stoppage: 1, risk: 1 }, fitAttributes: ["endurance", "tackling", "workRate", "competitiveness", "speed", "discipline"] },
  { id: "CONTEST_CLEARANCE", name: "Contest & Clearance", description: "Compete at the source and move the ball forward from stoppages.", suitedTo: "Strength, tackling, positioning and competitiveness", fitPositions: ["MID", "WING", "RUC"], modifiers: { attack: 2, defence: 1, transition: 1, possession: 1, pressure: 1, territory: 1, stoppage: 4, risk: 0 }, fitAttributes: ["strength", "tackling", "positioning", "competitiveness", "verticalLeap", "contestedBall", "ruckCraft"] },
  { id: "SLINGSHOT", name: "Slingshot", description: "Absorb pressure, then break quickly through the corridor.", suitedTo: "Pace, intercept ability and clean ball use", fitPositions: ["HB", "BP", "WING", "MID"], modifiers: { attack: 3, defence: -2, transition: 4, possession: -1, pressure: 0, territory: 2, stoppage: 0, risk: 2 }, fitAttributes: ["speed", "acceleration", "spoiling", "positioning", "kicking", "runCarry", "decisionMaking", "gameAwareness"] },
  { id: "TERRITORY_FOOTBALL", name: "Territory Football", description: "Advance the ball and keep play in your forward half.", suitedTo: "Kicking distance, marking, strength and positioning", fitPositions: ["KPF", "FF", "HF", "RUC", "HB"], modifiers: { attack: 2, defence: 1, transition: 1, possession: -2, pressure: 2, territory: 4, stoppage: 1, risk: 1 }, fitAttributes: ["kicking", "marking", "strength", "positioning", "verticalLeap", "gameAwareness"] },
  { id: "DEFENCE_FIRST", name: "Defence First", description: "Protect the corridor, defend space, and limit opposition scoring.", suitedTo: "Spoiling, positioning, composure and teamwork", fitPositions: ["KPD", "KPB", "HB", "BP", "RUC"], modifiers: { attack: -1, defence: 4, transition: -1, possession: 2, pressure: -1, territory: -1, stoppage: 1, risk: -2 }, fitAttributes: ["spoiling", "positioning", "composure", "teamwork", "decisionMaking", "discipline", "durability"] },
  { id: "ADAPTIVE_HYBRID", name: "Adaptive Hybrid", description: "Balance possession, pressure, and transition to suit the game.", suitedTo: "Balanced strengths across the squad", fitPositions: [], modifiers: { attack: 0, defence: 0, transition: 0, possession: 0, pressure: 0, territory: 0, stoppage: 0, risk: 0 }, fitAttributes: ["decisionMaking", "workRate", "teamwork", "composure", "gameAwareness", "discipline"] },
];

export const TACTIC_SLIDERS = [
  { id: "attackDefence", left: "Attack", right: "Defence" },
  { id: "corridorBoundary", left: "Corridor", right: "Boundary" },
  { id: "possessionTerritory", left: "Possession", right: "Territory" },
  { id: "pressureStructure", left: "Pressure", right: "Structure" },
  { id: "riskSafety", left: "Risk", right: "Safety" },
  { id: "contestSpread", left: "Numbers at contest", right: "Spread behind ball" },
];

export const DEFAULT_TACTICS = {
  style: "ADAPTIVE_HYBRID",
  sliders: {
    attackDefence: 50,
    corridorBoundary: 50,
    possessionTerritory: 50,
    pressureStructure: 50,
    riskSafety: 50,
    contestSpread: 50,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const legacyStyles = {
  BALANCED: "ADAPTIVE_HYBRID",
  POSSESSION: "POSSESSION_CONTROL",
  TERRITORY: "TERRITORY_FOOTBALL",
  TRANSITION: "FAST_TRANSITION",
};

export function normalizeTactics(tactics) {
  const incoming = tactics && typeof tactics === "object" ? tactics : {};
  const oldStyle = incoming.style ?? incoming.teamStyle;
  const candidateStyle = legacyStyles[oldStyle] ?? oldStyle;
  const style = TACTIC_STYLES.some((item) => item.id === candidateStyle)
    ? candidateStyle
    : DEFAULT_TACTICS.style;
  const oldSliders = incoming.sliders ?? {};
  const legacySlider = (id) => {
    if (oldSliders[id] !== undefined) return oldSliders[id];
    if (id === "contestSpread" && oldSliders.youthExperience !== undefined) return oldSliders.youthExperience;
    if (id === "possessionTerritory") {
      if (incoming.ballMovement === "PATIENT") return 20;
      if (incoming.ballMovement === "DIRECT") return 80;
    }
    if (id === "pressureStructure") {
      if (incoming.pressure === "AGGRESSIVE") return 20;
      if (incoming.pressure === "CONTAIN") return 80;
    }
    if (id === "attackDefence" && incoming.stoppageFocus === "DEFENSIVE") return 75;
    return DEFAULT_TACTICS.sliders[id];
  };
  return {
    style,
    sliders: Object.fromEntries(TACTIC_SLIDERS.map(({ id }) => [
      id,
      clamp(Number(legacySlider(id)), 0, 100),
    ])),
  };
}

export function getTacticalRatings(tactics) {
  const plan = normalizeTactics(tactics);
  const style = TACTIC_STYLES.find((item) => item.id === plan.style) ?? TACTIC_STYLES[TACTIC_STYLES.length - 1];
  const values = { ...style.modifiers };
  const sliders = plan.sliders;
  const signed = (key) => sliders[key] - 50;

  values.attack -= signed("attackDefence") * 0.05;
  values.defence += signed("attackDefence") * 0.05;
  values.attack -= signed("corridorBoundary") * 0.025;
  values.territory += signed("corridorBoundary") * 0.02;
  values.possession -= signed("possessionTerritory") * 0.05;
  values.territory += signed("possessionTerritory") * 0.05;
  values.pressure -= signed("pressureStructure") * 0.05;
  values.defence += signed("pressureStructure") * 0.02;
  values.risk -= signed("riskSafety") * 0.05;
  values.attack -= signed("riskSafety") * 0.025;
  values.defence += signed("riskSafety") * 0.025;
  // Numbers at the contest improve stoppage coverage but concede some spread;
  // the opposite setting strengthens defensive shape and transition outlets.
  values.stoppage -= signed("contestSpread") * 0.04;
  values.defence += signed("contestSpread") * 0.025;
  values.transition += signed("contestSpread") * 0.025;

  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value.toFixed(1))]));
}

// Each slider trades two approaches. A slider only helps when the squad is actually better at the
// side it leans towards, so the squad's attribute profile decides whether a setting is worth taking.
// (Without this, every slider added to one rating what it removed from another, and the
// overall tactical rating barely responded to them.)
export const SLIDER_ATTRIBUTE_PAIRS = Object.freeze({
  attackDefence: { left: ["goalSense", "marking", "kicking"], right: ["spoiling", "tackling", "gameAwareness"] },
  corridorBoundary: { left: ["speed", "gameAwareness", "kicking"], right: ["endurance", "strength", "marking"] },
  possessionTerritory: { left: ["kicking", "gameAwareness", "composure"], right: ["marking", "strength", "endurance"] },
  pressureStructure: { left: ["tackling", "endurance", "workRate"], right: ["spoiling", "gameAwareness", "positioning"] },
  riskSafety: { left: ["speed", "goalSense", "creativity"], right: ["spoiling", "composure", "positioning"] },
  contestSpread: { left: ["contestedBall", "tackling", "strength"], right: ["runCarry", "speed", "endurance"] },
});
const SLIDER_FIT_WEIGHT = 0.035;

const suppliedPlayers = (players = []) => [...(players ?? [])]
  .map((entry) => (entry?.player ? { ...entry.player, matchPosition: entry.matchPosition ?? entry.position ?? entry.slot } : entry))
  .filter((player) => player?.attributes);

function squadAttributeMean(players, keys) {
  const values = players.flatMap((player) => keys.map((key) => readAttribute(player, key)).filter(Number.isFinite));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/**
 * How well the slider settings suit the squad. Each slider contributes lean x attribute edge, so leaning
 * towards a strength earns rating and leaning towards a weakness costs it. Returns a total and a per-slider breakdown.
 */
export function getSliderSquadFit(tactics, players = []) {
  const plan = normalizeTactics(tactics);
  const squad = suppliedPlayers(players).slice(0, 22);
  if (!squad.length) return { total: 0, breakdown: [] };
  const breakdown = TACTIC_SLIDERS.map(({ id, left, right }) => {
    const pair = SLIDER_ATTRIBUTE_PAIRS[id];
    const leftMean = squadAttributeMean(squad, pair.left);
    const rightMean = squadAttributeMean(squad, pair.right);
    if (leftMean === null || rightMean === null) return { id, left, right, lean: 0, edge: 0, value: 0 };
    const lean = (50 - plan.sliders[id]) / 50;
    const edge = leftMean - rightMean;
    return { id, left, right, lean: Number(lean.toFixed(2)), edge: Number(edge.toFixed(1)), value: Number(clamp(lean * edge * SLIDER_FIT_WEIGHT, -0.5, 0.5).toFixed(2)) };
  });
  return { total: Number(breakdown.reduce((sum, item) => sum + item.value, 0).toFixed(2)), breakdown };
}

// Adaptive Hybrid has no role requirements, so it used to get a full coverage bonus and full weight on every
// player, and it scored highest for almost every squad. It is now scored on balance instead: it earns its
// score only when no specialist style stands out (the specialist fits sit close together), and it carries
// a small discount for being a generalist.
const HYBRID_GENERALIST_DISCOUNT = 3;
const HYBRID_BALANCE_PIVOT = 5;

export function getTacticalStyleFit(styleId, players = []) {
  const style = TACTIC_STYLES.find((item) => item.id === styleId) ?? TACTIC_STYLES.at(-1);
  if (style.id !== "ADAPTIVE_HYBRID") return styleFitScore(style, players);
  const base = styleFitScore(style, players);
  if (!base.score) return base;
  const specialist = TACTIC_STYLES.filter((item) => item.id !== "ADAPTIVE_HYBRID").map((item) => styleFitScore(item, players).score);
  const spread = Math.max(...specialist) - Math.min(...specialist);
  const balanceBonus = clamp(HYBRID_BALANCE_PIVOT - spread, -3, 3);
  const score = clamp(base.score - HYBRID_GENERALIST_DISCOUNT + balanceBonus, 0, 100);
  return {
    score: Math.round(score),
    ratingBonus: Number(clamp((score - 70) / 18, -1.2, 1.2).toFixed(1)),
    label: score >= 82 ? "Strong fit" : score >= 72 ? "Good fit" : score >= 62 ? "Developing fit" : "Poor fit",
  };
}

function styleFitScore(style, players = []) {
  const supplied = [...(players ?? [])].map((entry) => entry?.player
    ? { ...entry.player, matchPosition: entry.matchPosition ?? entry.position ?? entry.slot }
    : entry).filter((player) => player?.attributes && Number.isFinite(Number(player.overall)));
  const hasSelectedRoles = supplied.some((player) => player.matchPosition || player.playingPosition || player.slot);
  const bestAvailable = hasSelectedRoles ? supplied.slice(0, 22) : supplied.sort((a, b) => Number(b.overall) - Number(a.overall)).slice(0, 22);
  if (!bestAvailable.length) return { score: 0, ratingBonus: 0, label: "No squad data" };

  let weightedTotal = 0;
  let totalWeight = 0;
  let matchedPlayerCount = 0;
  bestAvailable.forEach((player) => {
    const assignedPosition = String(player.matchPosition ?? player.playingPosition ?? player.slot ?? "").toUpperCase();
    const positions = (player.positions ?? []).map((position) => String(position).toUpperCase());
    const roleMatch = style.fitPositions.length === 0 || (assignedPosition
      ? style.fitPositions.some((position) => assignedPosition.includes(position))
      : positions.some((position) => style.fitPositions.includes(position)));
    if (roleMatch) matchedPlayerCount += 1;
    style.fitAttributes.forEach((key) => {
      const value = readAttribute(player, key);
      if (!Number.isFinite(value) || (key === "ruckCraft" && !positions.some((position) => ["RUC", "RUCK"].includes(position)))) return;
      // Relevant roles contribute fully; other roles contribute less, while every
      // best-22 player still counts toward the team's real profile.
      const weight = roleMatch ? 1 : 0.35;
      weightedTotal += value * weight;
      totalWeight += weight;
    });
  });
  if (!totalWeight) return { score: 0, ratingBonus: 0, label: "No attribute data" };
  const mean = weightedTotal / totalWeight;
  const coverage = matchedPlayerCount / bestAvailable.length;
  // A style with no role requirements gets no coverage adjustment either way.
  const coverageTerm = style.fitPositions.length === 0 ? 0 : (coverage - 0.65) * 14;
  const score = clamp(mean + coverageTerm, 0, 100);
  return {
    score: Math.round(score),
    ratingBonus: Number(clamp((score - 70) / 18, -1.2, 1.2).toFixed(1)),
    label: score >= 82 ? "Strong fit" : score >= 72 ? "Good fit" : score >= 62 ? "Developing fit" : "Poor fit",
  };
}

// For each style, the styles that work best against it (first = strongest counter).
export const COUNTER_STYLES = Object.freeze({
  POSSESSION_CONTROL: ["FORWARD_HALF_PRESSURE", "CONTEST_CLEARANCE"],
  FAST_TRANSITION: ["CONTEST_CLEARANCE", "DEFENCE_FIRST"],
  FORWARD_HALF_PRESSURE: ["SLINGSHOT", "POSSESSION_CONTROL"],
  CONTEST_CLEARANCE: ["FAST_TRANSITION", "SLINGSHOT"],
  SLINGSHOT: ["TERRITORY_FOOTBALL", "FORWARD_HALF_PRESSURE"],
  TERRITORY_FOOTBALL: ["SLINGSHOT", "DEFENCE_FIRST"],
  DEFENCE_FIRST: ["POSSESSION_CONTROL", "FAST_TRANSITION"],
  ADAPTIVE_HYBRID: [],
});

const hashString = (value) => [...String(value)].reduce((sum, char, index) => (sum + char.charCodeAt(0) * (index + 7)) % 100003, 0);
const unit = (value) => (hashString(value) % 1000) / 1000; // 0 to 0.999, stable for a given input

/**
 * Select a club plan from the squad's actual attribute/role profile, then adapt it.
 *   seed            the club's name: fixes its coaching personality (how aggressive it is by nature)
 *   opponentStyle   the opposition's style this week, which can swing the choice towards a counter
 *   context         { round, isHome, ladderRank, opponentRank, clubCount, strengthGap }
 * The returned plan carries a `rationale` list explaining the choices.
 */
export function recommendTactics(players = [], { opponentStyle = null, seed = "", context = {} } = {}) {
  const candidates = TACTIC_STYLES.map((style) => ({ style, fit: getTacticalStyleFit(style.id, players) }));
  const counters = COUNTER_STYLES[opponentStyle] ?? [];
  // A stable, club-specific temperament in [-1, 1]: positive coaches are aggressive, negative ones cautious.
  const temperament = unit(`${seed}:temperament`) * 2 - 1;
  const ranked = candidates.map(({ style, fit }) => {
    const counterIndex = counters.indexOf(style.id);
    const counterBonus = counterIndex === 0 ? 4 : counterIndex === 1 ? 2 : 0;
    const temperamentBonus = (["FORWARD_HALF_PRESSURE", "FAST_TRANSITION"].includes(style.id) ? temperament * 2
      : ["DEFENCE_FIRST", "POSSESSION_CONTROL"].includes(style.id) ? -temperament * 2 : 0);
    return { style, fit, counterBonus, score: fit.score + counterBonus + temperamentBonus };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.style ?? TACTIC_STYLES.at(-1);
  const rating = ranked[0]?.fit.score ?? 0;
  const rationale = [];
  if (ranked[0]?.counterBonus) rationale.push(`${selected.name} counters ${TACTIC_STYLES.find((item) => item.id === opponentStyle)?.name ?? "their style"}`);
  else rationale.push(`${selected.name} is the best fit for the squad (${rating}% fit)`);

  const sliders = {
    attackDefence: rating > 82 ? 43 : rating < 68 ? 58 : 50,
    corridorBoundary: selected.id === "SLINGSHOT" || selected.id === "FAST_TRANSITION" ? 36 : 50,
    possessionTerritory: selected.id === "POSSESSION_CONTROL" ? 32 : selected.id === "TERRITORY_FOOTBALL" ? 68 : 50,
    pressureStructure: selected.id === "FORWARD_HALF_PRESSURE" ? 35 : selected.id === "DEFENCE_FIRST" ? 66 : 50,
    riskSafety: selected.id === "SLINGSHOT" || selected.id === "FAST_TRANSITION" ? 38 : selected.id === "DEFENCE_FIRST" ? 65 : 50,
    contestSpread: selected.id === "CONTEST_CLEARANCE" ? 38 : selected.id === "SLINGSHOT" ? 65 : 50,
  };

  // Temperament: attack-minded coaches push risk and pressure; cautious coaches hold shape.
  sliders.attackDefence -= temperament * 7;
  sliders.riskSafety -= temperament * 7;
  sliders.pressureStructure -= temperament * 5;
  if (Math.abs(temperament) > 0.5) rationale.push(temperament > 0 ? "Aggressive coaching approach" : "Cautious coaching approach");

  // Situation: strength gap, venue and ladder standing.
  const gap = Number(context.strengthGap);
  if (Number.isFinite(gap)) {
    if (gap <= -2.5) { sliders.attackDefence += 8; sliders.riskSafety += 7; sliders.pressureStructure += 4; rationale.push("Underdog: tighter structure and fewer risks"); }
    else if (gap >= 2.5) { sliders.attackDefence -= 6; sliders.riskSafety -= 5; rationale.push("Favourite: backs the stronger side to attack"); }
  }
  if (context.isHome === true) sliders.attackDefence -= 3;
  if (context.isHome === false) { sliders.attackDefence += 3; sliders.riskSafety += 2; }
  const rank = Number(context.ladderRank), opponentRank = Number(context.opponentRank);
  if (Number.isFinite(rank) && Number.isFinite(opponentRank) && opponentRank - rank >= 6) { sliders.attackDefence += 4; rationale.push("Respects a much higher-ranked opponent"); }

  const rounded = Object.fromEntries(Object.entries(sliders).map(([key, value]) => [key, Math.round(value)]));
  return { ...normalizeTactics({ style: selected.id, sliders: rounded }), rationale };
}

/** Phase-specific advantages used by live events and match-stat generation. */
export function getTacticalPhaseProfile(tactics, players = []) {
  const ratings = getTacticalRatings(tactics);
  const fit = getTacticalStyleFit(normalizeTactics(tactics).style, players).ratingBonus;
  return {
    stoppage: clamp(1 + ratings.stoppage * 0.035 + ratings.pressure * 0.008, 0.82, 1.2),
    transition: clamp(1 + ratings.transition * 0.035 + ratings.risk * 0.012, 0.8, 1.22),
    forwardEntry: clamp(1 + ratings.territory * 0.03 + ratings.attack * 0.012, 0.82, 1.2),
    retention: clamp(1 + ratings.possession * 0.03 - ratings.risk * 0.012, 0.82, 1.2),
    pressure: clamp(1 + ratings.pressure * 0.035 + fit * 0.012, 0.8, 1.22),
    defence: clamp(1 + ratings.defence * 0.025 + fit * 0.008, 0.82, 1.2),
    scoring: clamp(1 + ratings.attack * 0.018 + fit * 0.015, 0.82, 1.18),
  };
}

export function getTacticalRatingBonus(tactics, players = []) {
  const ratings = getTacticalRatings(tactics);
  const average = (ratings.attack + ratings.defence + ratings.transition + ratings.possession + ratings.pressure + ratings.territory + ratings.stoppage) / 7;
  const styleFit = getTacticalStyleFit(normalizeTactics(tactics).style, players).ratingBonus;
  const sliderFit = getSliderSquadFit(tactics, players).total;
  return Number(clamp(average + styleFit + sliderFit, -3.5, 3.5).toFixed(1));
}

export function getTacticalDefenceBonus(tactics, players = []) {
  const ratings = getTacticalRatings(tactics);
  const styleFit = getTacticalStyleFit(normalizeTactics(tactics).style, players).ratingBonus;
  // Positive values make opposition attacks harder; risky styles trade away
  // some defensive reliability while pressure and stoppage work help contain them.
  const defence = ratings.defence * 0.55
    + ratings.pressure * 0.25
    + ratings.stoppage * 0.15
    - ratings.risk * 0.15
    + styleFit * 0.5;
  return Number(clamp(defence, -3, 3).toFixed(1));
}

export function getScoringRateModifiers(tactics, players = []) {
  const ratings = getTacticalRatings(tactics);
  const styleFit = getTacticalStyleFit(normalizeTactics(tactics).style, players).ratingBonus;
  return {
    goals: clamp(1 + ratings.attack * 0.025 + ratings.territory * 0.012 + ratings.pressure * 0.008 + ratings.risk * 0.008 + styleFit * 0.012, 0.78, 1.28),
    behinds: clamp(1 + ratings.risk * 0.018 - ratings.attack * 0.006, 0.8, 1.25),
    pressure: clamp(1 + ratings.pressure * 0.025 + ratings.stoppage * 0.01, 0.75, 1.3),
  };
}