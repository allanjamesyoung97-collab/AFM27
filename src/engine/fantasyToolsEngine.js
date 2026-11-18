import { createPlayer } from "./playerFactory.js";
import { ATTRIBUTE_GROUPS, getEligiblePlayerTraits, normalizeTraitIds, TRAIT_DEFINITIONS } from "../data/footballData.js";
import { calculateOverall, fitAttributesToOverall } from "./playerRatingGenerator.js";

export const FANTASY_POSITIONS = ["KPD", "KPB", "HB", "BP", "CHB", "FB", "DEF", "MID", "C", "RR", "ROV", "WING", "HF", "FF", "FP", "KPF", "FWD", "RUC", "RUCK", "R"];
export const FANTASY_ATTRIBUTE_GROUPS = ATTRIBUTE_GROUPS;

const allAttributeKeys = Object.values(ATTRIBUTE_GROUPS).flat();
const validPosition = new Set(FANTASY_POSITIONS);
const selectedPositions = (positions) => [...new Set((Array.isArray(positions) ? positions : []).filter((position) => validPosition.has(position)))];

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function createFantasyId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validatePlayerFields(fields) {
  const name = String(fields.name ?? "").trim();
  if (name.length < 2) return { error: "Enter a player name with at least two characters." };
  const positions = selectedPositions(fields.positions);
  if (!positions.length) return { error: "Choose at least one position." };
  const age = clampInteger(fields.age, 17, 45);
  const heightCm = clampInteger(fields.heightCm ?? 185, 150, 220);
  const inputPotential = clampInteger(fields.potential, 40, 99);
  if (age === null || inputPotential === null || heightCm === null) return { error: "Age, potential and height must be valid numbers." };
  const attributes = {};
  for (const key of allAttributeKeys) {
    const value = clampInteger(fields.attributes?.[key] ?? 70, 1, 99);
    if (value === null) return { error: `${key} must be a number from 1 to 99.` };
    attributes[key] = value;
  }
  const overall = Math.max(40, Math.min(99, calculateOverall(attributes, positions[0])));
  const potential = Math.max(overall, inputPotential);
  const traitPlayer = { positions, attributes, heightCm };
  const eligibleIds = new Set(getEligiblePlayerTraits(traitPlayer).filter((item) => !item.automatic).map((item) => item.id));
  const selectedTraits = normalizeTraitIds(fields.activeTraits).filter((id) => eligibleIds.has(id));
  const activeTraits = [
    ...selectedTraits.filter((id) => TRAIT_DEFINITIONS[id].category !== "drawback").slice(0, 3),
    ...selectedTraits.filter((id) => TRAIT_DEFINITIONS[id].category === "drawback").slice(0, 1),
  ];
  const salary = clampInteger(fields.salary ?? 0, 0, 10_000_000);
  const yearsRemaining = clampInteger(fields.yearsRemaining ?? 1, 1, 10);
  if (salary === null || yearsRemaining === null) return { error: "Salary and contract length must be valid numbers." };
  return { name, positions, age, overall, potential, heightCm, attributes, activeTraits, salary, yearsRemaining };
}

export function createFantasyPlayer(fields) {
  const values = validatePlayerFields(fields);
  if (values.error) return values;
  const club = String(fields.club ?? "");
  if (!club) return { error: "Choose a club for the player." };
  const salary = clampInteger(fields.salary, 0, 10_000_000);
  const yearsRemaining = clampInteger(fields.yearsRemaining, 1, 5);
  if (salary === null || yearsRemaining === null) return { error: "Salary and contract length must be numbers." };
  const player = createPlayer({
    id: createFantasyId("fantasy"),
    name: values.name,
    club,
    age: values.age,
    positions: values.positions,
    overall: values.overall,
    potential: values.potential,
    salary,
    yearsRemaining,
  });
  return {
    player: {
      ...player,
      ...values,
      club,
      activeTraits: values.activeTraits,
      traits: values.activeTraits,
      development: { ...player.development, potential: values.potential },
    },
    contract: { club, salary, yearsRemaining },
  };
}

