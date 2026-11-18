import { useState } from 'react';
import { CONTINUE_COMMANDS, formatDay } from '../engine/simulationClock.js';
import { pendingDecisions } from '../engine/worldSimulationEngine.js';

export default function CalendarProgressPanel({ processing, error, season, fitness, onPause, onCommand, onDecision, onTribunalAction, onOpen, onNotificationPolicyChange, delegation, appearance }) {
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState('DAY');
  const light = appearance === 'light';
  const events = pendingDecisions(season, { fitness, delegation });
  const tribunalEvents = events.filter(event => event.type === 'TRIBUNAL');
  const otherEvents = events.filter(event => event.type !== 'TRIBUNAL');
  const color = light ? '#0f172a' : '#f8fafc';
  const muted = light ? '#475569' : '#94a3b8';
  const button = { padding: '7px 10px', borderRadius: 8, border: '1px solid #475569', background: light ? '#fff' : '#1e293b', color, fontWeight: 700, cursor: 'pointer' };
  return <section aria-label="World progression" style={{ padding: '10px 20px', color, background: light ? '#f8fafc' : '#0b1220', borderBottom: '1px solid #334155' }}>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      {processing ? <><span role="status" style={{ flex: 1 }}>Processing {formatDay(processing.date)} · {processing.slot}</span><button style={button} onClick={onPause}>Pause</button></> : <>
        <select aria-label="Progression target" value={target} onChange={e => setTarget(e.target.value)} style={{ ...button, maxWidth: '100%' }}>{CONTINUE_COMMANDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <button onClick={() => onCommand(target)} style={{ ...button, background: '#16a34a', color: '#fff' }}>Progress</button>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} style={{ ...button, marginLeft: 'auto', color: events.length ? '#f87171' : muted }}>Decisions ({events.length}) {expanded ? '▴' : '▾'}</button>
      </>}
    </div>
    {error && <p role="alert" style={{ color: '#f87171', marginBottom: 0 }}>{error}</p>}
    {!processing && tribunalEvents.map(event => <article key={event.id} aria-label="Post-match tribunal decision" style={{ marginTop: 10, padding: 14, border: '1px solid #f59e0b', borderRadius: 12, background: light ? '#fffbeb' : '#231a12' }}>
      <strong>Match Review Officer · {event.title.replace('Match Review · ', '')}</strong>
      <p style={{ color: muted, margin: '7px 0 10px' }}>{event.reason}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...button, background: '#16a34a', color: '#fff' }} onClick={() => onTribunalAction?.(event.caseId, 'ACCEPT')}>Accept sanction</button>
        <button type="button" style={button} disabled={Number(season.clubAdministration?.cashBalance ?? 0) < Number(season.tribunalCases?.find(item => item.id === event.caseId)?.legalFee ?? 0)} onClick={() => onTribunalAction?.(event.caseId, 'CHALLENGE')}>Challenge at Tribunal</button>
      </div>
    </article>)}
    {!processing && <details style={{ marginTop: 8, color: muted, fontSize: 12 }}><summary style={{ cursor: 'pointer' }}>Notification stops</summary><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 8 }}>{[['MEDIA', 'Club and media stories'], ['SCOUT', 'Scouting reports']].map(([id, title]) => <label key={id}>{title} <select aria-label={`${title} progression preference`} value={season.calendarNotificationPolicy?.[id] ?? 'NOTIFY'} onChange={e => onNotificationPolicyChange?.({ ...season.calendarNotificationPolicy, [id]: e.target.value })} style={button}><option value="NOTIFY">Notify without stopping</option><option value="STOP">Stop progression</option></select></label>)}</div></details>}
    {expanded && !processing && <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      {otherEvents.length ? otherEvents.map(event => <article key={event.id} style={{ border: '1px solid #475569', borderRadius: 10, padding: 12 }}>
        <strong>{event.title}</strong><p style={{ color: muted, margin: '5px 0' }}>{event.reason} · Due {formatDay(event.deadline)}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button style={button} onClick={() => onOpen(event)}>Open decision</button>
          {event.type !== 'TRADE_RESPONSE' && <button style={button} disabled={event.type === 'RFA_MATCH' && event.canMatch === false} onClick={() => onDecision(event.id, 'ACKNOWLEDGE')}>{event.type === 'RFA_MATCH' ? 'Match offer' : event.type === 'INJURY' ? 'Approve rehabilitation' : event.type === 'STAFF_APPROVAL' ? 'Approve appointment' : 'Decision reviewed'}</button>}
          {season.calendarClock?.date < event.deadline && <button style={button} onClick={() => onDecision(event.id, 'DEFER')}>Defer up to 7 days</button>}
          {['TRADE_RESPONSE', 'STAFF_APPROVAL', 'RFA_MATCH'].includes(event.type) && <button style={{ ...button, color: '#f87171' }} onClick={() => onDecision(event.id, 'DECLINE')}>{event.type === 'RFA_MATCH' ? 'Do not match' : 'Decline offer'}</button>}
        </div>
      </article>) : <p style={{ color: muted }}>No unresolved management decisions.</p>}
    </div>}
  </section>;
}
