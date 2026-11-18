import { actionTiming } from './liveMatchPacing.js';
import { runningProfile, runFootballer } from './footballMotion.js';
// Presentation uses resolved events; it never rolls additional match outcomes.
export function describePlay({ phase, kind, actor, receiver, defender, score, turnover, distance, inside50 = false, seed = 0 }) {
  const choose = (lines) => lines[Math.abs(seed) % lines.length];
  if (turnover) return choose([`${defender} cuts it off. The ball changes hands.`, `${actor} can't find a teammate — ${defender} gathers for the opposition.`, `${defender} reads the play and wins it back.`]);
  if (phase === 5) {
    const result = score === 'Goal' ? choose(['Straight through the middle!', 'Splits the big sticks!', 'Makes no mistake. Goal!']) : score === 'Behind' ? choose(['Just wide. One behind.', 'Pushes it across the face. A minor score.', 'Off target. One point.']) : score === 'Miss' ? 'Misses everything. No score.' : 'Falls short — the ball is still alive.';
    return `${actor} kicks from ${distance} metres. ${result}`;
  }
  if (kind === 'carry') return choose([`${actor} takes the space in front and carries.`, `${actor} breaks clear and runs on.`, `${actor} keeps possession and advances.`]);
  if (kind === 'handball') return choose([`${actor} gives the handball to ${receiver}.`, `${actor} releases by hand to ${receiver}.`, `${actor} finds ${receiver} with a handball.`]);
  if (kind === 'kick') return inside50
    ? choose([`${actor} kicks inside 50 to ${receiver}.`, `${actor} sends the ball into the forward 50.`, `${actor} drives an entry towards ${receiver}.`])
    : choose([`${actor} kicks to ${receiver}.`, `${actor} finds ${receiver} by foot.`, `${actor} sends it forward to ${receiver}.`]);
  return choose([
    [`${actor} gets first hands on it at the stoppage.`, `${actor} gathers at the contest.`, `${actor} wins the loose ball.`],
    [`${actor} bursts clear of the congestion.`, `${actor} finds a way out of the pack.`, `${actor} drives the ball out of the contest.`],
    [`${actor} carries through the corridor.`, `${actor} links up through the middle.`, `${actor} takes the game on through the wing.`],
    [`${actor} sends it deep inside fifty.`, `${actor} looks for a lead inside the arc.`, `${actor} delivers into the forward line.`],
    [`${actor} takes the mark, ${distance} metres out. Goes back to line up.`, `${actor} holds the mark! A set shot from ${distance} metres.`, `${actor} marks on the lead, ${distance} metres from goal.`],
  ][phase] ?? [`${actor} has possession.`]);
}

export function separatePlayers(points) {
  const result = points.map(p => ({ ...p }));
  // Separate both teams in screen space so opponents never hide one another.
  // Use a slightly smaller minimum so contesters can stay close without
  // being shoved apart unrealistically.
  const minSep = 2.0;
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
    const a = result[i], b = result[j];
    let dx = b.x-a.x, dy = (b.y-a.y)*.65;
    const distance = Math.hypot(dx,dy);
    if (distance >= minSep) continue;
    if (distance < .001) { dx = i % 2 ? 1 : -1; dy = .5; }
    const length = Math.hypot(dx,dy), shift = (minSep-distance)/2;
    a.x -= dx/length*shift; b.x += dx/length*shift;
    a.y -= dy/length*shift/.65; b.y += dy/length*shift/.65;
  }
  return result;
}

// One physical scale for the oval, shot locations and the 50-metre arcs.
export const METRES_PER_X = 160 / 90;
export const METRES_PER_Y = METRES_PER_X * .65;
export function shotLocation(distance, left = false, angle = 0) {
  return [left ? 5 + distance * Math.cos(angle) / METRES_PER_X : 95 - distance * Math.cos(angle) / METRES_PER_X,
    50 + distance * Math.sin(angle) / METRES_PER_Y];
}
export function distanceToGoal(point, left = false) {
  return Math.hypot((point[0] - (left ? 5 : 95)) * METRES_PER_X, (point[1] - 50) * METRES_PER_Y);
}
export function moveTowards(start, end, maximum) {
  const dx = end.x-start.x, dy = (end.y-start.y)*.65;
  const distance = Math.hypot(dx,dy);
  const fraction = distance ? Math.min(1,Math.max(0,maximum)/distance) : 0;
  return { ...end, x:start.x+(end.x-start.x)*fraction, y:start.y+(end.y-start.y)*fraction };
}

