import { useState } from "react";
import PotentialStars from "./PotentialStars.jsx";
import TraitBadge from "./TraitBadge.jsx";
import "./PlayerProfile.css";
import { formatContractDuration } from "../engine/contractEngine.js";
import { aggregatePlayerStats, collectSeasonMatches, getHistoricalCareerStats } from "../engine/statisticsEngine.js";
import { isRuckEligible } from "../engine/playerRatingGenerator.js";
import { getPlayerHeightCm } from "../data/playerHeights.js";
import { clubs } from "../data/clubs.js";
import { getSlotSuitability } from "../engine/positionSuitability.js";
import { CORE_ATTRIBUTES_BY_POSITION, ATTRIBUTE_GROUPS, getAttributeLabel, getPlayerFootballData, getEligiblePlayerTraits, getPlayerTraitTier, TRAIT_DEFINITIONS } from "../data/footballData.js";
import { TraitIcon } from "./TraitBadge.jsx";

const POSITION_NAMES = {
  KPF: "Key Forward", FF: "Full Forward", HF: "Half Forward", HFF: "Half Forward Flank", FP: "Forward Pocket", FWD: "Forward",
  MID: "Midfielder", WING: "Winger", W: "Winger", C: "Centre", RR: "Rover", ROV: "Rover", R: "Ruck",
  RUC: "Ruckman", RUCK: "Ruckman", KPD: "Key Defender", KPB: "Key Back", HB: "Half Back", HBF: "Half Back Flank",
  BP: "Back Pocket", CHB: "Centre Half Back", FB: "Full Back", DEF: "Defender",
};
const positionName = (code) => POSITION_NAMES[String(code ?? "").toUpperCase()] ?? String(code ?? "");

// Colour bands on the game's 0-100 scale: 90+ dark green, 80s light green, 70s yellow, 60s orange, 59 or below red.
const ATTRIBUTE_BANDS = [
  { max: 59, className: "band-1" },
  { max: 69, className: "band-2" },
  { max: 79, className: "band-3" },
  { max: 89, className: "band-4" },
  { max: 100, className: "band-5" },
];
const bandFor = (value) => ATTRIBUTE_BANDS.find((band) => value <= band.max) ?? ATTRIBUTE_BANDS[ATTRIBUTE_BANDS.length - 1];

// Pick readable text for a club colour.
function readableOn(hex) {
  const clean = String(hex ?? "").replace("#", "");
  if (clean.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#101828" : "#ffffff";
}

// Same 18 on-ground positions as team selection: [slot key, label].
const GROUND_ROWS = [
  [["FP1", "FP"], ["FF", "FF"], ["FP2", "FP"]],
  [["HF1", "HFF"], ["CHF", "CHF"], ["HF2", "HFF"]],
  [["W1", "W"], ["C", "C"], ["W2", "W"]],
  [["RR", "RR"], ["R", "R"], ["ROV", "ROV"]],
  [["HB1", "HBF"], ["CHB", "CHB"], ["HB2", "HBF"]],
  [["BP1", "BP"], ["FB", "FB"], ["BP2", "BP"]],
];

const formatSalary = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
  return `$${Math.round(amount / 1000).toLocaleString()}k`;
};

function moraleLabel(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 85) return { text: "Superb", pips: 5 };
  if (value >= 70) return { text: "Good", pips: 4 };
  if (value >= 50) return { text: "Okay", pips: 3 };
  if (value >= 35) return { text: "Low", pips: 2 };
  return { text: "Poor", pips: 1 };
}

