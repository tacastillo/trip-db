#!/usr/bin/env node
/* Exercise the geometry pipeline without touching the network.

     node tools/test-pipeline.mjs

   fetch-rail.mjs is two halves: ask Overpass for ways, then turn ways into
   paths. Only the first half needs the internet. This feeds the second half
   the geometry already in src/data/, chopped into pieces and shuffled the way
   relation members actually arrive, and checks it comes back out intact. */

import { readSource, sourceFor, buildLine, stitch, simplify, clipToRadius,
         metres, pointToSeg, distToPath, serializeRail, writeConst } from "./lib.mjs";
import { SUBWAY } from "../src/data/subway.js";

let failed = 0;
const ok = (name, pass, detail = "") => {
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!pass) failed++;
};

const SEOUL = { centre: [37.5665, 126.9780], clipKm: 40 };
const SUBWAY_FILE = sourceFor("SUBWAY");
const src = readSource(SUBWAY_FILE);

/* Chop a path into ways of 3–9 points, overlapping at the joins like OSM's do,
   then reverse some and shuffle the lot — a relation's members are in no
   guaranteed order or direction. */
function explode(pts, seed = 1){
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ways = [];
  for (let i = 0; i < pts.length - 1; ){
    const n = 3 + Math.floor(rnd() * 7);
    const w = pts.slice(i, Math.min(i + n, pts.length));
    if (w.length > 1) ways.push(rnd() < 0.5 ? w.slice().reverse() : w);
    i += w.length - 1;
  }
  return ways.map(w => [w, rnd()]).sort((a, b) => a[1] - b[1]).map(w => w[0]);
}

console.log("stitch");
{
  const line2 = SUBWAY.find(l => l.ref === "2");
  const open = SUBWAY.find(l => l.ref === "5").paths[0].pts;      // an open path, not the loop
  const back = stitch(explode(open, 7), 30);
  ok("a shuffled, part-reversed path stitches back into one",
     back.length === 1, `${back.length} path(s) from ${explode(open, 7).length} ways`);
  if (back.length === 1){
    const ends = Math.min(metres(back[0][0], open[0]), metres(back[0][0], open.at(-1)));
    ok("and keeps every point", back[0].length === open.length, `${back[0].length} vs ${open.length}`);
    ok("and starts at one of the original ends", ends < 1, `${ends.toFixed(2)}m`);
  }
  const loop = line2.paths[0].pts;                                 // a ring may start anywhere
  const ring = stitch(explode(loop, 7), 30);
  ok("a loop stitches into one closed ring",
     ring.length === 1 && metres(ring[0][0], ring[0].at(-1)) < 200, `${ring.length} path(s)`);
  const two = stitch([...explode(line2.paths[1].pts, 3), ...explode(line2.paths[2].pts, 5)], 30);
  ok("two unrelated paths do not get joined", two.length >= 2, `${two.length} paths`);
}

console.log("\nsimplify");
{
  const pts = SUBWAY.find(l => l.ref === "5").paths[0].pts;
  for (const tol of [5, 20, 100]){
    const out = simplify(pts, tol);
    let worst = 0;                                   // every dropped point must stay within tol
    for (const p of pts){
      let d = Infinity;
      for (let i = 1; i < out.length; i++) d = Math.min(d, pointToSeg(p, out[i - 1], out[i]));
      worst = Math.max(worst, d);
    }
    ok(`tolerance ${tol}m holds`, worst <= tol + 1e-6,
       `${pts.length} → ${out.length} pts, worst deviation ${worst.toFixed(1)}m`);
  }
  ok("endpoints survive simplification",
     simplify(pts, 100)[0] === pts[0] && simplify(pts, 100).at(-1) === pts.at(-1));
}

