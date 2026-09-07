/* Distances the way the page measures them. Equirectangular rather than haversine: at
   city scale the difference is under a metre (tools/test-plan.mjs pins that), and every
   threshold in the planner is a comparison against a number tuned with this one. */

export const EARTH_R = 6371000, DEG = Math.PI / 180;
export function metres(a, b){
  const dy = (b[0] - a[0]) * DEG * EARTH_R;
  const dx = (b[1] - a[1]) * DEG * EARTH_R * Math.cos((a[0] + b[0]) / 2 * DEG);
  return Math.hypot(dx, dy);
}
export function lerpPt(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
/* closest point on segment a–b to c — stations sit between vertices far more
   often than on one, so projecting is what keeps the ride ending at the label */
export function projectOnSeg(c, a, b){
  const k = Math.cos(a[0] * DEG);
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], cx = c[1] * k, cy = c[0];
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  let t = l2 ? ((cx - ax) * vx + (cy - ay) * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const pt = lerpPt(a, b, t);
  return { pt, d: metres(c, pt) };
}

/* Which leg of the trip a point is standing in.

   The leg tabs are the trip's calendar, and the calendar is a plan: a day slips, a
   flight moves, an afternoon in Jeju runs into the evening you had filed under Busan —
   and the map is then showing a city you are three hundred kilometres from, with the
   list, the pins and "nearest first" all describing somewhere else. The phone knows
   better than the plan does, so this is what the 📍 button asks before it draws the dot.

   Answered off the places themselves rather than a bounding box per city: the pins are
   what the map actually has, so the nearest one is the honest reading of "this area",
   and it needs no second table to drift out of date. Far from all of them — at home,
   months out, or on a plane — the answer is null rather than a guess, because moving
   somebody's map to the wrong city is worse than leaving it where they put it. */
export const LEG_NEAR_MAX = 80000;
export function legForPoint(pt, places, maxM = LEG_NEAR_MAX){
  let best = null, bestD = Infinity;
  for (const p of places){
    const d = metres(pt, [p.lat, p.lng]);
    if (d < bestD){ bestD = d; best = p.city; }
  }
  return bestD <= maxM ? best : null;
}
