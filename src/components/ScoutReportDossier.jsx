import { useEffect, useState } from 'react';
import { getScoutingReportInsights } from '../engine/scoutingReportInsights.js';

const ink = '#f8fafc';
const muted = '#94a3b8';
const border = '#334155';
const amber = '#fbbf24';
const tabs = [
  ['SUMMARY', 'Overview'], ['ATTRIBUTES', 'Attributes'],
  ['SQUAD', 'Squad comparison'], ['PROJECTION', 'Projection'],
];
const panel = { background: '#101b30', border: `1px solid ${border}`, borderRadius: 12, padding: 18 };

function RangeBar({ low, high, marker, max = 99 }) {
  const left = Math.min(100, Math.max(0, low / max * 100));
  const width = Math.max(2, (high - low) / max * 100);
  const hasMarker = marker != null && Number.isFinite(Number(marker));
  const markerLeft = Math.min(100, Math.max(0, Number(marker) / max * 100));
  return <div role="img" aria-label={`Scouted range ${low} to ${high}${hasMarker ? `; current player ${marker}` : ''}`} style={{ height: hasMarker ? 17 : 7, borderRadius: 8, background: '#253349', position: 'relative' }}>
    <span style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, borderRadius: 8, background: amber }} />
    {hasMarker && <span style={{ position: 'absolute', left: `${markerLeft}%`, top: -4, bottom: -4, width: 3, transform: 'translateX(-50%)', borderRadius: 2, background: '#22d3ee', boxShadow: '0 0 7px #22d3ee', zIndex: 1 }} />}
  </div>;
}

