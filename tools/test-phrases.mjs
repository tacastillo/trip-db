#!/usr/bin/env node
/* Exercise the cheat sheet's pure core.

     node tools/test-phrases.mjs

   No network, no arguments, no browser. Two things are worth pinning here and neither is
   visible to check-data.mjs: that a `say` string still reads correctly once the stress
   marks are taken back out of it, and that the price reader regroups into 만 the way
   Korean does rather than the way English wants to. The second is the whole reason the
   reader exists, so it is the half with the most cases. */

import { countMatching, hasStress, matchesPhrase, saySpoken, sayParts, sections } from "../src/lib/phrases.js";
import { WON_MAX, wonReading } from "../src/lib/won.js";
import { GROUPS, NUMBERS, PHRASES, PRICE_PRESETS, TIERS } from "../src/data/phrases.js";

let failures = 0;
const ok = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail && !pass ? `\n        ${detail}` : ""}`);
};
const group = (n) => console.log(`\n${n}`);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- the stress marks ---------- */
group("reading a say string");

ok("a marked run comes back flagged, the rest does not",
  eq(sayParts("*kahm*-sah-*ham*-nee-da"), [
    { text:"kahm", stress:true }, { text:"-sah-", stress:false },
    { text:"ham",  stress:true }, { text:"-nee-da", stress:false },
  ]));
ok("a mark at the very end closes cleanly",
  eq(sayParts("ol-*mah*"), [{ text:"ol-", stress:false }, { text:"mah", stress:true }]));
ok("a whole string can be one stressed run", eq(sayParts("*neh*"), [{ text:"neh", stress:true }]));
ok("no marks is a legal reading, just an unemphasised one",
  eq(sayParts("no marks here"), [{ text:"no marks here", stress:false }]));
ok("empty is nothing rather than a throw", eq(sayParts(""), []) && eq(sayParts(null), []));
/* A stray asterisk left behind by an edit must not swallow the line: everything after it
   is unmatched by MARK, so it comes back as ordinary text. */
ok("an unbalanced mark still renders its words, unstressed",
  eq(sayParts("*kahm-sah"), [{ text:"*kahm-sah", stress:false }]));
ok("saySpoken is the string you would read out",
  saySpoken("*kahm*-sah-*ham*-nee-da") === "kahm-sah-ham-nee-da");
ok("hasStress does not carry state between calls",
  hasStress("*a*-b") && hasStress("*a*-b") && !hasStress("plain"));

/* ---------- the search ---------- */
group("finding a row");

const bill = PHRASES.find(p => p.id === "bill");
ok("an empty query matches everything", matchesPhrase(bill, "", "Food"));
ok("the meaning matches", matchesPhrase(bill, "check", "Food"));
ok("the romanization matches", matchesPhrase(bill, "gyesan", "Food"));
ok("the say column matches once the marks are out", matchesPhrase(bill, "sahn-heh", "Food"));
ok("a synonym you would actually think of matches", matchesPhrase(bill, "bill", "Food"));
ok("so does another one", matchesPhrase(bill, "pay", "Food"));
ok("the group label matches", matchesPhrase(bill, "food", "Food"));
ok("tokens are ANDed, not ORed", !matchesPhrase(bill, "bill cheese", "Food"));
ok("and matching is case- and order-insensitive", matchesPhrase(bill, "PAY Check", "Food"));
ok("a word in no row finds nothing", countMatching("aardvark") === 0);
ok("'toilet' finds the bathroom row", countMatching("toilet") === 1);
ok("an empty query counts every row", countMatching("") === PHRASES.length);

const s = sections("bill");
ok("sections drops the tiers and groups a query empties",
  eq(s.map(x => [x.tier.id, x.groups.map(g => g.group.id)]), [["trip", ["food"]]]));
ok("and keeps say and hear rows apart",
  s[0].groups[0].say.length === 1 && s[0].groups[0].hear.length === 0);
ok("an unfiltered page has every group in it",
  sections("").flatMap(x => x.groups).length === GROUPS.length);

/* ---------- the price reader ---------- */
group("saying a price");

const rom = (n) => (wonReading(n) || {}).rom;
const say = (n) => (wonReading(n) || {}).say;

ok("a bare place value drops its leading one", rom(1000) === "cheon won" && rom(100) === "baek won");
ok("but a digit in front of one does not", rom(4000) === "sacheon won");
ok("the ones place is just the digit", rom(9) === "gu won");
/* The one that actually catches you out at a counter. */
ok("ten thousand is man, not ilman", rom(10000) === "man won");
ok("fifteen thousand regroups into 만, not into fifteen-thousand",
  rom(15000) === "man ocheon won", rom(15000));
ok("and so does a hundred and twenty thousand", rom(120000) === "sipiman won", rom(120000));
ok("a group above 만 keeps its own digits", rom(68000) === "yukman palcheon won", rom(68000));
ok("the doc's worked example still reads the same",
  rom(8900) === "palcheongubaek won", rom(8900));
ok("a million is a hundred man", rom(1000000) === "baekman won", rom(1000000));
/* 억 is the exception to the exception: 일억 keeps the one that 만 drops. */
ok("but 억 keeps its leading one", rom(100000000) === "ileok won", rom(100000000));

ok("the place values are the stressed ones", say(8900) === "pahl-*chun*-goo-*bek* wohn", say(8900));
ok("a group unit is stressed too", say(15000) === "*mahn* oh-*chun* wohn", say(15000));
ok("every reading parses back through sayParts",
  [1, 45, 4500, 8900, 15000, 68000, 120000].every(n => sayParts(say(n)).length > 0));

ok("zero is not a price", wonReading(0) === null);
ok("neither is a negative", wonReading(-5000) === null);
ok("nor a fraction", wonReading(1500.5) === null);
ok("nor a word", wonReading("abc") === null && wonReading("") === null);
ok("nor nothing at all", wonReading(null) === null && wonReading(undefined) === null);
ok("nor a number past what anyone would pay", wonReading(WON_MAX) === null);
/* A price typed with the separators it is printed with is still a price. */
ok("a typed-in string is cleaned up first",
  rom("8,900") === "palcheongubaek won" && rom(" 15000 ") === "man ocheon won");

/* ---------- the data agrees with itself ---------- */
group("the sheet");

ok("every phrase carries a stress mark",
  PHRASES.every(p => hasStress(p.say)),
  PHRASES.filter(p => !hasStress(p.say)).map(p => p.id).join(", "));
ok("every phrase names a group that exists",
  PHRASES.every(p => GROUPS.some(g => g.id === p.group)),
  PHRASES.filter(p => !GROUPS.some(g => g.id === p.group)).map(p => p.id).join(", "));
ok("every group names a tier that exists", GROUPS.every(g => TIERS.some(t => t.id === g.tier)));
ok("every id is unique", new Set(PHRASES.map(p => p.id)).size === PHRASES.length);
ok("the daily tier stays small enough to be learnable",
  sections("")[0].groups.flatMap(g => g.say).length <= 12);
ok("every preset reads back", PRICE_PRESETS.every(n => wonReading(n)));
/* The reader is assembled out of the same syllables the numbers table shows, so a typo
   fixed in one cannot leave the other saying the old thing. */
ok("the numbers table and the reader use the same syllables",
  NUMBERS.filter(x => x.n <= 10 || [100, 1000, 10000].includes(x.n))
    .every(x => (rom(x.n) || "").startsWith(x.n === 1 ? "il" : x.sino)),
  NUMBERS.map(x => `${x.n}=${x.sino}/${rom(x.n)}`).join(" "));

console.log(failures ? `\n${failures} failed\n` : "\nall good\n");
process.exit(failures ? 1 : 0);