function AttributeColumn({ title, attributes, player, highlighted }) {
  return (
    <div className="pp-attr-col">
      <h4 className="pp-eyebrow">{title}</h4>
      {attributes.map((attribute) => {
        const value = Math.round(Number(player.attributes?.[attribute] ?? 0));
        const band = bandFor(value);
        const isCore = highlighted.includes(attribute);
        return (
          <div key={attribute} className={`pp-attr-row ${isCore ? "is-core" : ""}`}>
            <span className="pp-attr-name">{getAttributeLabel(attribute)}</span>
            <span className="pp-attr-bar" aria-hidden="true"><span className={`pp-attr-fill ${band.className}`} style={{ width: `${Math.min(100, value)}%` }} /></span>
            <strong className={`pp-attr-value text-${band.className}`}>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function PlayerProfile({
  player,
  playerFitness = {},
  onBack,
  seasonState,
  currentDate,
  onTraitsChange,
  appearance = "dark",
}) {
  const [activePosition, setActivePosition] =
    useState(
      player.positions?.[0] || "MID"
    );

  const highlightedAttributes =
    CORE_ATTRIBUTES_BY_POSITION[activePosition] || [];
  const displayedTechnicalAttributes = isRuckEligible(player)
    ? ATTRIBUTE_GROUPS.technical
    : ATTRIBUTE_GROUPS.technical.filter((attribute) => attribute !== "ruckCraft");

  const overall =
    player.overall ?? 60;
  const heightCm = getPlayerHeightCm(player);
  const eligibleTraits = getEligiblePlayerTraits(player, playerFitness);
  const automaticallySelectedTraits = getPlayerFootballData(player, playerFitness).traitIds.filter((id) => eligibleTraits.some((trait) => trait.id === id));
  const [activeTraitSelection, setActiveTraitSelection] = useState(() => {
    const automaticTraits = eligibleTraits.filter((trait) => trait.automatic).map((trait) => trait.id);
    const saved = [...(Array.isArray(player.activeTraits) ? player.activeTraits : automaticallySelectedTraits), ...automaticTraits];
    const selected = [...new Set(saved)].filter((id) => eligibleTraits.some((trait) => trait.id === id));
    const availableDrawback = eligibleTraits.find((trait) => trait.category === "drawback");
    const positive = selected.filter((id) => TRAIT_DEFINITIONS[id]?.category !== "drawback").slice(0, 3);
    const drawback = automaticTraits[0]
      ?? selected.find((id) => TRAIT_DEFINITIONS[id]?.category === "drawback")
      ?? availableDrawback?.id;
    return [...positive, ...(drawback ? [drawback] : [])];
  });
  const selectedActiveTraits = eligibleTraits.filter((trait) => activeTraitSelection.includes(trait.id)).map((trait) => trait.id);
  const traitIds = getPlayerFootballData({ ...player, activeTraits: selectedActiveTraits }, playerFitness).traitIds;
  const saveActiveTraits = (next) => {
    setActiveTraitSelection(next);
    onTraitsChange?.(next);
  };
  const matchHistory = collectSeasonMatches(seasonState);
  const historical = getHistoricalCareerStats(player);
  const generatedCareer = aggregatePlayerStats(matchHistory, player.id);
  const generatedSeason = aggregatePlayerStats(matchHistory, player.id, seasonState?.seasonYear ?? null);
  const careerGames = (historical?.games ?? 0) + generatedCareer.games;

  const fitnessState = playerFitness?.[player.id] ?? {};
  const condition = Math.round(Number(fitnessState.fitness ?? 100));
  const matchSharpness = Math.round(Number(fitnessState.matchSharpness ?? 65));
  const weeksOut = Number(fitnessState.injury?.weeksRemaining ?? 0);
  const morale = moraleLabel(Number(fitnessState.morale ?? 50));
  const clubMorale = moraleLabel(Number(seasonState?.clubMorale?.[player.club] ?? 50));
  const careerGoals = (historical?.goals ?? 0) + generatedCareer.totals.goals;
  const topTrait = traitIds.map((id) => TRAIT_DEFINITIONS[id]).find((trait) => trait && trait.category !== "drawback");
  const primaryPosition = player.positions?.[0] ?? "MID";
  const slotRatings = Object.fromEntries(GROUND_ROWS.flat().map(([slot]) => [slot, getSlotSuitability(player, slot)]));
  const bestSlotRating = Math.max(...Object.values(slotRatings).map((entry) => entry.overall));
  const clubColours = clubs.find((item) => item.name === player.club)?.colours ?? {};
  const clubPrimary = clubColours.primary ?? "#0c1f45";
  const clubSecondary = clubColours.secondary ?? "#ffffff";
  const heroStyle = { "--pp-club": clubPrimary, "--pp-club-2": clubSecondary, "--pp-on-club": readableOn(clubPrimary) };
  const salary = player.contract?.salary ?? 0;
  const contractText = formatContractDuration(player.contract?.yearsRemaining, { currentDate, seasonYear: seasonState?.seasonYear });
  const growth = Math.round(Number(player.development?.growthThisSeason ?? 0));
  const seasonAverages = generatedSeason.averages;
  const nameParts = String(player.name ?? "").trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  const attributeColumns = [
    ["Technical", displayedTechnicalAttributes],
    ["Football IQ", ATTRIBUTE_GROUPS.footballIQ],
    ["Mental", ATTRIBUTE_GROUPS.mental],
    ["Physical", ATTRIBUTE_GROUPS.physical],
  ];

  return (
    <div className={`player-profile ${appearance === "light" ? "theme-light" : "theme-dark"}`}>
      <button type="button" className="pp-back" onClick={onBack}>← Back</button>

      <div className="pp-top">
        <section className="pp-hero" aria-label="Player summary" style={heroStyle}>
          <div className="pp-hero-main">
            <div className="pp-avatar" aria-hidden="true">{initials}</div>
            <div className="pp-hero-text">
              <div className="pp-hero-positions">
                {player.positions?.map((position) => <span key={position} className="pp-pos-chip">{position}</span>)}
                <span className="pp-pos-name">{positionName(primaryPosition)}</span>
              </div>
              <div className="pp-first-name">{firstName}</div>
              <h2 className="pp-last-name">{lastName || firstName}</h2>
              <div className="pp-hero-sub">{player.club}{topTrait ? ` • ${topTrait.label}` : ""}</div>
            </div>
            <div className="pp-hero-rating" aria-label="Rating and potential">
              <span className="pp-hero-eyebrow">Rating</span>
              <span className="pp-hero-rating-number">{overall}</span>
              <span className="pp-hero-rating-divider" />
              <span className="pp-hero-eyebrow">Potential</span>
              <span className="pp-stars"><PotentialStars player={player} size="1.4rem" /></span>
            </div>
          </div>
          <dl className="pp-hero-stats">
            <div><dt>Age</dt><dd>{player.age}</dd></div>
            <div><dt>#</dt><dd>{player.jumperNumber ?? "—"}</dd></div>
            <div><dt>Height</dt><dd>{heightCm ? `${heightCm} cm` : "—"}</dd></div>
            <div><dt>Games</dt><dd>{careerGames}</dd></div>
            <div><dt>Goals</dt><dd>{careerGoals}</dd></div>
          </dl>
        </section>

        <section className="pp-card pp-status" aria-label="Status">
          <div className="pp-eyebrow">Status</div>
          <div className="pp-status-grid">
            <div className="pp-tile">
              <span className="pp-eyebrow">Condition</span>
              <strong>{weeksOut > 0 ? `Out ${weeksOut}w` : `${condition}%`}</strong>
              <span className="pp-meter"><span style={{ width: `${weeksOut > 0 ? 0 : condition}%` }} /></span>
            </div>
            <div className="pp-tile">
              <span className="pp-eyebrow">Match fitness</span>
              <strong>{matchSharpness}%</strong>
              <span className="pp-meter"><span style={{ width: `${matchSharpness}%` }} /></span>
            </div>
            <div className="pp-tile">
              <span className="pp-eyebrow">Player morale</span>
              <strong>{morale?.text ?? "—"}</strong>
              <span className="pp-pips" aria-hidden="true">{[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={pip <= (morale?.pips ?? 0) ? "is-on" : ""} />)}</span>
            </div>
            <div className="pp-tile">
              <span className="pp-eyebrow">Club morale</span>
              <strong>{clubMorale?.text ?? "—"}</strong>
              <span className="pp-pips" aria-hidden="true">{[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={pip <= (clubMorale?.pips ?? 0) ? "is-on" : ""} />)}</span>
            </div>
            <div className="pp-tile">
              <span className="pp-eyebrow">Growth this season</span>
              <strong>{growth > 0 ? `+${growth}` : growth}</strong>
              <span className="pp-tile-note">{player.development?.trainingFocus ?? "Balanced"} focus</span>
            </div>
          </div>
          <div className="pp-contract-block">
            <span className="pp-eyebrow">Contract</span>
            <strong className="pp-contract-salary">{formatSalary(salary)}<small> a year</small></strong>
            <span className="pp-contract-term">{contractText}</span>
          </div>
        </section>
      </div>

      <section className="pp-card" aria-label="Attributes">
        <div className="pp-card-head">
          <h3 className="pp-eyebrow">Attributes</h3>
        </div>
        {(player.positions?.length ?? 0) > 1 && <div className="pp-highlight-picker">
          <span>Key attributes for</span>
          {player.positions.map((position) => <button key={position} type="button" aria-pressed={activePosition === position} className={activePosition === position ? "is-active" : ""} onClick={() => setActivePosition(position)}>{position}</button>)}
        </div>}
        <div className="pp-attr-grid">
          {attributeColumns.map(([title, attributes]) => <AttributeColumn key={title} title={title} attributes={attributes} player={player} highlighted={highlightedAttributes} />)}
        </div>
        <p className="pp-note">Attributes marked in bold are core to {activePosition}.</p>
      </section>

      <section className="pp-card" aria-label="Positions">
        <h3 className="pp-eyebrow">Positions</h3>
        <p className="pp-note" style={{ marginTop: 4 }}>Overall in every position on the ground. Listed positions are outlined.</p>
        <div className="pp-ground">
          <svg className="pp-ground-markings" viewBox="0 0 1000 1200" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" stroke="rgba(220, 242, 228, 0.55)" strokeWidth="4" vectorEffect="non-scaling-stroke">
              <path d="M150 190 Q500 620 850 190" />
              <path d="M150 1010 Q500 580 850 1010" />
              <rect x="285" y="420" width="430" height="360" />
              <circle cx="500" cy="600" r="58" />
            </g>
          </svg>
          {GROUND_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="pp-ground-row">
              {row.map(([slot, label]) => {
                const entry = slotRatings[slot];
                const listed = entry.fit === "natural";
                return (
                  <div key={slot} className={`pp-ground-slot ${listed ? "is-listed" : ""} ${entry.overall === bestSlotRating ? "is-best" : ""}`} title={`${positionName(label)}: ${entry.overall} (${entry.fit} fit)`}>
                    <span className="pp-ground-label">{label}</span>
                    <span className={`pp-ground-rating text-${bandFor(entry.overall).className}`}>{entry.overall}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="pp-card" aria-label="Season statistics">
        <h3 className="pp-eyebrow">Statistics</h3>
        <div className="pp-stat-grid">
          <div className="pp-tile"><span className="pp-eyebrow">Career games</span><strong>{careerGames}</strong></div>
          <div className="pp-tile"><span className="pp-eyebrow">Season {seasonState?.seasonYear ?? "—"}</span><strong>{generatedSeason.games}</strong></div>
          <div className="pp-tile"><span className="pp-eyebrow">Disposals / game</span><strong>{seasonAverages.disposals}</strong></div>
          <div className="pp-tile"><span className="pp-eyebrow">Goals / game</span><strong>{seasonAverages.goals}</strong></div>
          <div className="pp-tile"><span className="pp-eyebrow">Marks / game</span><strong>{seasonAverages.marks}</strong></div>
          <div className="pp-tile"><span className="pp-eyebrow">Tackles / game</span><strong>{seasonAverages.tackles}</strong></div>
        </div>
        <p className="pp-note">Goals and averages count matches played in this career.</p>
      </section>

      <section className="pp-card" aria-label="Traits">
        <h3 className="pp-eyebrow">Traits</h3>
        {traitIds.length > 0 && <div className="pp-trait-badges">{traitIds.map((id) => <TraitBadge key={id} id={id} player={player} />)}</div>}

            
            <p style={{ color: "var(--pp-muted)", marginTop: 0 }}>Choose up to three active positive traits. If this player qualifies for a drawback, one must remain selected. Effects activate only in suitable match situations.</p>
            <p style={{ margin: "0 0 10px", color: "var(--pp-muted)", fontSize: 13 }}>Positive traits: {selectedActiveTraits.filter((id) => TRAIT_DEFINITIONS[id]?.category !== "drawback").length}/3 · Drawback: {eligibleTraits.some((trait) => trait.category === "drawback") ? (selectedActiveTraits.some((id) => TRAIT_DEFINITIONS[id]?.category === "drawback") ? "selected" : "required") : "none available"}</p>
            {eligibleTraits.length ? <div style={{ display: "grid", gap: 10 }}>
              {eligibleTraits.map((trait) => {
                const id = trait.id;
                const tier = getPlayerTraitTier(player, id);
                const isDrawback = trait.category === "drawback";
                const isAutomatic = Boolean(trait.automatic);
                const selected = activeTraitSelection.includes(id);
                const positiveCount = selectedActiveTraits.filter((selectedId) => TRAIT_DEFINITIONS[selectedId]?.category !== "drawback").length;
                const disabled = !selected && !isDrawback && positiveCount >= 3;
                const requirements = [
                  ...Object.entries(trait.assignmentMinimums).map(([key, minimum]) => `${getAttributeLabel(key)} ${minimum}+`),
                  ...Object.entries(trait.assignmentMaximums ?? {}).map(([key, maximum]) => `${getAttributeLabel(key)} ≤${maximum}`),
                ];
                return <article key={id} style={{ padding: 14, borderRadius: 12, border: selected ? "1px solid var(--pp-accent2)" : "1px solid var(--pp-border)", background: "var(--pp-surface)", opacity: disabled ? 0.58 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, color: isDrawback ? "var(--pp-drawback)" : tier === "plus" ? "var(--pp-plus)" : "var(--pp-accent2)" }}>
                    <TraitIcon id={id} size={26} />
                    <strong>{trait.label}</strong>
                    <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800 }}>{isDrawback ? "DRAWBACK" : tier === "plus" ? "TRAIT+" : "TRAIT"}</span>
                  </div>
                  <p style={{ margin: "9px 0", lineHeight: 1.5 }}>{trait.description}</p>
                  <small style={{ display: "block", color: "var(--pp-muted)" }}>Applies to: {trait.eligiblePositionFamilies.join(", ")}</small>
                  {requirements.length > 0 && <small style={{ display: "block", marginTop: 4, color: "var(--pp-muted)" }}>Attribute requirements: {requirements.join(" · ")}</small>}
                  <button type="button" disabled={disabled || isAutomatic} aria-pressed={selected} onClick={() => {
                    if (isDrawback) {
                      saveActiveTraits([...activeTraitSelection.filter((selectedId) => TRAIT_DEFINITIONS[selectedId]?.category !== "drawback"), id]);
                    } else {
                      const next = selected ? activeTraitSelection.filter((selectedId) => selectedId !== id) : [...activeTraitSelection.filter((selectedId) => TRAIT_DEFINITIONS[selectedId]?.category === "drawback"), ...activeTraitSelection.filter((selectedId) => TRAIT_DEFINITIONS[selectedId]?.category !== "drawback"), id];
                      saveActiveTraits(next);
                    }
                  }} style={{ marginTop: 10, padding: "7px 11px", borderRadius: 8, border: "1px solid var(--pp-border)", background: selected ? "#0f766e" : "var(--pp-chip)", color: selected ? "#fff" : "var(--pp-text)", cursor: disabled || isAutomatic ? "not-allowed" : "pointer", fontWeight: 700 }}>{isAutomatic ? "Automatically applied" : selected ? (isDrawback ? "Selected drawback" : "Active") : (isDrawback ? "Select drawback" : "Activate trait")}</button>
                </article>;
              })}
            </div> : <p style={{ color: "var(--pp-muted)" }}>This player has no qualifying traits at their current attributes and positions.</p>}
          
      </section>
    </div>
  );
}