export function createLegendPlayer(record, clubName, profile = {}) {
  const age = clampInteger(profile.age, 17, 45);
  const overall = clampInteger(profile.overall, 40, 99);
  const potential = clampInteger(profile.potential, overall ?? 40, 99);
  const heightCm = clampInteger(profile.heightCm, 150, 220);
  const salary = clampInteger(profile.salary, 0, 10_000_000);
  const yearsRemaining = clampInteger(profile.yearsRemaining, 1, 5);
  const positions = selectedPositions(profile.positions);
  if (!record?.name || age === null || overall === null || potential === null || heightCm === null || salary === null || yearsRemaining === null || !positions.length) {
    return { error: "Enter a valid age, position, overall, potential, height, salary and contract length for this legend." };
  }
  if (potential < overall) return { error: "Potential cannot be lower than the player's current overall." };
  const primaryPosition = positions[0];
  const player = createPlayer({
    id: createFantasyId("legend"),
    name: record.name,
    club: clubName || null,
    age,
    positions,
    overall,
    potential,
    salary,
    yearsRemaining,
  });
  // Keep the supplied signature ratings intact, then tune the remaining
  // position-weighted attributes so the displayed overall matches the card.
  const generated = fitAttributesToOverall(player.attributes ?? {}, primaryPosition, overall);
  const signatureAttributes = Object.fromEntries(Object.entries(profile.signatureAttributes ?? {})
    .filter(([key, value]) => allAttributeKeys.includes(key) && Number.isFinite(Number(value)))
    .map(([key, value]) => [key, clampInteger(value, 1, 99)]));
  const attributes = { ...generated, ...signatureAttributes };
  const roleKeys = Object.keys(generated).filter((key) => {
    if (Object.prototype.hasOwnProperty.call(signatureAttributes, key)) return false;
    const probe = { ...attributes, [key]: 99 };
    return calculateOverall(probe, primaryPosition) !== calculateOverall(attributes, primaryPosition);
  });
  let actualOverall = calculateOverall(attributes, primaryPosition);
  for (let attempt = 0; actualOverall !== overall && attempt < 1800; attempt += 1) {
    const direction = actualOverall < overall ? 1 : -1;
    const key = roleKeys[attempt % Math.max(roleKeys.length, 1)];
    if (!key) break;
    const before = attributes[key];
    const next = Math.max(1, Math.min(99, before + direction));
    if (next === before) continue;
    attributes[key] = next;
    const nextOverall = calculateOverall(attributes, primaryPosition);
    if (nextOverall === actualOverall) continue;
    actualOverall = nextOverall;
  }
  const traitAliases = {
    "X Factor": "X_FACTOR", "Clutch Performer": "CLUTCH_PERFORMER", "High Flyer": "HIGH_FLYER",
    "Goal Sneak": "SET_SHOT_SPECIALIST", "Contested Bull": "CONTESTED_BULL",
    "Captain's Leader": "FIELD_GENERAL", "Elite Distributor": "FIELD_GENERAL",
    "Composed Operator": "FIELD_GENERAL", "Creative Playmaker": "X_FACTOR",
    "Outside Runner": "OUTSIDE_RUNNER", "Two-Way Runner": "OUTSIDE_RUNNER",
    "Ruck General": "TAP_SPECIALIST", "Leading Forward": "LEADING_TARGET",
    "Power Forward": "LEADING_TARGET", "Intercept Specialist": "INTERCEPT_DEFENDER",
    "Defensive General": "LOCKDOWN_DEFENDER", "Durable": "DURABLE_PROFESSIONAL",
    "High Work Rate": "DURABLE_PROFESSIONAL", "Relentless Pressure": "DEFENSIVE_FORWARD",
    "Big Game Player": "CLUTCH_PERFORMER",
  };
  const traitPlayer = { positions, attributes, heightCm };
  const eligible = new Set(getEligiblePlayerTraits(traitPlayer).filter((item) => !item.automatic).map((item) => item.id));
  const activeTraits = [...new Set((profile.suggestedTraits ?? []).map((label) => traitAliases[label]).filter((id) => id && eligible.has(id)))].slice(0, 3);
  const legendPlayer = {
    ...player,
    overall: calculateOverall(attributes, primaryPosition),
    potential: Math.max(potential, calculateOverall(attributes, primaryPosition)),
    attributes,
    heightCm,
    activeTraits,
    traits: activeTraits,
    legend: true,
  };
  return { player: legendPlayer, contract: { club: clubName || null, salary, yearsRemaining } };
}
