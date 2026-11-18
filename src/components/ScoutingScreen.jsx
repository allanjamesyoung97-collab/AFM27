import { useMemo, useState } from 'react';
import { getCareerClub } from '../engine/contractEngine.js';
import { getCareerPlayer } from '../engine/developmentEngine.js';
import { buildScoutingDossier, scoutingCandidateForProspect } from '../engine/scoutingFitEngine.js';
import { getScoutingReportFreshness } from '../engine/scoutingReportFreshness.js';
import { MAX_ACTIVE_SCOUTING_ASSIGNMENTS, scoutingDurationDays, nextScoutingAccuracy } from '../engine/scoutingAssignmentEngine.js';
import ScoutReportDossier from './ScoutReportDossier.jsx';

const card = { background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 16, marginBottom: 14 };
const muted = { color: '#94a3b8' };

export default function ScoutingScreen({ players = [], playerDevelopment = {}, seasonState = {}, userClub, onScout, onToggleShortlist, onViewInRecruitment, scoutingAccuracy = 0.55 }) {
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [openReportId, setOpenReportId] = useState(null);
  const club = userClub?.name;
  const candidatePool = useMemo(() => [...players, ...(seasonState.draftState?.availableProspects ?? []).map(scoutingCandidateForProspect)], [players, seasonState.draftState?.availableProspects]);
  const targets = useMemo(() => candidatePool.filter(player =>
    getCareerClub(player, seasonState.playerContracts) !== club
    && player.attributes
    && `${player.name} ${player.club}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) => a.name.localeCompare(b.name)), [candidatePool, seasonState.playerContracts, club, search]);
  const target = candidatePool.find(player => String(player.id) === selectedId);
  const report = target && seasonState.scoutingReports?.[target.id];
  const active = (seasonState.scoutingAssignments ?? []).some(item => String(item.playerId) === selectedId && !item.completed);
  const activeAssignments = (seasonState.scoutingAssignments ?? []).filter(item => !item.completed);
  const atCapacity = activeAssignments.length >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS;
  const listManager = seasonState.clubAdministration?.staff?.find(person => person.role === 'List Manager');
  const quality = Math.round(Number(scoutingAccuracy) * 100);
  const duration = scoutingDurationDays(listManager?.rating);
  const nextAccuracy = target ? nextScoutingAccuracy(scoutingAccuracy, report, listManager?.rating) : 0;
  const reportRows = useMemo(() => Object.entries(seasonState.scoutingReports ?? {}).map(([id, saved]) => ({
    id, saved, player: candidatePool.find(candidate => String(candidate.id) === String(id)),
  })).sort((a, b) => String(b.saved.assessedOn ?? '').localeCompare(String(a.saved.assessedOn ?? ''))), [seasonState.scoutingReports, candidatePool]);
  const opened = reportRows.find(row => String(row.id) === String(openReportId));
  const shortlist = new Set((seasonState.scoutingShortlist ?? []).map(String));
  const currentDate = seasonState.calendarClock?.date;
  const openedFreshness = opened ? getScoutingReportFreshness(opened.saved, currentDate) : null;
  const openedPending = (seasonState.scoutingAssignments ?? []).some(item => String(item.playerId) === String(openReportId) && !item.completed);
  const seasonYear = Number(seasonState.seasonYear ?? 2027);
  const currentSquad = useMemo(() => players.filter(player => getCareerClub(player, seasonState.playerContracts) === club)
    .map(player => getCareerPlayer(player, playerDevelopment, seasonYear, seasonState.playerContracts)),
  [players, playerDevelopment, seasonYear, seasonState.playerContracts, club]);
  const openedPlayer = opened?.player && getCareerPlayer(opened.player, playerDevelopment, seasonYear, seasonState.playerContracts);
  // Older saves contain the tactical summary but not the detailed snapshot.
  // Build a deterministic one on first viewing; new reports are frozen when filed.
  const openedDossier = opened?.saved.dossier ?? (openedPlayer && buildScoutingDossier(openedPlayer, currentSquad,
    opened.saved.accuracy, `legacy:${opened.id}:${opened.saved.assessedOn}`, seasonYear, playerDevelopment?.[opened.id]));

  return <main style={{ color: '#f8fafc' }}>
    <h2>Scouting</h2>
    <p style={muted}>Assign reports to assess trade and draft targets against your squad's tactical strengths and weaknesses. The List Manager leads scouting; their rating has the greatest effect on report accuracy. Recruiting facilities also help.</p>
    <section style={card}>
      <strong>Scouting team</strong>
      <div style={{ marginTop: 6 }}>{listManager?.name ?? 'Vacant List Manager'} · rating {listManager?.rating ?? '—'} · expected report confidence {quality}%</div>
      <p style={{ ...muted, marginBottom: 0 }}>A report takes about {duration} game days with this List Manager. Repeat scouting narrows the estimates. {activeAssignments.length}/{MAX_ACTIVE_SCOUTING_ASSIGNMENTS} assignments active.</p>
    </section>
    <section style={card}>
      <label>Find a player <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search players" style={{ margin: 8, padding: 8 }} /></label>
      <select aria-label="Scouting target" value={selectedId} onChange={event => setSelectedId(event.target.value)} style={{ padding: 9, maxWidth: '100%' }}>
        <option value="">Select a target</option>
        {targets.slice(0, 250).map(player => <option key={player.id} value={player.id}>{player.name} · {getCareerClub(player, seasonState.playerContracts) ?? 'Unattached'}</option>)}
      </select>
      {target && <button type="button" disabled={active || atCapacity} onClick={() => onScout?.(target.id)} style={{ marginLeft: 10, padding: '9px 14px', background: active || atCapacity ? '#475569' : '#ea580c', color: '#fff', border: 0, borderRadius: 8, cursor: active || atCapacity ? 'not-allowed' : 'pointer' }}>{active ? 'Report in progress' : atCapacity ? 'Five assignments active' : report ? `Scout again · ≈${Math.round(nextAccuracy * 100)}% confidence` : 'Assign scout'}</button>}
    </section>
    {target && <section style={card}>
      <h3>{target.name} · tactical fit</h3>
      {report?.fit ? <>
        <p>{report.fit.summary}</p>
        <p style={muted}>Scouted {report.assessedOn} · {Math.round(Number(report.accuracy) * 100)}% confidence · estimated OVR {report.estimatedOverall} · tactical ratings ±{report.fit.margin ?? 'several'} points</p>
        <button type="button" onClick={() => setOpenReportId(String(target.id))} style={{ padding: '9px 13px', marginBottom: 14, background: '#ea580c', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Open scout dossier →</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {report.fit.styles.map(row => <div key={row.id} style={{ padding: 10, background: '#1e293b', borderRadius: 8 }}><strong>{row.name}</strong><div>≈{row.after}% <span style={{ color: row.change > 0 ? '#4ade80' : row.change < 0 ? '#fca5a5' : '#94a3b8' }}>({row.change > 0 ? '+' : ''}{row.change})</span></div></div>)}
        </div>
      </> : <p style={muted}>{active ? `The scouting report is being prepared and should arrive in about ${duration} game days.` : 'Assign a scout to reveal an estimated tactical fit.'}</p>}
    </section>}
    <section style={card}><h3>Filed scout reports</h3>
      {reportRows.length ? reportRows.map(({ id, player, saved }) => {
        const freshness = getScoutingReportFreshness(saved, currentDate);
        return <button type="button" key={id} onClick={() => setOpenReportId(String(id))} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 14, alignItems: 'center', textAlign: 'left', padding: '12px 8px', border: 0, borderTop: '1px solid #334155', background: 'transparent', color: '#f8fafc', cursor: 'pointer' }}><span><strong>{shortlist.has(String(id)) ? '★ ' : ''}{player?.name ?? saved.dossier?.playerName ?? id}</strong><span style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{saved.fit?.summary ?? 'Assessment filed'}</span></span><span style={{ whiteSpace: 'nowrap', textAlign: 'right', fontSize: 13 }}><strong style={{ display: 'block', color: freshness.status === 'STALE' ? '#fca5a5' : freshness.status === 'AGING' ? '#fbbf24' : '#4ade80' }}>{freshness.status === 'UNKNOWN' ? 'Date unknown' : `${freshness.status === 'CURRENT' ? 'Current' : freshness.status === 'AGING' ? 'Aging' : 'Stale'} · ${freshness.label}`}</strong><span style={{ color: '#fbbf24' }}>Open report →</span></span></button>;
      }) : <p style={muted}>No completed reports yet. Assign a scout to reveal a player's attributes and squad fit.</p>}
    </section>
    {(seasonState.scoutingAssignments ?? []).some(item => !item.completed) && <section style={card}><h3>In progress</h3>{(seasonState.scoutingAssignments ?? []).filter(item => !item.completed).map(item => {
      const player = candidatePool.find(candidate => String(candidate.id) === String(item.playerId));
      return <div key={item.id} style={{ padding: '8px 0', borderTop: '1px solid #334155' }}>{player?.name ?? item.playerId} · Due {item.dueDate ?? 'soon'} · Expected confidence {Math.round(Number(item.targetAccuracy ?? scoutingAccuracy) * 100)}%</div>;
    })}</section>}
    {opened && <ScoutReportDossier key={String(opened.id)} report={opened.saved} dossier={openedDossier} player={openedPlayer} squad={currentSquad} freshness={openedFreshness} isShortlisted={shortlist.has(String(opened.id))} onToggleShortlist={() => onToggleShortlist?.(opened.id)} onRequestUpdate={() => onScout?.(opened.id)} updatePending={openedPending || atCapacity || !opened.player} updateUnavailableReason={openedPending ? 'Update in progress' : atCapacity ? 'Five assignments active' : !opened.player ? 'Player unavailable' : null} nextAccuracy={nextScoutingAccuracy(scoutingAccuracy, opened.saved, listManager?.rating)} onViewInRecruitment={() => { onViewInRecruitment?.(opened.id, players.some(player => String(player.id) === String(opened.id)) ? 'TRADE' : 'DRAFT'); setOpenReportId(null); }} onClose={() => setOpenReportId(null)} />}
  </main>;
}