// Continuous team movement: the formation shifts with the ball instead of
// pulling players back to fixed anchors. Forwards lead into space, teammates
// provide width and outlets, defenders hold structure and recover, and nearby
// players converge on contests. No snap-back after disposal.
export function planOvalMovement(entries, previousPositions, ballTarget, action, anchors, reversed = false) {
  const points = entries.map(({side, slot, player}) => {
    const id = String(player.id), anchor = anchors[slot] ?? [50,50];
    const flip = side === 'home' ? reversed : !reversed;
    const home = {x: flip ? 100-anchor[0] : anchor[0], y: anchor[1]};
    return {...runningProfile(player), id, side, slot, name:player.name, home, direction:flip ? -1 : 1,
      speed:previousPositions.get(id)?.speed ?? 0, heading:previousPositions.get(id)?.heading,
      x:previousPositions.get(id)?.x ?? home.x, y:previousPositions.get(id)?.y ?? home.y};
  });
  const ball = {x:ballTarget[0],y:ballTarget[1]};
  const metres = (a,b) => Math.hypot((a.x-b.x)*METRES_PER_X,(a.y-b.y)*METRES_PER_Y);
  const defenders = points.filter(p => p.side !== action?.side).sort((a,b)=>metres(a,ball)-metres(b,ball));
  const presserId = defenders[0]?.id;
  const coverIds = new Set(defenders.slice(1,3).map(p=>p.id));
  const attackers = points.filter(p => p.side === action?.side).sort((a,b)=>metres(a,ball)-metres(b,ball));
  const supportIds = new Set(attackers.filter(p=>p.id!==String(action?.playerId)).slice(0,2).map(p=>p.id));
  const ballUpTargets = new Map();
  if (action?.ballUp) for (const side of ['home', 'away']) {
    const team = points.filter(p => p.side === side);
    const nearest = team.slice().sort((a,b)=>metres(a,ball)-metres(b,ball));
    const ruck = team.filter(p => /^(?:R|RR|RUC|RUCK)$/.test(String(p.slot).toUpperCase()))
      .sort((a,b)=>metres(a,ball)-metres(b,ball))[0] ?? nearest[0];
    const support = nearest.find(p => p.id !== ruck?.id);
    const direction = side === 'home' ? -1 : 1;
    if (ruck) ballUpTargets.set(ruck.id, { x: Math.max(8,Math.min(92,ball.x+direction*1.8)), y: ball.y });
    if (support) ballUpTargets.set(support.id, { x: Math.max(8,Math.min(92,ball.x+direction*5.5)), y: Math.max(8,Math.min(92,ball.y+(side === 'home' ? -3 : 3))) });
  }
  const targets = points.map(p => {
    if (action?.reset && !action?.ballUp) return {...p,tx:p.home.x,ty:p.home.y};
    if (action?.ballUp) {
      const target = ballUpTargets.get(p.id) ?? p;
      return {...p, tx:target.x, ty:target.y};
    }
    const own = p.side === action?.side;
    const forward = /^(FP|FF|HF|CHF)/.test(p.slot);
    const back = /^(BP|FB|HB|CHB)/.test(p.slot);
    const wing = /^W[12]$/.test(p.slot);
    const close = Math.exp(-metres(p,ball)/42);
    // Far-side players maintain their line; nearby players react to play.
    const lane = p.home.y < 42 ? -1 : p.home.y > 58 ? 1 : 0;
    const width = lane*(wing ? 16 : forward ? 12 : 9);
    const ballShiftX = Math.max(-20,Math.min(20,(ball.x-50)*(own?.42:.16)));
    const ballShiftY = Math.max(-9,Math.min(9,(ball.y-50)*(own?.2:.07)));
    let tx=p.home.x+ballShiftX, ty=p.home.y+ballShiftY;
    if (own) {
      // Provide options ahead, recovery behind and width outside the corridor.
      const lead = forward ? 10 : back ? -11 : supportIds.has(p.id) ? -4 : 2;
      tx += p.direction*(lead*close+2);
      ty += width*close*.48;
      if (supportIds.has(p.id)) {
        tx=ball.x-p.direction*(8+Math.abs(lane)*2);
        ty=ball.y+(lane || (p.id.localeCompare(String(action?.playerId))<0?-1:1))*11;
      }
      if (forward && p.id!==String(action?.playerId)) {
        const nearestOpponent=defenders.slice().sort((a,b)=>metres(a,p)-metres(b,p))[0];
        if (nearestOpponent && metres(nearestOpponent,p)<22) {
          ty += (p.y<=nearestOpponent.y?-1:1)*5*close;
          tx += p.direction*4*close;
        }
      }
    } else {
      const goal=p.direction>0?5:95;
      tx += (goal-tx)*(back?.12:forward?.05:.08)*close;
      if (p.id===presserId && !action?.mark) {tx=ball.x+p.direction*2;ty=ball.y+(lane || 1)*2;}
      if (action?.mark && coverIds.has(p.id)) {tx=ball.x-p.direction*10;ty=ball.y+(lane || 1)*12;}
    }
    if(p.id===String(action?.playerId)) {tx=ball.x;ty=ball.y;}
    // Preserve the player's current run between actions. Only close players,
    // the carrier, presser and outlets should meaningfully change their route;
    // far-side teammates keep their shape without snapping back to their anchors.
    const approach = action?.reset || action?.ballUp ? 1
      : p.id === String(action?.playerId) ? .86
        : p.id === presserId || supportIds.has(p.id) ? .62
          : .08 + close * .28;
    return {...p,tx:p.x*(1-approach)+tx*approach,ty:p.y*(1-approach)+ty*approach};
  });
  const moved = targets.map(p => {
    let tx=p.tx, ty=p.ty;
    // Teammates provide space instead of stacking in the same receiving lane.
    for (const teammate of targets) {
      if (teammate===p || teammate.side!==p.side) continue;
      const gap=metres({x:tx,y:ty},{x:teammate.tx,y:teammate.ty});
      if (gap>=9) continue;
      const side=p.id.localeCompare(teammate.id)<0?-1:1;
      ty += side*(9-gap)/METRES_PER_Y*.55;
    }
    const next=runFootballer(p,{...p,x:Math.max(7,Math.min(93,tx)),y:Math.max(8,Math.min(92,ty))},actionTiming(action).duration/1000);
    const radius=Math.hypot((next.x-50)/44,(next.y-50)/42);
    return radius>1 ? {...next,x:50+(next.x-50)/radius,y:50+(next.y-50)/radius} : next;
  });
  return action?.reset ? moved : separatePlayers(moved);
}

