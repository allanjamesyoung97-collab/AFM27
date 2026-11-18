import { METRES_PER_X, METRES_PER_Y } from './matchPresentation.js';

export function runningProfile(player = {}) {
  const a = player.attributes ?? {};
  const rating = key => Math.max(1,Math.min(99,Number(a[key] ?? player.overall ?? 65)));
  return { maxSpeed:5.3+rating('speed')*.032, acceleration:2.5+rating('acceleration')*.022 };
}

// Velocity survives action changes. Steering has a turn-rate limit, so a
// footballer must curve into a new run rather than change direction instantly.
export function runFootballer(start, target, seconds) {
  let p = { ...target, ...start };
  let remaining = Math.max(0, seconds);
  while (remaining > 0) {
    const dt = Math.min(.025, remaining);
    remaining -= dt;
    const dx = (target.x-p.x)*METRES_PER_X, dy = (target.y-p.y)*METRES_PER_Y;
    const distance = Math.hypot(dx,dy);
    const desired = Math.atan2(dy,dx);
    const heading = p.heading ?? desired;
    const turn = Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
    const speed = p.speed ?? 0;
    const maxTurn = (speed > 3 ? 1.8 : 3.5)*dt;
    const nextHeading = heading+Math.max(-maxTurn,Math.min(maxTurn,turn));
    const wantedSpeed = Math.min(target.maxSpeed ?? 7.5,Math.sqrt(2*5*distance)) * Math.max(.2, Math.cos(turn));
    const nextSpeed = Math.max(0, speed + Math.max(-5*dt,Math.min((target.acceleration ?? 3.8)*dt,wantedSpeed-speed)));
    p = { ...target, heading:nextHeading, speed:nextSpeed,
      x:p.x+Math.cos(nextHeading)*nextSpeed*dt/METRES_PER_X,
      y:p.y+Math.sin(nextHeading)*nextSpeed*dt/METRES_PER_Y };
    if (distance < .15 && nextSpeed < .5) p = {...p,x:target.x,y:target.y,speed:0};
  }
  return p;
}

// A gameplay spacing rule: one nominated marker, every other opponent clears
// a ten-metre radius. The marker stands goal-side of the possession location.
export function protectKicker(points, zone) {
  if (!zone) return points;
  return points.map(p => {
    if (p.side === zone.side) return p;
    if (p.id === String(zone.markerId)) return {...p,x:zone.origin[0]+zone.direction*3/METRES_PER_X,y:zone.origin[1]};
    let dx=(p.x-zone.origin[0])*METRES_PER_X, dy=(p.y-zone.origin[1])*METRES_PER_Y;
    const distance=Math.hypot(dx,dy);
    if (distance >= 10) return p;
    if (distance < .01) { dx=-zone.direction; dy=1; }
    const length=Math.hypot(dx,dy);
    return {...p,x:zone.origin[0]+dx/length*10/METRES_PER_X,y:zone.origin[1]+dy/length*10/METRES_PER_Y};
  });
}
