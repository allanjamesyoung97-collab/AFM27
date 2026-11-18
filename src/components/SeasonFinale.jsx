import { clubs } from '../data/clubs.js';
import { buildStatisticsSummary } from '../engine/statisticsEngine.js';
import { brownlowCount } from '../engine/brownlowEngine.js';
import ClubBadge from './ClubBadge.jsx';
import './SeasonFinale.css';

export default function SeasonFinale({ season, view = 'PREMIERSHIP', onViewChange, onProceed }) {
  const final = season.finalsHistory?.find(week => Number(week.week) === 4)?.results?.[0];
  const winner = final?.winner ?? season.premier;
  const loser = final && winner ? (winner === (final.homeTeam ?? final.home) ? final.awayTeam ?? final.away : final.homeTeam ?? final.home) : null;
  const winningClub = clubs.find(club => club.name === winner);
  const primary = winningClub?.colours?.primary ?? '#9b7b2b';
  const secondary = winningClub?.colours?.secondary ?? '#d6b44a';
  const matches = (season.roundHistory ?? []).flatMap(round => round.results ?? []);
  const summary = buildStatisticsSummary(matches);
  const aflca = summary.aflca?.[0];
  const brownlow = brownlowCount(season.roundHistory ?? [], season.tribunalCases ?? []).winners;
  const topGoals = Math.max(0, ...(summary.players ?? []).map(player => Number(player.goals ?? 0)));
  const coleman = (summary.players ?? []).filter(player => topGoals > 0 && Number(player.goals ?? 0) === topGoals);
  const home = final?.homeTeam ?? final?.home;
  const away = final?.awayTeam ?? final?.away;
  const score = (club) => club === home ? final?.homeScore : club === away ? final?.awayScore : null;
  const medal = (entries, pointsKey) => entries?.length ? entries.map(person => `${person.playerName ?? person.name}${person.club ? ` · ${person.club}` : ''}${pointsKey ? ` · ${person[pointsKey]} ${pointsKey === 'goals' ? 'goals' : 'votes'}` : ''}`).join('  /  ') : 'Result not recorded';
  return <main className="season-finale" style={{ '--finale-primary': primary, '--finale-secondary': secondary }}>
    <div className="season-finale__drape season-finale__drape--left" aria-hidden="true" />
    <div className="season-finale__drape season-finale__drape--right" aria-hidden="true" />
    <div className="season-finale__content">
      <div className="season-finale__eyebrow">AFL MANAGER 27 · SEASON {season.seasonYear}</div>
      {view === 'PREMIERSHIP' ? <>
        <div className="season-finale__medal" aria-hidden="true">🏆</div>
        <h1>Premiers</h1>
        <div className="season-finale__badge"><ClubBadge club={winner} size={92} /></div>
        <h2>{winner ?? 'Grand Final result pending'}</h2>
        <p className="season-finale__subtitle">{season.seasonYear} AFL PREMIERSHIP</p>
        {final && <div className="season-finale__score" aria-label={`Grand Final: ${winner} ${score(winner)}, ${loser} ${score(loser)}`}>
          <div><strong>{winner}</strong><span>{score(winner) ?? '—'}</span></div>
          <em>GRAND FINAL</em>
          <div><strong>{loser}</strong><span>{score(loser) ?? '—'}</span></div>
        </div>}
        <button type="button" className="season-finale__button" onClick={() => onViewChange?.('REVIEW')}>View season in review →</button>
      </> : <>
        <h1>Season in review</h1>
        <p className="season-finale__subtitle">The honours of {season.seasonYear}</p>
        <div className="season-finale__awards">
          <article><span>🏆 PREMIERSHIP</span><strong>{winner ?? 'Result pending'}</strong></article>
          <article><span>★ AFLCA CHAMPION PLAYER</span><strong>{medal(aflca ? [aflca] : [], 'votes')}</strong></article>
          <article><span>✦ BROWNLOW MEDAL</span><strong>{medal(brownlow, 'votes')}</strong></article>
          <article><span>◎ COLEMAN MEDAL</span><strong>{medal(coleman, 'goals')}</strong></article>
        </div>
        <div className="season-finale__actions"><button type="button" className="season-finale__back" onClick={() => onViewChange?.('PREMIERSHIP')}>← Grand Final result</button><button type="button" className="season-finale__button" onClick={onProceed}>Continue to offseason →</button></div>
      </>}
    </div>
  </main>;
}