export default function ScoutReportDossier({ report, dossier, player, squad = [], freshness, isShortlisted, onToggleShortlist, onRequestUpdate, updatePending, updateUnavailableReason, nextAccuracy, onViewInRecruitment, onClose }) {
  const [tab, setTab] = useState('SUMMARY');
  const [selectedPeerId, setSelectedPeerId] = useState(null);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!dossier) return null;
  const best = report?.fit?.strongest;
  const weakest = report?.fit?.weakest;
  const reportAge = dossier.age ?? player?.age;
  const confidence = dossier.confidence ?? Math.round(Number(report?.accuracy ?? 0.55) * 100);
  const overall = Number(report?.estimatedOverall ?? player?.overall ?? 60);
  const currentRange = { low: Math.max(40, overall - dossier.halfWidth), high: Math.min(99, overall + dossier.halfWidth) };
  const insights = getScoutingReportInsights(dossier, report, squad);
  const selectedPeer = (dossier.peers ?? []).find(peer => String(peer.playerId) === String(selectedPeerId));
  const currentPeer = selectedPeer && squad.find(candidate => String(candidate.id) === String(selectedPeer.playerId));
  return <div onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,.86)', display: 'grid', placeItems: 'center', padding: 16 }}>
    <section role="dialog" aria-modal="true" aria-label={`Scout report for ${dossier.playerName}`} style={{ width: 'min(1080px, 100%)', maxHeight: 'min(900px, 92vh)', overflowY: 'auto', color: ink, background: '#0b1426', border: `1px solid ${amber}`, borderRadius: 18, boxShadow: '0 24px 75px #000a' }}>
      <header style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${border}`, background: 'linear-gradient(135deg,#19243b,#0b1426 70%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
          <div>
            <div style={{ color: amber, letterSpacing: 3, fontSize: 11, fontWeight: 800 }}>RECRUITMENT INTELLIGENCE · SCOUT DOSSIER</div>
            <h2 style={{ margin: '8px 0 5px', fontSize: 'clamp(24px,3vw,34px)' }}>{dossier.playerName}</h2>
            <div style={{ color: muted }}>{dossier.club || player?.club || 'Draft prospect'} · {dossier.positions?.join(' / ') || 'Position unknown'} · Age {reportAge ?? '—'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close scout report" style={{ color: ink, background: '#243247', border: `1px solid ${border}`, borderRadius: 9, fontSize: 20, width: 38, height: 38, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <span style={{ background: '#1f3241', padding: '8px 11px', borderRadius: 8 }}>Scout confidence <strong style={{ color: amber }}>{confidence}%</strong></span>
          <span style={{ background: '#1f3241', padding: '8px 11px', borderRadius: 8 }}>Estimated OVR <strong style={{ color: amber }}>{currentRange.low}–{currentRange.high}</strong></span>
          <span style={{ background: '#1f3241', padding: '8px 11px', borderRadius: 8 }}>Assessed <strong>{report?.assessedOn ?? '—'}</strong></span>
          <span style={{ background: '#1f3241', padding: '8px 11px', borderRadius: 8 }}>Freshness <strong style={{ color: freshness?.status === 'STALE' ? '#fca5a5' : freshness?.status === 'AGING' ? amber : '#4ade80' }}>{freshness?.status === 'UNKNOWN' ? freshness.label : `${freshness?.status === 'CURRENT' ? 'Current' : freshness?.status === 'AGING' ? 'Aging' : 'Stale'} · ${freshness?.label}`}</strong></span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
          <button type="button" onClick={onToggleShortlist} style={{ padding: '9px 13px', borderRadius: 8, border: `1px solid ${amber}`, background: isShortlisted ? '#854d0e' : '#1e293b', color: ink, cursor: 'pointer' }}>{isShortlisted ? '★ Remove from shortlist' : '☆ Add to shortlist'}</button>
          <button type="button" onClick={onViewInRecruitment} style={{ padding: '9px 13px', borderRadius: 8, border: 0, background: '#ea580c', color: ink, cursor: 'pointer' }}>View in recruitment →</button>
          <button type="button" disabled={updatePending} onClick={onRequestUpdate} style={{ padding: '9px 13px', borderRadius: 8, border: `1px solid ${border}`, background: '#1e293b', color: ink, cursor: updatePending ? 'default' : 'pointer' }}>{updateUnavailableReason ?? `Scout again · ≈${Math.round(Number(nextAccuracy) * 100)}% confidence`}</button>
        </div>
      </header>
      <nav aria-label="Scout report sections" style={{ display: 'flex', gap: 6, padding: '12px 18px', overflowX: 'auto', borderBottom: `1px solid ${border}` }}>
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} style={{ whiteSpace: 'nowrap', padding: '9px 14px', borderRadius: 9, border: `1px solid ${tab === id ? '#f59e0b' : border}`, background: tab === id ? '#8c3b0c' : '#1e293b', color: ink, fontWeight: 750, cursor: 'pointer' }}>{label}</button>)}
      </nav>
      <div style={{ padding: 22 }}>
        {tab === 'SUMMARY' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          <div style={panel}><div style={{ color: amber, fontWeight: 800, marginBottom: 9 }}>SCOUT'S VERDICT</div><p style={{ margin: 0, lineHeight: 1.6 }}>{report?.fit?.summary ?? 'A tactical assessment is not available for this report.'}</p></div>
          <div style={panel}><div style={{ color: amber, fontWeight: 800, marginBottom: 9 }}>TACTICAL ROLE</div><p style={{ margin: 0, lineHeight: 1.6 }}>Best projected style: <strong>{best?.name ?? 'Undetermined'}</strong>{best ? ` (${best.after}% ±${report.fit.margin})` : ''}. {weakest ? `Least certain fit: ${weakest.name}.` : ''}</p></div>
          <div style={panel}><div style={{ color: amber, fontWeight: 800, marginBottom: 9 }}>OBSERVED TRAITS</div>{dossier.traits?.length ? <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{dossier.traits.map(trait => <span key={trait.id} style={{ border: `1px solid ${trait.kind === 'drawback' ? '#ef4444' : '#38bdf8'}`, borderRadius: 7, color: trait.kind === 'drawback' ? '#fca5a5' : '#67e8f9', padding: '5px 8px', fontSize: 12 }}>{trait.label}</span>)}</div> : <p style={{ color: muted, margin: 0 }}>No trait identified at this confidence. A further assessment may reveal more.</p>}</div>
          {insights.pros.map((pro, index) => <div key={`pro-${index}`} style={{ ...panel, borderColor: '#22c55e' }}><div style={{ color: '#4ade80', fontWeight: 800, marginBottom: 9 }}>PRO {index + 1} · {pro.title.toUpperCase()}</div><p style={{ margin: 0, lineHeight: 1.6 }}>{pro.detail}</p></div>)}
          <div style={{ ...panel, border: '1px solid #ff315c', boxShadow: 'inset 0 0 0 1px #ff315c44, 0 0 15px #ff315c22' }}><div style={{ color: '#ff5a78', fontWeight: 800, marginBottom: 9 }}>CON · {insights.con.title.toUpperCase()}</div><p style={{ margin: 0, lineHeight: 1.6 }}>{insights.con.detail}</p></div>
        </div>}
        {tab === 'ATTRIBUTES' && <><p style={{ color: muted, marginTop: 0 }}>Scout estimates by category. Narrower bands reflect stronger scouting.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 14 }}>
          {dossier.groups?.map(group => <section key={group.id} style={panel}><h3 style={{ color: amber, margin: '0 0 12px' }}>{group.name}</h3>{group.attributes?.map(attribute => <div key={attribute.key} style={{ display: 'grid', gridTemplateColumns: '125px 1fr 65px', gap: 9, alignItems: 'center', margin: '10px 0', fontSize: 13 }}><span>{attribute.name}</span><RangeBar low={attribute.low} high={attribute.high} /><strong style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{attribute.low}–{attribute.high}</strong></div>)}</section>)}
        </div></>}
        {tab === 'SQUAD' && <>
          <p style={{ color: muted, marginTop: 0 }}>Compared with players on your current list who play a similar role. Select a name for a full attribute comparison. The squad player's marker uses their current rating; the scout's range is from the date this report was filed.</p>
          {dossier.peers?.length ? <div style={{ display: 'grid', gap: 12 }}>
            {dossier.peers.map(peer => <section key={peer.playerId} style={{ ...panel, borderColor: String(selectedPeerId) === String(peer.playerId) ? amber : border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" aria-expanded={String(selectedPeerId) === String(peer.playerId)} onClick={() => setSelectedPeerId(previous => String(previous) === String(peer.playerId) ? null : peer.playerId)} style={{ padding: 0, background: 'transparent', border: 0, color: amber, font: 'inherit', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }}>{peer.name} <small style={{ color: muted, textDecoration: 'none' }}>{peer.positions?.join('/')}</small> <span aria-hidden="true">{String(selectedPeerId) === String(peer.playerId) ? '▴' : '▾'}</span></button>
                <strong style={{ color: peer.estimatedRoleGap > 0 ? '#4ade80' : peer.estimatedRoleGap < 0 ? '#fca5a5' : muted }}>{peer.estimatedRoleGap > 0 ? '+' : ''}{peer.estimatedRoleGap} estimated role gap</strong>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, color: muted, fontSize: 13 }}><span>Edge: {peer.advantage ?? 'None clear'}</span><span>Gap: {peer.disadvantage ?? 'None clear'}</span><span>Shared traits: {peer.sharedTraits?.join(', ') || 'None'}</span><span>Distinct traits: {peer.uniqueTraits?.join(', ') || 'None'}</span></div>
            </section>)}
            {selectedPeer && <section style={{ ...panel, borderColor: '#38bdf8' }} aria-label={`Attribute comparison with ${selectedPeer.name}`}>
              <h3 style={{ margin: '0 0 7px' }}>{dossier.playerName} vs {selectedPeer.name}</h3>
              {currentPeer?.attributes ? <>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', color: muted, fontSize: 13, marginBottom: 16 }}><span><span style={{ color: amber }}>■</span> Scouted range</span><span><span style={{ color: '#22d3ee' }}>┃</span> {selectedPeer.name}'s current rating</span><span>All bars use the same 1–99 scale.</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 14 }}>
                  {dossier.groups?.map(group => <div key={group.id} style={{ ...panel, background: '#0b1426' }}><h4 style={{ color: amber, margin: '0 0 13px' }}>{group.name}</h4><div style={{ overflowX: 'auto' }}>
                    {group.attributes?.filter(attribute => Number.isFinite(Number(currentPeer.attributes?.[attribute.key]))).map(attribute => <div key={attribute.key} style={{ display: 'grid', gridTemplateColumns: '110px minmax(105px,1fr) 66px 42px', minWidth: 340, alignItems: 'center', gap: 7, margin: '11px 0', fontSize: 12 }}>
                      <span>{attribute.name}</span><RangeBar low={attribute.low} high={attribute.high} marker={currentPeer.attributes[attribute.key]} /><strong style={{ textAlign: 'right', color: amber, fontVariantNumeric: 'tabular-nums' }}>{attribute.low}–{attribute.high}</strong><strong style={{ textAlign: 'right', color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}>{Math.round(Number(currentPeer.attributes[attribute.key]))}</strong>
                    </div>)}
                  </div></div>)}
                </div>
              </> : <p style={{ color: muted }}>This player is no longer on your current list, so their live attribute ratings are unavailable.</p>}
            </section>}
          </div> : <div style={panel}>No comparable player currently appears on your list.</div>}
        </>}
        {tab === 'PROJECTION' && <><p style={{ color: muted, marginTop: 0 }}>Estimated overall if development follows the current path. These are scenarios, not guaranteed outcomes.</p><div style={{ display: 'grid', gap: 12 }}>{dossier.projection?.map(row => <section key={row.year} style={{ ...panel, display: 'grid', gridTemplateColumns: '90px minmax(120px,1fr) 90px', alignItems: 'center', gap: 14 }}><strong>{row.year}</strong><RangeBar low={row.low} high={row.high} /><strong style={{ textAlign: 'right', color: amber }}>{row.low}–{row.high}</strong><small style={{ color: muted, gridColumn: '1 / -1' }}>{row.phase} · {row.assumption}</small></section>)}</div><div style={{ ...panel, marginTop: 14 }}>Estimated ceiling: <strong style={{ color: amber }}>{dossier.potentialRange?.low}–{dossier.potentialRange?.high} OVR</strong><p style={{ color: muted, marginBottom: 0 }}>Playing time, training, fitness and coaching can change the actual path.</p></div></>}
      </div>
    </section>
  </div>;
}