console.log("\nclip");
{
  const far = [[37.5665, 126.978], [38.4, 126.978], [37.5665, 126.978]];   // out and back
  const cut = clipToRadius(far, SEOUL.centre, 40);
  ok("a path leaving and returning becomes two pieces", cut.length === 2, `${cut.length}`);
  ok("both cuts are marked", cut.every(c => c.cutStart || c.cutEnd));
  ok("nothing survives beyond the radius",
     cut.every(c => c.pts.every(p => metres(p, SEOUL.centre) <= 40_000 + 1)));
  const inside = [[37.55, 126.97], [37.56, 126.98], [37.57, 126.99]];
  const whole = clipToRadius(inside, SEOUL.centre, 40);
  ok("a path wholly inside is untouched",
     whole.length === 1 && whole[0].pts.length === 3 && !whole[0].cutStart && !whole[0].cutEnd);
}

console.log("\nend labelling");
{
  // line 2's loop plus its two branches: the branch ends that touch the loop
  // are junctions, the far ends are termini, and nothing here is clipped
  const line2 = SUBWAY.find(l => l.ref === "2");
  const groups = line2.paths.map((p, i) => explode(p.pts, i + 11));   // one group per relation
  const rebuilt = buildLine({ ref: "2", label: "Line 2", color: "#00A23F" }, groups, SEOUL);
  const kinds = rebuilt.paths.flatMap(p => p.ends);
  ok("every end gets a known label",
     kinds.every(k => ["clip", "terminus", "junction"].includes(k)), kinds.join(","));
  ok("the branches are recognised as meeting the loop",
     kinds.filter(k => k === "junction").length >= 2,
     `${kinds.filter(k => k === "junction").length} junction ends`);
  const original = line2.paths.flatMap(p => p.ends);
  ok("same tally of junction ends as the vendored data",
     kinds.filter(k => k === "junction").length === original.filter(k => k === "junction").length,
     `rebuilt ${kinds.filter(k => k === "junction").length}, vendored ${original.filter(k => k === "junction").length}`);
}

console.log("\nduplicate directions");
{
  const line5 = SUBWAY.find(l => l.ref === "5");
  const forward = explode(line5.paths[0].pts, 21);
  const backward = explode(line5.paths[0].pts.slice().reverse(), 22);   // the other direction
  const out = buildLine(line5, [forward, backward], SEOUL);
  ok("both directions of one service collapse to a single path",
     out.paths.length === 1, `${out.paths.length} path(s)`);
}

console.log("\nround trip through the whole pipeline");
{
  let maxDev = 0, ptsIn = 0, ptsOut = 0;
  for (const line of SUBWAY){
    const groups = line.paths.map((p, i) => explode(p.pts, i + 3));
    const out = buildLine(line, groups, SEOUL);
    ptsIn += line.paths.reduce((n, p) => n + p.pts.length, 0);
    ptsOut += out.paths.reduce((n, p) => n + p.pts.length, 0);
    for (const p of line.paths)                       // every original point still near a rebuilt one
      for (const pt of p.pts){
        // …except beyond the clip radius. Some vendored tails reach past 40km,
        // so re-clipping is meant to drop them.
        if (metres(pt, SEOUL.centre) > SEOUL.clipKm * 1000 - 50) continue;
        maxDev = Math.max(maxDev, Math.min(...out.paths.map(q => distToPath(pt, q.pts))));
      }
  }
  ok("all 11 Seoul lines survive a full rebuild",
     maxDev < 25, `worst point inside the clip moved ${maxDev.toFixed(1)}m; ${ptsIn} pts in, ${ptsOut} out`);
}

console.log("\nwriting back");
{
  const rewritten = writeConst(src, "SUBWAY", serializeRail(SUBWAY));
  ok(`re-serialising the vendored data reproduces ${SUBWAY_FILE} exactly`, rewritten === src);
  const bumped = writeConst(src, "SUBWAY", serializeRail(SUBWAY.slice(0, 2)));
  ok("a real change only touches that constant",
     bumped !== src && bumped.split("\n").length === src.split("\n").length);
}

console.log(`\n${failed} failure(s)`);
process.exit(failed ? 1 : 0);