// Shot outcomes use the same location and physical distance as the oval.
export function resolveSpatialShot(score, origin, left, skill=70, random=Math.random) {
  const distance=distanceToGoal(origin,left);
  const angle=Math.atan2(Math.abs((origin[1]-50)*METRES_PER_Y),Math.max(1,Math.abs(origin[0]-(left?5:95))*METRES_PER_X));
  const range=40+Math.max(0,Math.min(99,skill))*.25;
  const short=distance>range ? Math.min(.85,(distance-range)/20) : 0;
  const goal=Math.max(.08,Math.min(.96,.98-distance*.009-angle*.24+(skill-70)*.003));
  const roll=random();
  if(roll<short) return {...score,text:'Short'};
  if(roll<short+(1-short)*goal) return {...score,goals:score.goals+1,total:score.total+6,text:'Goal'};
  return {...score,behinds:score.behinds+1,total:score.total+1,text:'Behind'};
}

export function floatedBallPosition(from, to, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  // Blend linear and smoothstep so the ball keeps moving between consecutive
  // actions instead of slowing to a stop at the end of every pass.
  const eased = t*.6 + t*t*(3-2*t)*.4;
  const distance = Math.hypot(to[0]-from[0], (to[1]-from[1])*.65);
  return {
    x: from[0] + (to[0]-from[0])*eased,
    y: from[1] + (to[1]-from[1])*eased,
    lift: Math.sin(Math.PI*t) * Math.min(18, 4 + distance*.22),
  };
}


export const OVAL_SLOTS = {
  FP1:[85,34], FF:[91,50], FP2:[85,66], HF1:[74,32], CHF:[74,50], HF2:[74,68],
  W1:[50,22], C:[50,50], W2:[50,78], RR:[47,43], R:[50,47], ROV:[47,57],
  HB1:[26,32], CHB:[26,50], HB2:[26,68], BP1:[15,34], FB:[9,50], BP2:[15,66],
};

