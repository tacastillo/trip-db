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
