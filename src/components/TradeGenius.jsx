import { useEffect, useMemo, useState } from "react";
import { formatDraftPick } from "../engine/draftEngine.js";
import { clubs } from "../data/clubs.js";
import {
  POSITION_CODES,
  POSITION_TYPES,
  assetKey,
  generateShopSuggestions,
  generateTargetSuggestions,
} from "../engine/tradeGeniusEngine.js";

const ACCENT = "#ea580c";
const MAX_WANTS = 3;
const SORTS = [
  ["value", "Best value"],
  ["quality", "Best player"],
  ["cost", "Cheapest"],
];

const positionsText = (player) => (player.positions?.length ? player.positions : player.position ? [player.position] : []).join(", ") || "—";
let wantCounter = 0;
const newWant = (kind = "position", value = "HF") => ({ id: `want-${Date.now()}-${wantCounter += 1}`, kind, value, minOverall: "" });

function PlayerLine({ player, palette }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
      <span style={{ fontWeight: 700 }}>{player.name}</span>
      <span style={{ color: palette.muted, fontSize: 12, whiteSpace: "nowrap" }}>{positionsText(player)} · {player.overall} OVR · {player.age}y</span>
    </div>
  );
}

function PackageLines({ pack, palette }) {
  return (
    <>
      {pack.players.map((player) => <PlayerLine key={`p-${player.id}`} player={player} palette={palette} />)}
      {pack.picks.map((pick) => <div key={`k-${pick.id}`} style={{ padding: "3px 0", fontWeight: 700 }}>{formatDraftPick(pick)}</div>)}
    </>
  );
}