// Resolve the first, deliberately small passage in field coordinates. Each
// target is a real on-field teammate within kicking range. The clearance is
// carried out of the centre, the next link uses a midfielder or wing, and the
// entry looks for a forward inside 50. The opening sequence holds together
// as a vertical slice; the match engine still resolves the shot from its
// actual location and the kicker's ability.
const metresBetween = (a,b) => Math.hypot((a.x-b.x)*METRES_PER_X,(a.y-b.y)*METRES_PER_Y);

// Who wins the ball at a stoppage, kick-in or rebound. The nearest player is not enough: a key forward
// standing in the forward 50 would collect every chain that dies there. Each line of the team has an
// affinity for loose balls, adjusted by where on the ground the ball is, then weighted by distance so
// midfielders still win the ball in the middle and defenders win it deep in defence.
const slotRole = (row) => String(row.fieldSlot ?? row.matchPosition ?? row.player?.positions?.[0] ?? '').toUpperCase().replace(/[12]$/, '');
const STOPPAGE_AFFINITY = [
  [/^(?:MID|C|RR|ROV|FOL)$/, 1], [/^(?:WING|W)$/, .55], [/^(?:RUC|RUCK|R)$/, .3],
  [/^(?:HB|HBF)$/, .5], [/^CHB$/, .25], [/^(?:FB|BP|KPD|DEF)$/, .12],
  [/^(?:HF|HFF|CHF)$/, .3], [/^(?:FP|FF|KPF|FWD)$/, .12],
];
export function chooseStoppageCollector(rows, positions, origin, attacksLeft, random = Math.random) {
  const candidates = rows.filter(row => row.onField && positions.has(String(row.playerId)));
  if (!candidates.length) return null;
  const goalDistance = distanceToGoal(origin, attacksLeft);
  const deepDefence = goalDistance > 115, forwardZone = goalDistance < 50;
  const weights = candidates.map(row => {
    const role = slotRole(row);
    let affinity = STOPPAGE_AFFINITY.find(([pattern]) => pattern.test(role))?.[1] ?? .3;
    if (deepDefence && /^(?:FB|BP|KPD|DEF|CHB)$/.test(role)) affinity *= 5;
    else if (deepDefence && /^(?:HB|HBF)$/.test(role)) affinity *= 2.5;
    if (forwardZone && /^(?:HF|HFF|CHF|FP|FF|KPF|FWD)$/.test(role)) affinity *= 2.5;
    const distance = metresBetween(positions.get(String(row.playerId)), { x: origin[0], y: origin[1] });
    return Math.max(.0001, affinity / (1 + (distance / 18) ** 2) / (1 + Math.max(0, Number(row.disposals ?? 0) - 12) / 5));
  });
  let roll = random() * weights.reduce((sum, value) => sum + value, 0);
  return candidates.find((row, index) => (roll -= weights[index]) <= 0) ?? candidates.at(-1);
}

