import { getPlayerTraitTier, getTraitDefinition } from "../data/footballData.js";

// Each trait has its own single-colour vector mark. Current colour comes from
// the badge so the same mark works in dark and light themes.
const paths = {
  CLUTCH_PERFORMER: "M12 3v3m0 12v3M3 12h3m12 0h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2v3l2 1",
  X_FACTOR: "m12 2 2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7Z",
  FIELD_GENERAL: "M5 21V4m0 1c3-3 5 3 9 0v9c-4 3-6-3-9 0m10 5 3-3 3 3",
  DURABLE_PROFESSIONAL: "M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Zm-4 9 3 3 5-6",
  HOT_HEAD: "M12 22c-5 0-8-3-8-7 0-3 2-5 4-7 0 3 2 4 3 4 2-3 1-6 0-9 5 3 9 7 9 12 0 4-3 7-8 7Zm0-2c-2 0-3-2-3-4 1 1 2 1 3 0 1-1 1-2 1-3 2 2 2 3 2 4 0 2-1 3-3 3Z",
  RISKY_CREATOR: "M3 19 18 4m-9 0h9v9M5 10l6 6m4 1 4 4m0-5v5h-5",
  INJURY_PRONE: "M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Zm0 5v5m0 3h.01",
  HIGH_FLYER: "M12 19 3 8l6 2 3-7 3 7 6-2-9 11Zm0-5V7",
  CRUMBING_INSTINCT: "M4 18c2-3 4-4 7-5m-1-4 3 3m1-6 2 2m4 11-3-3M4 21h16",
  SET_SHOT_SPECIALIST: "M12 2v4m0 12v4M2 12h4m12 0h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  DEFENSIVE_FORWARD: "M3 12c2-6 8-8 14-5m-2-4 2 4-4 2m8 3c-2 6-8 8-14 5m2 4-2-4 4-2M10 12h4",
  LEADING_TARGET: "M3 19c5-1 7-5 9-11m-4 1 4-1 2 4m-4 8 5-5 6 1m-6-4 0 3 3 1",
  CONTESTED_BULL: "M4 8 2 3l6 3 4-2 4 2 6-3-2 5m-16 0v6c0 5 3 8 8 8s8-3 8-8V8M8 12h1m6 0h1m-7 5h6",
  CLEARANCE_READER: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-7v2m0 16v2",
  OUTSIDE_RUNNER: "M13 2 5 13h6l-1 9 9-12h-6l1-8Zm-9 4h3m-5 4h4m-4 5h3",
  TAGGING_SPECIALIST: "M12 2v4m0 12v4M2 12h4m12 0h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-3 6 2 2 4-4",
  UNDERSIZED_MID: "M12 2v20M6 7h12M6 12h12M6 17h12M4 4l16 16",
  ONE_PACE_MIDFIELDER: "M3 7h18M3 12h13M3 17h8m8-1 2 2-2 2",
  INTERCEPT_DEFENDER: "M4 19V8l5 3 3-7 3 7 5-3v11l-8 3-8-3Zm5-4 3 2 3-2",
  LOCKDOWN_DEFENDER: "M5 11h14v10H5V11Zm3 0V8a4 4 0 0 1 8 0v3m-4 4v3",
  SPOILING_SPECIALIST: "M6 20V8m0 4-3-3m3 2 3-4m3 13V5m0 6-3-3m3 3 3-4m3 13v-8m0 3-3-3m3 3 3-3",
  REBOUND_LAUNCHER: "M4 17c2 3 5 4 8 4a8 8 0 0 0 8-8M4 17l1-5 5 2M20 7c-2-3-5-4-8-4a8 8 0 0 0-8 8m16-4-1 5-5-2",
  BALL_WATCHER: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 21 21 3",
  TAP_SPECIALIST: "M3 7h18m-9-4v12m-4-4 4 4 4-4m-9 9c3-3 7-3 10 0",
  FOLLOW_UP_RUCK: "M4 4c2 2 3 5 4 8l-3 2 3 6 4-2-2-6m5-9c2 2 3 5 4 8l-3 2 3 6 3-2-2-6",
  RUCK_LIABILITY: "M12 2v7l-3 3 4 2-1 8M3 7h18m-5 6 5 6m0-6-5 6",
};

export function TraitIcon({ id, size = 20, title }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
    {title && <title>{title}</title>}
    <path d={paths[id] ?? "M12 2 3 8l3 12h12l3-12-9-6Z"} />
  </svg>;
}

export default function TraitBadge({ id, player, compact = false }) {
  const definition = getTraitDefinition(id);
  const plus = player && getPlayerTraitTier(player, id) === "plus";
  const colour = plus ? "#facc15" : definition?.category === "drawback" ? "#ff65c8" : "#22f5d2";
  return <span title={definition?.description ?? id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: compact ? "4px 7px" : "6px 9px", borderRadius: 8, border: `1px solid ${colour}77`, color: colour, background: plus ? "#4b350d" : "#10202b", fontWeight: 750, fontSize: compact ? 11 : 12, whiteSpace: "nowrap" }}>
    <TraitIcon id={id} size={compact ? 16 : 19} /><span>{definition?.label ?? id}{plus ? "+" : ""}</span>
  </span>;
}