export default function TradeGenius({
  palette,
  lightMode,
  cardStyle,
  userClub,
  userClubPlayers,
  userDraftPicks,
  databasePlayers,
  draftPickAssets,
  valuationContext,
  tradePeriodOpen,
  canTradePlayer,
  buildCapCheck,
  shopOutgoingAssetKeys,
  setShopOutgoingAssetKeys,
  modeRequest,
  resetSequence = 0,
  notice = null,
  onAccept,
  onOpenManualShop,
}) {
  const [mode, setMode] = useState("TARGET");
  const [wants, setWants] = useState(() => [newWant("position", "HF")]);
  const [excludedKeys, setExcludedKeys] = useState([]);
  const [assetFilter, setAssetFilter] = useState("");
  const [sort, setSort] = useState("value");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allowMultiClub, setAllowMultiClub] = useState(true);

  useEffect(() => {
    if (modeRequest?.sequence) { setMode(modeRequest.mode ?? "SHOP"); setResult(null); }
  }, [modeRequest?.sequence]);

  useEffect(() => { if (resetSequence) { setResult(null); setExcludedKeys([]); } }, [resetSequence]);

  const assetRows = useMemo(() => [
    ...userClubPlayers.map((player) => ({ key: assetKey("player", player.id), label: player.name, detail: `${positionsText(player)} · ${player.overall} OVR · ${player.age}y`, overall: Number(player.overall), blocked: !canTradePlayer(player), kind: "Player" })),
    ...userDraftPicks.map((pick) => ({ key: assetKey("pick", pick.id), label: formatDraftPick(pick), detail: "Draft pick", overall: -1, blocked: false, kind: "Pick" })),
  ].sort((a, b) => b.overall - a.overall), [userClubPlayers, userDraftPicks, canTradePlayer]);
  const visibleAssets = assetRows.filter((row) => !assetFilter.trim() || row.label.toLowerCase().includes(assetFilter.trim().toLowerCase()));
  const excludedSet = useMemo(() => new Set(excludedKeys), [excludedKeys]);

  const toggleExcluded = (key) => { setExcludedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); setResult(null); };
  const updateWant = (id, patch) => { setWants((current) => current.map((want) => want.id === id ? { ...want, ...patch } : want)); setResult(null); };
  const toggleShopKey = (key) => {
    setShopOutgoingAssetKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : current.length >= 3 ? current : [...current, key]);
    setResult(null);
  };

  const run = () => {
    setBusy(true);
    // Let the "working" state paint before the (synchronous) search runs.
    window.setTimeout(() => {
      const base = { userClubName: userClub.name, players: databasePlayers, draftPickAssets, context: valuationContext, canTrade: canTradePlayer };
      const next = mode === "SHOP"
        ? generateShopSuggestions({ ...base, outgoingKeys: shopOutgoingAssetKeys, clubNames: clubs.map((club) => club.name), allowMultiClub, capCheck: buildCapCheck() })
        : generateTargetSuggestions({ ...base, userClub, wants, excludedKeys, capCheck: buildCapCheck() });
      setResult({ mode, ...next });
      setBusy(false);
    }, 20);
  };

  const sorted = useMemo(() => {
    const list = [...(result?.suggestions ?? [])];
    if (sort === "quality") list.sort((a, b) => (b.averageOverall ?? 0) - (a.averageOverall ?? 0) || b.netValue - a.netValue);
    else if (sort === "cost") list.sort((a, b) => a.outgoingCost - b.outgoingCost);
    else list.sort((a, b) => (b.marketIn - b.marketOut) - (a.marketIn - a.marketOut) || b.netValue - a.netValue);
    return list.slice(0, 8);
  }, [result, sort]);

  const pill = (active) => ({ padding: "8px 12px", border: `1px solid ${active ? ACCENT : palette.border}`, borderRadius: 999, background: active ? ACCENT : palette.surface, color: active ? "#fff" : palette.text, fontWeight: 700, cursor: "pointer", fontSize: 13 });
  const field = { padding: "8px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.input, color: palette.text, font: "inherit", fontSize: 14 };
  const smallButton = { padding: "6px 10px", border: `1px solid ${palette.border}`, borderRadius: 7, background: palette.surface, color: palette.text, fontSize: 12, fontWeight: 700, cursor: "pointer" };
  const multiClubTargets = wants.length > 1;

  return (
    <section aria-label="Trade Genius">
      {notice && <div role="status" style={{ ...cardStyle, borderColor: notice.ok ? "#22c55e" : "#f59e0b", color: notice.ok ? "#22c55e" : "#f59e0b", fontWeight: 700 }}>{notice.text}</div>}
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 6px" }}>Trade Genius</h3>
        <p style={{ margin: "0 0 12px", color: palette.muted, fontSize: 13 }}>
          Tell Trade Genius what you need and it builds trades clubs will accept. Clubs protect their best players and will not hand over far more value than they receive. Trade Chain lets you name up to three targets and links clubs together, splitting your assets so every club says yes. Shop my assets can also split your assets across clubs.
        </p>
        {!tradePeriodOpen && <p style={{ color: "#f59e0b", margin: "0 0 10px" }}>Trading is available during the two Trade Period weeks. You can still preview suggestions after that.</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={pill(mode === "TARGET")} onClick={() => { setMode("TARGET"); setResult(null); }}>Trade Chain</button>
          <button type="button" style={pill(mode === "SHOP")} onClick={() => { setMode("SHOP"); setResult(null); }}>Shop my assets</button>
        </div>
      </div>

      {mode === "TARGET" && (
        <div style={cardStyle}>
          <h4 style={{ margin: "0 0 4px" }}>Build your Trade Chain</h4>
          <p style={{ margin: "0 0 8px", color: palette.muted, fontSize: 13 }}>Pick one target for a single trade, or add up to three to chain several clubs into one deal.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {wants.map((want, index) => (
              <div key={want.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: palette.muted, fontSize: 12, width: 56 }}>Target {index + 1}</span>
                <select aria-label="Search by" value={want.kind} onChange={(event) => updateWant(want.id, { kind: event.target.value, value: event.target.value === "type" ? Object.keys(POSITION_TYPES)[0] : POSITION_CODES[5] })} style={field}>
                  <option value="position">Position</option>
                  <option value="type">Type</option>
                </select>
                <select aria-label="Position or type" value={want.value} onChange={(event) => updateWant(want.id, { value: event.target.value })} style={field}>
                  {(want.kind === "type" ? Object.keys(POSITION_TYPES) : POSITION_CODES).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <input aria-label="Minimum overall" type="number" min="40" max="99" placeholder="Min OVR (auto)" value={want.minOverall} onChange={(event) => updateWant(want.id, { minOverall: event.target.value })} style={{ ...field, width: 130 }} />
                {wants.length > 1 && <button type="button" style={smallButton} onClick={() => { setWants((current) => current.filter((item) => item.id !== want.id)); setResult(null); }}>Remove</button>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={smallButton} disabled={wants.length >= MAX_WANTS} onClick={() => { setWants((current) => [...current, newWant("position", "KPD")]); setResult(null); }}>+ Add another target</button>
            <span style={{ color: palette.muted, fontSize: 12 }}>{multiClubTargets ? "Multi-club: targets at different clubs are traded together; targets at the same club are combined into one deal." : "Add up to three targets to trade with several clubs at once."}</span>
          </div>
        </div>
      )}

      {mode === "SHOP" && (
        <div style={cardStyle}>
          <h4 style={{ margin: "0 0 4px" }}>Assets to shop ({shopOutgoingAssetKeys.length}/3)</h4>
          <p style={{ margin: "0 0 8px", color: palette.muted, fontSize: 13 }}>Trade Genius will find the best return each club will give for these assets. This is the same selection used in Shop Your Assets.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px", fontSize: 13 }}>
            <input type="checkbox" checked={allowMultiClub} onChange={(event) => { setAllowMultiClub(event.target.checked); setResult(null); }} />
            Allow multi-club trades (split these assets between up to three clubs)
          </label>
          <AssetTable rows={assetRows} selectedKeys={shopOutgoingAssetKeys} onToggle={toggleShopKey} palette={palette} lightMode={lightMode} actionLabel="Shop" disabledWhen={(row) => row.blocked || (!shopOutgoingAssetKeys.includes(row.key) && shopOutgoingAssetKeys.length >= 3)} />
        </div>
      )}

      {mode === "TARGET" && (
        <div style={cardStyle}>
          <h4 style={{ margin: "0 0 4px" }}>Exclude assets ({excludedKeys.length} excluded)</h4>
          <p style={{ margin: "0 0 8px", color: palette.muted, fontSize: 13 }}>Excluded players and picks will never appear in a suggested trade.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input aria-label="Filter assets" placeholder="Filter assets…" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)} style={{ ...field, width: 180 }} />
            <button type="button" style={smallButton} onClick={() => { setExcludedKeys(assetRows.filter((row) => row.kind === "Player").slice(0, 10).map((row) => row.key)); setResult(null); }}>Exclude top 10 players</button>
            <button type="button" style={smallButton} onClick={() => { setExcludedKeys(assetRows.filter((row) => row.kind === "Pick").map((row) => row.key)); setResult(null); }}>Exclude all picks</button>
            <button type="button" style={smallButton} disabled={!excludedKeys.length} onClick={() => { setExcludedKeys([]); setResult(null); }}>Clear</button>
          </div>
          <AssetTable rows={visibleAssets} selectedKeys={excludedKeys} onToggle={toggleExcluded} palette={palette} lightMode={lightMode} actionLabel="Exclude" disabledWhen={() => false} selectedStyleDanger />
        </div>
      )}

      <div style={{ ...cardStyle, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={run} disabled={busy || (mode === "SHOP" && !shopOutgoingAssetKeys.length)} style={{ padding: "10px 16px", border: 0, borderRadius: 9, background: ACCENT, color: "#fff", fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Searching…" : mode === "SHOP" ? "Find best trades" : wants.length > 1 ? "Build trade chain" : "Generate trades"}</button>
        {mode === "SHOP" && <button type="button" style={smallButton} onClick={onOpenManualShop}>Shop manually instead</button>}
      </div>

      {result && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>{sorted.length ? `${sorted.length} trade${sorted.length === 1 ? "" : "s"} clubs will accept` : "No trades found"}</h4>
            {sorted.length > 1 && (
              <div style={{ display: "flex", gap: 6 }}>
                {SORTS.map(([key, label]) => <button key={key} type="button" style={pill(sort === key)} onClick={() => setSort(key)}>{label}</button>)}
              </div>
            )}
          </div>
          {!sorted.length && <p style={{ color: palette.muted, margin: 0 }}>{result.diagnostics?.reason ?? "Nothing matched."}</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {sorted.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} palette={palette} lightMode={lightMode} canAccept={tradePeriodOpen} onAccept={() => onAccept(suggestion)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AssetTable({ rows, selectedKeys, onToggle, palette, lightMode, actionLabel, disabledWhen, selectedStyleDanger = false }) {
  return (
    <div style={{ maxHeight: 300, overflow: "auto", border: `1px solid ${palette.border}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 480 }}>
        <thead><tr style={{ color: palette.muted, borderBottom: `1px solid ${palette.border}`, fontSize: 12 }}>
          <th style={{ padding: 8 }}>{actionLabel}</th><th style={{ padding: 8 }}>Asset</th><th style={{ padding: 8 }}>Details</th>
        </tr></thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedKeys.includes(row.key);
            const disabled = disabledWhen(row);
            return (
              <tr key={row.key} style={{ borderBottom: `1px solid ${palette.border}`, opacity: disabled && !selected ? 0.5 : 1, background: selected ? (selectedStyleDanger ? (lightMode ? "#fef2f2" : "#2a1515") : (lightMode ? "#fff7ed" : "#2a1b16")) : "transparent" }}>
                <td style={{ padding: 8, width: 70 }}><input type="checkbox" aria-label={`${actionLabel} ${row.label}`} checked={selected} disabled={disabled && !selected} onChange={() => onToggle(row.key)} /></td>
                <td style={{ padding: 8, fontWeight: 700 }}>{row.label}{row.blocked ? <span style={{ color: palette.muted, fontWeight: 400 }}> · recently moved</span> : null}</td>
                <td style={{ padding: 8, color: palette.muted, fontSize: 13 }}>{row.detail}</td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={3} style={{ padding: 12, color: palette.muted }}>No assets to show.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionCard({ suggestion, palette, lightMode, canAccept, onAccept }) {
  const legs = suggestion.legs;
  const marketGain = Math.round((suggestion.marketIn ?? 0) - (suggestion.marketOut ?? 0));
  return (
    <article style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 12, background: lightMode ? "#f8fafc" : "#111c2e" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <strong>{suggestion.multiClub ? `${legs.length}-club trade` : legs[0].club}</strong>
        <span style={{ fontSize: 12, color: palette.muted, fontWeight: 700 }}>
          Market value: you give {Math.round(suggestion.marketOut ?? 0).toLocaleString()} · you get {Math.round(suggestion.marketIn ?? 0).toLocaleString()}
          <span style={{ color: marketGain >= 0 ? "#22c55e" : "#f59e0b" }}> ({marketGain >= 0 ? "+" : ""}{marketGain.toLocaleString()})</span>
        </span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {legs.map((leg) => (
          <div key={leg.club} style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10 }}>
            {(suggestion.multiClub || suggestion.mode === "TARGET") && <div style={{ fontWeight: 800, marginBottom: 6 }}>{leg.club}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: 800 }}>YOU GIVE</div>
                <PackageLines pack={leg.give} palette={palette} />
              </div>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: 800 }}>YOU GET</div>
                <PackageLines pack={leg.receive} palette={palette} />
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#22c55e" }}>{leg.club} values your package at {leg.offeredValue.toLocaleString()} pts and needs {leg.requiredValue.toLocaleString()}.</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: palette.muted }}>
        {suggestion.bestPlayersLost ? `${suggestion.bestPlayersLost} of your best-23 players ${suggestion.bestPlayersLost === 1 ? "goes" : "go"} out. ` : "No best-23 players leave. "}
        Incoming players still need to agree contract terms{suggestion.multiClub ? "; all clubs' legs complete together or not at all" : ""}.
      </div>
      {suggestion.warning && <div style={{ marginTop: 6, fontSize: 12, color: "#f59e0b" }}>{suggestion.warning}</div>}
      <div style={{ marginTop: 10 }}>
        <button type="button" disabled={!canAccept} onClick={onAccept} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: canAccept ? ACCENT : "#64748b", color: "#fff", fontWeight: 800, cursor: canAccept ? "pointer" : "not-allowed" }}>Accept &amp; negotiate contracts</button>
      </div>
    </article>
  );
}