export function planCentrePassageStep(rows, positions, origin, attacksLeft, phase, carrierId, opponents = [], random = Math.random) {
  const forward = attacksLeft ? -1 : 1;
  const fielded = rows.filter(row => row.onField && positions.has(String(row.playerId)));
  const carrier = fielded.find(row => String(row.playerId) === String(carrierId));
  const metres = (point) => Math.hypot((point.x - origin[0]) * METRES_PER_X, (point.y - origin[1]) * METRES_PER_Y);
  const role = (row) => String(row.fieldSlot ?? row.matchPosition ?? row.player?.positions?.[0] ?? '').toUpperCase().replace(/[12]$/, '');
  if (phase === 0 || !carrier) {
    const centre = Math.hypot(origin[0]-50,origin[1]-50) < 5
      ? fielded.filter(row => /^(?:MID|C|RR|ROV|RUC|R|WING|W)$/.test(role(row))) : fielded;
    const atCentre = Math.hypot(origin[0]-50,origin[1]-50) < 5 && centre.length;
    const player = atCentre
      ? centre.slice().sort((a, b) => metres(positions.get(String(a.playerId))) - metres(positions.get(String(b.playerId))))[0]
      : chooseStoppageCollector(fielded, positions, origin, attacksLeft, random);
    return player ? { player, target: [...origin], carrying: false } : null;
  }
  if (phase === 1) {
    // Most clearances are a disposal (a handball or kick to a runner); some are a break-out carry.
    const breakOut = { player: carrier, target: [Math.max(8, Math.min(92, origin[0] + forward * 7)), origin[1]], carrying: true };
    const deep = distanceToGoal(origin, attacksLeft) > 110;
    const runners = fielded.filter(row => {
      if (row === carrier) return false;
      const rowRole = role(row);
      if (!(/^(?:MID|C|RR|ROV|R|WING|W|HB|HBF)$/.test(rowRole) || (deep && /^(?:FB|BP|CHB)$/.test(rowRole)))) return false;
      const point = positions.get(String(row.playerId));
      return metres(point) <= 28 && (point.x - origin[0]) * forward * METRES_PER_X >= -4;
    });
    if (!runners.length || random() > .88) return breakOut;
    const free = row => Math.min(25, ...opponents.filter(r => r.onField && positions.has(String(r.playerId))).map(r => metresBetween(positions.get(String(row.playerId)), positions.get(String(r.playerId)))));
    const runner = runners.map(row => {
      const point = positions.get(String(row.playerId));
      return { row, value: free(row) * 1.2 + (point.x - origin[0]) * forward * .3 - metres(point) * .15 - Math.max(0, Number(row.disposals ?? 0) - 12) * 2.2 + random() * 8 };
    }).sort((a, b) => b.value - a.value)[0].row;
    const point = positions.get(String(runner.playerId));
    return { player: runner, target: [point.x, point.y], carrying: false };
  }
  if (phase >= 4) return { player: carrier, target: [...origin], carrying: true };

  // A player in a clear scoring position takes the shot instead of restarting
  // a midfield link merely because the possession chain is in transition.
  if (phase >= 2 && distanceToGoal(origin, attacksLeft) <= 40 && random() < .3) {
    return { player: carrier, target: [...origin], carrying: true, nextPhase: 5 };
  }

  const deepDefence = distanceToGoal(origin, attacksLeft) > 105;
  const forwardHalf = distanceToGoal(origin, attacksLeft) < 95;
  const desired = phase === 2
    ? (deepDefence ? /^(?:MID|C|RR|ROV|WING|W|HB|HBF|BP|FB|CHB)$/
      : forwardHalf ? /^(?:MID|C|RR|ROV|WING|W|HB|HBF|HF|HFF|CHF|FP)$/ : /^(?:MID|C|RR|ROV|WING|W|HB|HBF)$/)
    : /^(?:KPF|FF|FP|HF|HFF|CHF|FWD)$/;
  const candidates = fielded.filter(row => {
    if (row === carrier || !desired.test(role(row))) return false;
    const point = positions.get(String(row.playerId));
    const gain = (point.x - origin[0]) * forward * METRES_PER_X;
    return gain >= (phase === 2 ? 0 : 3) && metres(point) <= 52
      && (phase !== 3 || distanceToGoal([point.x, point.y], attacksLeft) <= 56);
  }).sort((a, b) => {
    const value = (row) => {
      const point = positions.get(String(row.playerId));
      const gain = (point.x - origin[0]) * forward * METRES_PER_X;
      const goalDistance = distanceToGoal([point.x, point.y], attacksLeft);
      const width = Math.abs(point.y - origin[1]) * METRES_PER_Y;
      return (phase === 3 ? -Math.abs(goalDistance - 36) : gain * .35)
        - metres(point) * .2 - width * .08;
    };
    return value(b) - value(a);
  });
  const awareness = Number(carrier?.player?.attributes?.decisionMaking ?? carrier?.player?.attributes?.gameAwareness ?? 65);
  const space = row => {
    const point=positions.get(String(row.playerId));
    return Math.min(25,...opponents.filter(r=>r.onField&&positions.has(String(r.playerId))).map(r=>metresBetween(point,positions.get(String(r.playerId)))));
  };
  // Half-backs are the link out of defence; key defenders take fewer receptions than the line ahead of them.
  const lineBonus = row => {
    const rowRole = role(row);
    const ballDistance = distanceToGoal(origin, attacksLeft);
    if (phase === 2 && /^(?:HB|HBF)$/.test(rowRole) && ballDistance > 85) return 14;
    if (phase === 2 && /^(?:WING|W)$/.test(rowRole)) return -5;
    if (phase === 2 && /^(?:MID|C|RR|ROV)$/.test(rowRole) && ballDistance > 105) return -7;
    if (phase === 2 && /^(?:HF|HFF|CHF)$/.test(rowRole) && ballDistance < 95) return 4;
    if (phase === 2 && /^FP$/.test(rowRole) && ballDistance < 95) return 8;
    if (phase === 2 && /^(?:MID|C|RR|ROV|WING|W)$/.test(rowRole) && ballDistance < 95) return -4;
    if (phase === 2 && /^(?:BP|FB|CHB)$/.test(rowRole)) return -8;
    if (phase === 3 && /^FP$/.test(rowRole)) return 14;
    if (phase === 3 && /^HF$/.test(rowRole)) return 4;
    return 0;
  };
  // Soft cap on one player's involvement: once a player is well past 20 disposals the ball finds teammates.
  const involvement = row => Math.max(0, Number(row.disposals ?? 0) - 12) * 2.2;
  const ranked = candidates.map(row=>({row,value:space(row)*1.5+(positions.get(String(row.playerId)).x-origin[0])*forward*.4 + lineBonus(row) - involvement(row) + random()*(100-awareness)*.3})).sort((a,b)=>b.value-a.value);
  // Pick among the best few options rather than always the single best, so leads are shared around the
  // line (half-forwards and flankers as well as the key forward at the ideal distance from goal).
  const pickWeights = [.5, .3, .2].slice(0, Math.min(3, ranked.length));
  let pickRoll = random() * pickWeights.reduce((a, b) => a + b, 0);
  const picked = ranked.slice(0, pickWeights.length).find((entry, index) => (pickRoll -= pickWeights[index]) <= 0) ?? ranked[0];
  const player = picked?.row;
  if (!player) {
    // A carrier already inside shooting range must not keep searching for a
    // forward who is now behind the ball. Finish the passage with a shot.
    if (distanceToGoal(origin, attacksLeft) <= 55) {
      return { player: carrier, target: [...origin], carrying: true, nextPhase: phase === 2 ? 3 : 5 };
    }
    return { player: carrier, target: [Math.max(8, Math.min(92, origin[0] + forward * 6)), origin[1] + Math.max(-3, Math.min(3, 50-origin[1]))], carrying: true, repeatPhase: true };
  }
  const point = positions.get(String(player.playerId));
  // A forward leads a few metres toward goal. Keep the catch point within the
  // receiver's movement budget and the kick's physical range.
  let lead = phase === 3 ? Math.min(5, Math.max(0, (distanceToGoal([point.x, point.y], attacksLeft) - 25) / METRES_PER_X)) : 0;
  while (lead > 0 && Math.hypot((point.x + forward * lead - origin[0]) * METRES_PER_X, (point.y - origin[1]) * METRES_PER_Y) > 52) lead -= 1;
  const target = [Math.max(8, Math.min(92, point.x + forward * Math.max(0, lead))), point.y];
  // Midfield and rebound play is a run of short kicks and handballs. Keep the chain in transition while
  // the ball is still a long way from goal so it can build several disposals before the forward entry.
  const looping = (phase === 2 && distanceToGoal(target, attacksLeft) > 75 && random() < .8)
    || (phase === 3 && distanceToGoal(target, attacksLeft) > 42 && random() < .55);
  return { player, target, carrying: false, ...(looping ? { repeatPhase: true } : {}) };
}

