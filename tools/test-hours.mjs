#!/usr/bin/env node
/* Exercise the opening-hours parser against the grammar the source database uses.

     node tools/test-hours.mjs

   No network, no arguments, no browser. src/lib/hours.js never reads a clock — every
   check below hands it one — which is the only reason a 26:00 closing time can be tested
   at half past one in the morning without a machine that believes it is. */

import { parseHours, openState, closedFromHours, fmtMin, DOW } from "../src/lib/hours.js";
import { closedDaysFor } from "../src/lib/plan-core.js";
import { PLACES } from "../src/data/places.js";

let failures = 0;
const ok = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail && !pass ? `\n        ${detail}` : ""}`);
};
const group = (n) => console.log(`\n${n}`);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const at = (hours, dow, minutes) => openState({ hours }, { dow, minutes });
const hm = (h, m) => h * 60 + (m || 0);

/* ---------- every form that occurs in the source column ---------- */
group("the grammar");

const GRAMMAR = [
  ["24h",                                        "mon", [[0, 1440]]],
  ["Daily 09:00-22:00",                          "sat", [[540, 1320]]],
  ["Daily 10:00-14:50,17:00-21:30",              "wed", [[600, 890], [1020, 1290]]],
  ["Daily 09:30-18:30; closed Tue",              "wed", [[570, 1110]]],
  ["Daily 10:00-18:30; LO 18:00",                "thu", [[600, 1110]]],
  ["Mon-Thu 10:30-20:00; Fri-Sun 10:30-20:30",   "fri", [[630, 1230]]],
  ["Tue-Thu 11:00-17:00; Fri 10:30-17:00; Sat,Sun 11:00-17:00; closed Mon", "fri", [[630, 1020]]],
  ["Sun-Wed 19:00-26:00; Thu-Sat 19:00-28:00",   "thu", [[1140, 1680]]],
  ["Daily 11:00-20:00; closed Mon; LO 19:30",    "tue", [[660, 1200]]],
  ["Mon-Wed 12:00-21:30; Thu 16:30-21:30; Fri-Sun 12:00-21:30", "thu", [[990, 1290]]],
];
for (const [src, dow, want] of GRAMMAR){
  const h = parseHours(src);
  ok(`${src}  →  ${dow}`, h && eq(h.perDay[dow], want), `got ${h ? JSON.stringify(h.perDay[dow]) : "null"}`);
}

ok("a day-range wraps the week (Sun-Wed is four days)",
  eq(DOW.filter(d => parseHours("Sun-Wed 19:00-26:00").perDay[d].length), ["mon", "tue", "wed", "sun"]));
ok("LO is carried, not enforced", parseHours("Daily 10:00-18:30; LO 18:00").lastOrder === hm(18));
ok("a closing day beats the Daily that set it",
  eq(parseHours("Daily 09:30-18:30; closed Tue").perDay.tue, []));
ok("closed takes a range too",
  eq(parseHours("Daily 11:00-18:00; closed Mon-Wed").closed, ["mon", "tue", "wed"]));

/* ---------- what it refuses ---------- */
group("degrade, do not break");

for (const bad of ["", null, undefined, "Open late", "Daily", "9am-10pm", "Daily 25:00-09:00",
                   "Daily 18:00-09:00", "Someday 10:00-12:00", "Daily 10:00-12:00; wat"]){
  ok(`${JSON.stringify(bad)} → null`, parseHours(bad) === null);
}
ok("an unparseable string leaves the state unknown, never a guess",
  at("Open late", "mon", hm(12)).state === "unknown");
ok("a place with no hours at all is unknown", openState({}, { dow: "mon", minutes: 0 }).state === "unknown");
ok("a broken clock is unknown, not open", at("24h", "funday", 0).state === "unknown");

/* ---------- open right now ---------- */
group("open right now");

ok("24h is open at 03:00", at("24h", "wed", hm(3)).state === "open");
ok("inside the morning session", at("Daily 09:00-22:00", "wed", hm(10)).state === "open");
ok("one minute before opening is closed", at("Daily 09:00-22:00", "wed", hm(8, 59)).state === "closed");
ok("the closing minute itself is closed", at("Daily 09:00-22:00", "wed", hm(22)).state === "closed");
ok("open reports when it shuts", at("Daily 09:00-22:00", "wed", hm(10)).until === hm(22));

const LUNCH = "Daily 10:00-14:50,17:00-21:30";
ok("before the break, open", at(LUNCH, "wed", hm(14)).state === "open");
ok("in the break, shut", at(LUNCH, "wed", hm(15)).state === "closed");
ok("the break says when it reopens", at(LUNCH, "wed", hm(15)).opensAt === hm(17));
ok("after the break, open again", at(LUNCH, "wed", hm(18)).state === "open");

/* The one that needed a parser rather than a regex: a bar shutting at 26:00 on Sunday is
   still open at 01:30 on Monday, and Monday's own row says nothing about it. */
const CHAMBER = "Sun-Wed 19:00-26:00; Thu-Sat 19:00-28:00";
ok("01:30 Monday falls inside Sunday's 26:00", at(CHAMBER, "mon", hm(1, 30)).state === "open");
ok("…and it reads as shutting at 02:00", fmtMin(at(CHAMBER, "mon", hm(1, 30)).until) === "02:00");
ok("03:00 Monday is past it", at(CHAMBER, "mon", hm(3)).state === "closed");
ok("03:00 Sunday is past Saturday's 28:00 too", at(CHAMBER, "sun", hm(5)).state === "closed");
ok("04:00 Sunday is still inside Saturday's 28:00", at(CHAMBER, "sun", hm(3, 30)).state === "open");
ok("Monday evening opens on time", at(CHAMBER, "mon", hm(19)).state === "open");

ok("a shut day rolls to the next open one",
  at("Daily 11:00-18:00; closed Mon", "mon", hm(12)).opensDow === "tue");
ok("…and says how far ahead that is",
  at("Daily 11:00-18:00; closed Mon", "mon", hm(12)).opensAhead === 1);
ok("after close, tomorrow", at("Daily 09:00-17:00", "wed", hm(20)).opensAhead === 1);
ok("before open, today", at("Daily 09:00-17:00", "wed", hm(7)).opensAhead === 0);

ok("fmtMin wraps past midnight", fmtMin(1560) === "02:00" && fmtMin(1680) === "04:00");
ok("fmtMin pads", fmtMin(hm(9, 5)) === "09:05");

/* ---------- against the data the page ships ---------- */
group("the trip's own data");

const withHours = PLACES.filter(p => p.hours);
ok(`every hours string in places.js parses (${withHours.length} of them)`,
  withHours.every(p => parseHours(p.hours)),
  withHours.filter(p => !parseHours(p.hours)).map(p => `${p.id}: ${p.hours}`).join("\n        "));

const disagrees = PLACES.filter(p => {
  if (!p.hours || !Array.isArray(p.closed)) return false;
  const fromHours = closedFromHours(p.hours);
  return fromHours && !eq(fromHours.slice().sort(), p.closed.slice().sort());
});
ok("the closed field and the hours string agree with each other", !disagrees.length,
  disagrees.map(p => `${p.id}: closed=${JSON.stringify(p.closed)} hours=${p.hours}`).join("\n        "));

ok("closedDaysFor prefers the structured field",
  eq(closedDaysFor({ closed: ["mon"], meta: "Closed Tue" }), ["mon"]));
ok("an explicit empty closed means open every day, and does not fall back to prose",
  eq(closedDaysFor({ closed: [], meta: "Closed Tue" }), []));
ok("with no field it reads the hours string",
  eq(closedDaysFor({ hours: "Daily 09:30-18:30; closed Tue" }), ["tue"]));
ok("with neither it still reads the old prose",
  eq(closedDaysFor({ meta: "Closed Mon–Tue" }), ["mon", "tue"]));
ok("prose the anchored regex used to miss is now caught by the field",
  eq(closedDaysFor({ closed: ["mon"], meta: "BOOKED · Closed Mon" }), ["mon"]));
ok("nothing at all is no claim", eq(closedDaysFor({}), []) && eq(closedDaysFor(null), []));

console.log(failures ? `\n${failures} failed\n` : "\nall good\n");
process.exit(failures ? 1 : 0);
