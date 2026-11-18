import { runFootballer, runningProfile } from '../engine/footballMotion.js';
import { clubs } from '../data/clubs.js';
import { OVAL_SLOTS, planOvalMovement, floatedBallPosition, shotLocation, distanceToGoal, METRES_PER_X, METRES_PER_Y } from '../engine/matchPresentation.js';
import { useEffect, useRef } from 'react';
import { actionTiming, GOAL_FLASH_DELAY_MS, GOAL_FLASH_END_MS, GOAL_RESET_START_MS, GOAL_RESET_MS, MATCH_ACTION_ANIMATION_MS, MATCH_SHOT_ANIMATION_MS, MAX_GOAL_PRESENTATION_SPEED, MAX_LIVE_PRESENTATION_SPEED } from '../engine/liveMatchPacing.js';

const slots = OVAL_SLOTS;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

// Schematic movement follows the actual match events. Animation never rolls
// another outcome or writes to match statistics.
export default function LiveMatchOval({ match, homeSlots, awaySlots, speed, shotPending = false, onCentreReady }) {
  const canvas = useRef(null);
  const latest = useRef(null);
  const quarterBanner = match.status === 'FULL_TIME'
    ? 'FULL TIME'
    : match.status === 'QUARTER_BREAK'
      ? ['QUARTER TIME', 'HALF TIME', 'THREE QUARTER TIME'][Number(match.quarter) - 1] ?? null
      : null;
  latest.current = { match, homeSlots, awaySlots, speed, onCentreReady };
  useEffect(() => {
    const element = canvas.current;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    let raf, previousTime = 0, eventId, progress = 1, readyReportedId = null;
    let positions = new Map(), targets = new Map();
    let ball = [50,50], ballFrom = ball, ballTarget = ball;
    let ballLift = 0;
    let animationTime = 0, goalAge = Infinity, goalColours = null, goalInfo = null;
    const ease = (t) => t*t*(3-2*t);
    // Frame-rate independent glide: players ease towards their target instead of
    // moving at a fixed speed and stopping dead between actions.
    const glide = (start, end, alpha) => ({ ...end, x:start.x+(end.x-start.x)*alpha, y:start.y+(end.y-start.y)*alpha });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time) => {
      const { match:m, homeSlots:h, awaySlots:a, speed:s, onCentreReady:reportCentreReady } = latest.current;
      const dt = previousTime ? Math.min(50,time-previousTime) : 0;
      previousTime = time;
      const action = m.visualAction;
      const lineupKey = [...h, ...a].map(([slot, entry]) => `${slot}:${entry.player.id}`).join('|');
      const key = `${m.quarter}:${action?.id ?? 'preview'}`;
      const rosterChanged = lineupKey !== draw.lineupKey;
      draw.lineupKey = lineupKey;
      const reversed = m.quarter > 0 && m.quarter % 2 === 0;
      const forward = action?.side === 'away' ? !reversed : reversed;
      if (key !== eventId || rosterChanged) {
        const firstFrame = eventId === undefined;
        if (key !== eventId) {
          progress = action && !firstFrame ? 0 : 1;
          const recordedAction = m.actions?.at(-1);
          ballFrom = firstFrame && recordedAction?.id === action?.id && Array.isArray(recordedAction.from)
            ? [...recordedAction.from]
            : [...ball];
          if (action?.score === 'Goal' && !firstFrame) {
            goalAge = 0;
            goalColours = clubs.find(c => c.name === (action.side === 'home' ? m.homeTeam : m.awayTeam))?.colours ?? {primary:'#f97316',secondary:'#fff'};
            const margin = Number(m.homeScore ?? 0) - Number(m.awayScore ?? 0);
            goalInfo = { margin: margin === 0 ? 'Scores level' : `${margin > 0 ? m.homeTeam : m.awayTeam} by ${Math.abs(margin)}` };
          }
        }
        eventId = key;
        const allEntries = [...[...h].map(([slot,entry]) => ({slot,player:entry.player,side:'home'})),
          ...[...a].map(([slot,entry]) => ({slot,player:entry.player,side:'away'}))];
        const carrierEntry = allEntries.find((entry) => String(entry.player.id) === String(action?.playerId));
        const carrierSlot = carrierEntry ? slots[carrierEntry.slot] ?? [50,50] : [50,50];
        const carrierFlip = carrierEntry?.side === 'home' ? reversed : !reversed;
        const carrier = positions.get(String(action?.playerId)) ?? { x: carrierFlip ? 100-carrierSlot[0] : carrierSlot[0], y: carrierSlot[1] };
        const shot = shotLocation(action?.distance ?? 35, forward, ((action?.distance ?? 35) % 5-2)*.14);
        const intended = action?.phase >= 4 && Math.hypot(carrier.x-shot[0],carrier.y-shot[1]) < 18 ? shot
          : [carrier.x + (forward ? -3 : 3), carrier.y + Math.sin(Number(action?.id ?? 0)*.02)*2];
        ballTarget = (m.actions?.at(-1)?.id === action?.id ? m.actions.at(-1).to : null) ?? action?.target ?? (!action ? [50,50] : action.phase === 0 && action.score !== 'Goal'
          ? [clamp(ballFrom[0]+(intended[0]-ballFrom[0])*.65,8,92),clamp(ballFrom[1]+(intended[1]-ballFrom[1])*.65,13,87)]
          : [clamp(intended[0],8,92),clamp(intended[1],13,87)]);
        const planned = m.spatialQuarter === m.quarter && m.spatialPositions
          ? allEntries.map(entry => ({ ...m.spatialPositions[String(entry.player.id)], ...runningProfile(entry.player), id: String(entry.player.id), side: entry.side, name: entry.player.name })).filter(point => Number.isFinite(point.x))
          : planOvalMovement(allEntries, positions, ballTarget, action, slots, reversed);
        targets = new Map(planned.map((point) => [point.id, point]));
      }
      const moving = ['LIVE', 'QUARTER_BREAK', 'FULL_TIME'].includes(m.status);
      const visualSpeed = Math.min(MAX_LIVE_PRESENTATION_SPEED, Math.max(1, s || 1));
      const timing = actionTiming(action);
      const actionDuration = timing.duration;
      // Goal graphics scale with speed (capped) so they line up with the celebration pause.
      const goalSpeed = Math.min(MAX_GOAL_PRESENTATION_SPEED, visualSpeed);
      if (moving) { progress = Math.min(1,progress + dt * visualSpeed / actionDuration); animationTime += dt * visualSpeed; goalAge += dt * goalSpeed; }
      if (reduced.matches) progress = 1;
      const width = element.clientWidth || 800, height = width*.65;
      const dpr = Math.min(2,window.devicePixelRatio || 1);
      if (element.width !== Math.round(width*dpr) || element.height !== Math.round(height*dpr)) {
        element.width=Math.round(width*dpr); element.height=Math.round(height*dpr);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);
      const X = v => width*v/100, Y = v => height*v/100;
      // Stadium seating wraps around the full oval, with lit tiers and crowd texture.
      ctx.fillStyle='#101827';ctx.beginPath();ctx.ellipse(X(50),Y(50),X(50),Y(49.5),0,0,Math.PI*2);ctx.fill();
      for(let tier=0;tier<5;tier++){
        ctx.strokeStyle=tier%2?'#64748b':'#cbd5e1';ctx.globalAlpha=.18+tier*.035;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(X(50),Y(50),X(49-tier*.65),Y(48.5-tier*.65),0,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=1;
      for(let i=0;i<260;i++){
        const angle=i*2.399, radius=47+(i%5)*.42;
        ctx.fillStyle=['#cbd5e1','#94a3b8','#f87171','#e2e8f0'][i%4];ctx.globalAlpha=.23;
        ctx.fillRect(X(50+Math.cos(angle)*radius),Y(50+Math.sin(angle)*radius*.94),2,2);
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='#103c2b';ctx.beginPath();ctx.ellipse(X(50),Y(50),X(45.5),Y(44),0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.clip();
      for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#ffffff08':'#00000008';ctx.fillRect(X(i*10),0,X(10),height);}
      ctx.strokeStyle='#cde8d3aa';ctx.lineWidth=1.5;
      ctx.strokeRect(X(36),Y(29),X(28),Y(42));
      ctx.beginPath();ctx.arc(X(50),Y(50),Y(8),0,Math.PI*2);ctx.stroke();
      for(const x of [2.5,97.5]) {ctx.beginPath();ctx.ellipse(X(x),Y(50),X(50/METRES_PER_X),Y(50/METRES_PER_Y),0,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      // Goal square (6.4m wide, 9m deep) and posts sit on the goal line at each end.
      // Goal posts are 6.4m apart; behind posts are a further 6.4m out on each side.
      const squareDepth = 9 / METRES_PER_X, squareHalf = 3.2 / METRES_PER_Y;
      const postHalf = 3.2 / METRES_PER_Y, behindHalf = 9.6 / METRES_PER_Y;
      ctx.strokeStyle='#cde8d3cc';ctx.lineWidth=1.5;
      // The goal line belongs on the playing surface edge. The old 2.5/97.5
      // coordinates placed the posts beyond the green oval and into the seats.
      for(const x of [5,95]) {
        const inward = x < 50 ? 1 : -1;
        ctx.strokeRect(Math.min(X(x),X(x+inward*squareDepth)),Y(50-squareHalf),Math.abs(X(squareDepth)-X(0)),Y(squareHalf*2));
        ctx.beginPath();ctx.moveTo(X(x),Y(50-behindHalf));ctx.lineTo(X(x),Y(50+behindHalf));ctx.stroke();
        for(const [offset,radius] of [[-behindHalf,2.5],[-postHalf,3.5],[postHalf,3.5],[behindHalf,2.5]]) {
          ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(X(x),Y(50+offset),radius,0,Math.PI*2);ctx.fill();
        }
      }
      if (goalColours && goalAge >= GOAL_FLASH_DELAY_MS && goalAge < GOAL_FLASH_END_MS) {
        const pulse = reduced.matches ? .65 : .35+.65*(.5+.5*Math.sin(goalAge/170));
        ctx.save();ctx.globalAlpha=pulse;ctx.lineWidth=5;
        for (const [index,colour] of [goalColours.primary,goalColours.secondary].entries()) {
          ctx.strokeStyle=colour;ctx.shadowColor=colour;ctx.shadowBlur=18;
          ctx.beginPath();ctx.ellipse(X(50),Y(50),X(47+index*.7),Y(46+index*.7),0,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
      }
      const displayPoints = [...targets].map(([id,target],index) => {
        // Interchanges are invisible: replacements appear at the resolved field position.
        const start = positions.get(id) ?? target;
        if (reduced.matches) return {...target,speed:0};
        if (!moving) return start;
        const next = runFootballer(start,target,dt*visualSpeed/1000);
        const zone = action?.protectedZone;
        if (zone && (action?.mark || action?.freeKick || progress < timing.release) && target.side !== zone.side && id !== String(zone.markerId)) {
          const distance = point => Math.hypot((point.x-zone.origin[0])*METRES_PER_X,(point.y-zone.origin[1])*METRES_PER_Y);
          if (distance(start) >= 10 && distance(next) < 10) return {...start,speed:0};
        }
        return next;
      });
      for (const id of positions.keys()) if (!targets.has(id)) positions.delete(id);
      if (action?.kind === 'setup' && readyReportedId !== action.id && progress >= .9 &&
        displayPoints.length === targets.size && displayPoints.every(p => {
          const target=targets.get(p.id);
          return Math.hypot((p.x-target.x)*METRES_PER_X,(p.y-target.y)*METRES_PER_Y)<3;
        })) {
        readyReportedId=action.id;
        reportCentreReady?.(action.id);
      }
      const holder = displayPoints.find(p => p.id === String(action?.playerId));
      const receiving = clamp((progress-timing.release)/(timing.arrival-timing.release),0,1);
      const holderPoint = holder ? [holder.x,holder.y] : ballTarget;
      let possession = receiving >= .8 && Boolean(holder);
      if (action?.kind === 'setup') {
        ball=action.target ?? [50,50]; ballLift=0; possession=false;
      } else if (action?.phase === 5) {
        // Keep the ball with the marking player, then show the kick and restart.
        const kick = clamp((progress-.43)/.42,0,1);
        const destination = [forward ? 5 : 95, action.score === 'Goal' ? 50 : action.score === 'Behind' ? 50 + (Number(action.id) % 2 ? 5.5 : -5.5) : 50 + (Number(action.id) % 2 ? 12 : -12)];
        const gather = floatedBallPosition(ballFrom, holderPoint, clamp(progress/.28,0,1));
        const flight = floatedBallPosition(holderPoint, destination, kick);
        ball = kick > 0 ? [flight.x,flight.y] : [gather.x,gather.y];
        ballLift = kick > 0 ? flight.lift : gather.lift;
        possession = kick === 0 && progress >= .28 && Boolean(holder);
        if (action.score === 'Goal') {
          // After the goal the ball glides back to the centre rather than teleporting.
          const back = ease(clamp((goalAge-GOAL_RESET_START_MS)/GOAL_RESET_MS,0,1));
          if (back > 0) { ball = [destination[0]+(50-destination[0])*back, destination[1]+(50-destination[1])*back]; ballLift = 0; }
        }
      } else if (action?.carrying && holder) {
        ball = holderPoint; ballLift = 0; possession = true;
      } else {
        const flight = floatedBallPosition(ballFrom, ballTarget, receiving);
        ball = [flight.x,flight.y]; ballLift = action?.kind === 'handball' ? flight.lift*.2 : flight.lift;
        possession = receiving >= .8 && Boolean(holder)
          && Math.hypot((holderPoint[0] - ballTarget[0]) * METRES_PER_X, (holderPoint[1] - ballTarget[1]) * METRES_PER_Y) < 5;
      }
      for(const point of displayPoints){
        positions.set(point.id,point);
        ctx.beginPath();ctx.arc(X(point.x),Y(point.y),Math.max(3,width*.008),0,Math.PI*2);
        ctx.fillStyle=point.side==='home'?'#f8fafc':'#f97316';ctx.fill();ctx.strokeStyle='#111827';ctx.lineWidth=2;ctx.stroke();
        if(possession && point.id===String(action?.playerId)) {
          ctx.font=`bold ${Math.max(10,width*.016)}px Arial`;ctx.textAlign='center';
          const label = point.name.split(' ').slice(-1)[0] + (action?.mark || action?.phase===5 ? ` · ${Math.round(distanceToGoal([point.x,point.y],forward))}m` : '');
          const labelWidth = ctx.measureText(label).width;
          ctx.fillStyle='#071322dd';ctx.fillRect(X(point.x)-labelWidth/2-5,Y(point.y)-30,labelWidth+10,20);
          ctx.fillStyle='#fff';ctx.fillText(label,X(point.x),Y(point.y)-15);
        }
      }
      if (!possession && ballLift > 0) {ctx.fillStyle='#031b1399';ctx.beginPath();ctx.ellipse(X(ball[0]),Y(ball[1])+5,5,2.5,0,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#fde047';ctx.beginPath();ctx.ellipse(X(ball[0]),Y(ball[1])-ballLift+ (possession ? 8 : 0),5,3,-.5,0,Math.PI*2);ctx.fill();
      if (goalInfo && goalAge >= GOAL_FLASH_DELAY_MS && goalAge < GOAL_FLASH_END_MS) {
        const fadeIn = clamp((goalAge-GOAL_FLASH_DELAY_MS)/220,0,1), fadeOut = clamp((GOAL_FLASH_END_MS-goalAge)/300,0,1);
        const alpha = Math.min(fadeIn,fadeOut), pop = .85+.15*ease(fadeIn);
        const radius = Y(8);
        ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.lineJoin='round';
        ctx.shadowColor=goalColours?.primary ?? '#f97316';ctx.shadowBlur=14;
        const goalSize = Math.max(22,width*.05)*pop, marginSize = Math.max(13,width*.021);
        ctx.font=`900 ${goalSize}px Arial`;ctx.textBaseline='bottom';
        ctx.lineWidth=Math.max(4,goalSize*.14);ctx.strokeStyle='#071322';ctx.strokeText('GOAL',X(50),Y(50)-radius-8);
        ctx.fillStyle='#fff';ctx.fillText('GOAL',X(50),Y(50)-radius-8);
        ctx.font=`800 ${marginSize}px Arial`;ctx.textBaseline='top';
        ctx.lineWidth=Math.max(3,marginSize*.28);ctx.strokeText(goalInfo.margin,X(50),Y(50)+radius+8);
        ctx.fillText(goalInfo.margin,X(50),Y(50)+radius+8);
        ctx.restore();
      }
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  },[]);
  return <section style={{ border:'1px solid #334155',borderRadius:16,padding:16,background:'#0b1324',color:'#f8fafc',marginBottom:16 }}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>Live match · {homeSlots.size} v {awaySlots.size} on field</strong><span><span style={{color:'#f8fafc'}}>● {match.homeTeam}</span> · <span style={{color:'#f97316'}}>● {match.awayTeam}</span></span></div>
    <div style={{position:'relative'}}>
      <canvas ref={canvas} role="img" aria-label={`Live oval. ${shotPending ? `${match.visualAction?.scorerName ?? 'A player'} shoots from ${match.visualAction?.distance ?? 0} metres` : match.visualAction?.text ?? 'Players taking their positions'}`} style={{width:'100%',aspectRatio:'20 / 13',display:'block'}} />
      {quarterBanner && <div role="status" aria-live="assertive" style={{position:'absolute',inset:'0 0 auto',minHeight:'25%',display:'grid',placeItems:'center',padding:'14px 18px',boxSizing:'border-box',background:'linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.35))',color:'#fff',fontSize:'clamp(20px,4vw,38px)',fontWeight:950,letterSpacing:'.12em',textAlign:'center',textShadow:'0 3px 18px #000',borderTop:'3px solid #eab308',borderBottom:'1px solid #ffffff55'}}>{quarterBanner}</div>}
    </div>
    <p aria-live="off" style={{margin:'8px 0 0',minHeight:'1.5em'}}>{shotPending ? `${match.visualAction?.scorerName ?? 'The player'} shoots from ${match.visualAction?.distance ?? 0} metres…` : (match.visualAction?.text ?? 'The teams are taking their positions. Start the match to watch play.')}</p>
    <div style={{marginTop:16,borderTop:'1px solid #334155'}}>
      <h3 style={{fontSize:14,letterSpacing:2}}>THE CALL</h3>
      <div style={{maxHeight:260,overflowY:'auto'}}>{(shotPending ? (match.events ?? []).slice(0,-1) : match.events ?? []).slice().reverse().map((event,index) => <div key={`${event.id}-${index}`} style={{display:'grid',gridTemplateColumns:'75px 12px 1fr',gap:10,padding:'12px 0',borderTop:'1px solid #233047',lineHeight:1.5}}>
        <small style={{color:'#94a3b8'}}>{event.quarter} {event.clock ?? `${event.minute}′`}</small>
        <span style={{color:event.side==='away'?'#f97316':'#f8fafc'}}>●</span><span style={{fontWeight:index===0?700:400}}>{event.text}</span>
      </div>)}</div>
    </div>
  </section>;
}
