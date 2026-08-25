/* Tracing a ride over the vendored line geometry. Pure: the tests import this. */

import { RAIL } from "../data/rail.js";
import { SUBWAY } from "../data/subway.js";
import { metres, projectOnSeg } from "./geo.js";

/* ===========================================================
   THE RIDE  —  drawing a route over the real track geometry
   The rail blobs above are bare polylines with no station index,
   so a ride is traced by snapping both ends onto the track and
   walking the line's own geometry between them: every line becomes
   a small graph (its paths, stitched where branches meet and where
   the Line 2 ring closes) and the ride is the shortest walk through
   it — which is what picks the sane way round the loop.
   =========================================================== */

export const railGraphs = {};
export function railGraph(city, ref){
  const key = city + "/" + ref;
  if (key in railGraphs) return railGraphs[key];
  const ln = (RAIL[city] || []).find(l => l.ref === ref);
  if (!ln) return (railGraphs[key] = null);
  const nodes = [], adj = [], segs = [], owner = [];
  ln.paths.forEach((p, pi) => {
    let prev = -1;
    p.pts.forEach(pt => {
      const i = nodes.length; nodes.push(pt); adj.push([]); owner.push(pi);
      if (prev >= 0){
        const d = metres(nodes[prev], pt);
        adj[prev].push([i, d]); adj[i].push([prev, d]); segs.push([prev, i]);
      }
      prev = i;
    });
  });
  const ends = []; let base = 0;
  ln.paths.forEach(p => {
    const a = base, b = base + p.pts.length - 1;
    // Line 2 is a ring: same place at both ends of the path, but two nodes
    if (metres(nodes[a], nodes[b]) < 50){ adj[a].push([b, 0]); adj[b].push([a, 0]); }
    ends.push(a, b); base += p.pts.length;
  });
  // branches meet the trunk at a station the two polylines don't share a vertex with
  ends.forEach(e => {
    let best = -1, bd = 700;
    for (let i = 0; i < nodes.length; i++){
      if (owner[i] === owner[e]) continue;
      const d = metres(nodes[i], nodes[e]);
      if (d < bd){ bd = d; best = i; }
    }
    if (best >= 0){ adj[e].push([best, bd]); adj[best].push([e, bd]); }
  });
  return (railGraphs[key] = { nodes, adj, segs });
}
export function snapToLine(g, c){
  let best = null;
  for (const [i, j] of g.segs){
    const r = projectOnSeg(c, g.nodes[i], g.nodes[j]);
    if (!best || r.d < best.d) best = { d: r.d, i, j, pt: r.pt };
  }
  return best;
}
export function ride(g, from, to){
  const A = snapToLine(g, from), B = snapToLine(g, to);
  if (!A || !B) return null;
  if (A.i === B.i && A.j === B.j) return [A.pt, B.pt];
  const n = g.nodes.length;
  const D = new Array(n).fill(Infinity), P = new Array(n).fill(-1), seen = new Array(n).fill(false);
  D[A.i] = metres(A.pt, g.nodes[A.i]); D[A.j] = metres(A.pt, g.nodes[A.j]);
  for (;;){
    let u = -1, bd = Infinity;
    for (let i = 0; i < n; i++) if (!seen[i] && D[i] < bd){ bd = D[i]; u = i; }
    if (u < 0) break;
    seen[u] = true;
    for (const [v, w] of g.adj[u]) if (D[u] + w < D[v]){ D[v] = D[u] + w; P[v] = u; }
  }
  let end = -1, bd = Infinity;
  for (const i of [B.i, B.j]){
    const t = D[i] + metres(B.pt, g.nodes[i]);
    if (t < bd){ bd = t; end = i; }
  }
  if (end < 0 || !isFinite(bd)) return null;
  const mid = [];
  for (let cur = end; cur >= 0; cur = P[cur]) mid.push(g.nodes[cur]);
  mid.reverse();
  return [A.pt, ...mid, B.pt];
}
export function measure(pts){
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + metres(pts[i - 1], pts[i]));
  return cum;
}
export function tidy(pts){
  const out = [];
  for (const p of pts) if (!out.length || metres(out[out.length - 1], p) > 2) out.push(p);
  return out;
}

export function lineMeta(ref, city){
  const ln = (RAIL[city] || []).find(l => l.ref === ref)
    || SUBWAY.find(l => l.ref === ref);
  return ln || { label: "Line " + ref, color: "#888" };
}