// Resolve a reachable receiver before generating statistics or animation.
// Kick distance is limited by the kicker's ability; near goal, players attack
// or shoot rather than kicking backwards. Pressure narrows the safe radius.
export function chooseSpatialPossession(rows, positions, origin, left, previousId, random = Math.random, tactics = {}, phase = 0, kickerSkill = 70, pressure = 0) {
  const distance = (point) => Math.hypot((point.x-origin[0])*METRES_PER_X, (point.y-origin[1])*METRES_PER_Y);
  const forward = left ? -1 : 1;
  const fielded = rows.filter(row => row.onField && positions.has(String(row.playerId)));
  const carrier = fielded.find(row => String(row.playerId) === String(previousId));
  if (!carrier || phase === 0) {
    const collector = chooseStoppageCollector(fielded, positions, origin, left, random);
    return collector ? {player:collector,target:[...origin],carrying:false} : null;
  }
  if(phase>=4) return {player:carrier,target:[...origin],carrying:true};
  const nearGoal=distanceToGoal(origin,left)<45, veryNearGoal=distanceToGoal(origin,left)<30;
  const maxRange=Math.max(25,Math.min(60,30+(kickerSkill-50)*.6-pressure*8));
  const options = fielded.filter(row => {
    const point = positions.get(String(row.playerId));
    const gain = (point.x-origin[0])*forward*METRES_PER_X;
    // Near goal, allow lateral or slightly backwards options (crumbing forwards);
    // elsewhere require forward progress unless the carrier is under extreme pressure.
    const minGain = nearGoal ? -2 : pressure > 0.3 ? -8 : -3;
    return row !== carrier && distance(point) <= maxRange && gain >= minGain
      && (!nearGoal || distanceToGoal([point.x,point.y],left) <= distanceToGoal(origin,left) + 8)
      && (!veryNearGoal || distanceToGoal([point.x,point.y],left) <= distanceToGoal(origin,left) + 3);
  });
  const roleFor = row => {
    const role = String(row.matchPosition ?? '').toUpperCase();
    if (/^(KPF|FF|FP|HF|CHF|FWD)/.test(role)) return 'forward';
    if (/^(MID|C|RR|ROV|RUC|R|WING|W)/.test(role)) return 'midfield';
    if (/^(KPD|FB|BP|HB|CHB|DEF)/.test(role)) return 'back';
    return 'other';
  };
  const preferredRoles = phase <= 1 ? ['midfield']
    : phase === 2 ? ['midfield', 'back']
      : phase === 3 ? ['midfield', 'forward'] : ['forward'];
  const preferred = options.filter(row => preferredRoles.includes(roleFor(row)));
  const receivers = options;
  let chosen;
  if (receivers.length) {
    const territory = Math.max(0, Math.min(100, Number(tactics?.sliders?.possessionTerritory ?? 50)));
    const safety = Math.max(0, Math.min(100, Number(tactics?.sliders?.riskSafety ?? 50)));
    const weights = receivers.map(row => {
      const point = positions.get(String(row.playerId));
      const gain = (point.x-origin[0])*forward;
      const role = String(row.matchPosition ?? '').toUpperCase();
      const forwardRole = /^(KPF|FF|FP|HF|CHF|FWD)/.test(role);
      const midfieldRole = /^(MID|C|RR|ROV|RUC|R|WING|W)/.test(role);
      const backRole = /^(KPD|FB|BP|HB|CHB|DEF)/.test(role);
      // Stronger role weighting so midfielders dominate clearances and
      // forwards dominate forward entries, matching real disposal patterns.
      const ruckRole = /^(RUCK|RUC|R|RR|ROV)/.test(role);
      const roleWeight = 1; // Space and reachability determine the receiver, not possession quotas.
      // Players closer to goal get a boost when very near goal (attack or shoot).
      const goalBonus = veryNearGoal && forwardRole ? 1.4 : 1;
      // Higher-skill players are preferred targets under pressure.
      const playerSkill = Number(row.player?.attributes?.gameAwareness ?? row.player?.overall ?? 65);
      const skillBonus = 1 + (playerSkill - 65) * 0.003;
      return Math.max(1, 12 + gain*(.25+territory*.009) - distance(point)*(.08+safety*.0025)) * roleWeight * goalBonus * skillBonus;
    });
    let roll = random()*weights.reduce((a,b)=>a+b,0);
    chosen = receivers.find((row,index) => (roll -= weights[index]) <= 0) ?? receivers.at(-1);
  } else chosen = carrier ?? fielded.slice().sort((a,b)=>distance(positions.get(String(a.playerId)))-distance(positions.get(String(b.playerId))))[0];
  if (!chosen) return null;
  const point = positions.get(String(chosen.playerId));
  // No passing option: retain possession and carry up to ten metres.
  const target = chosen === carrier ? [Math.max(8,Math.min(92,origin[0]+forward*10/METRES_PER_X)),origin[1]] : [point.x,point.y];
  return { player: chosen, target, carrying: chosen === carrier };
}
