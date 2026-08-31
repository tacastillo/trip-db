#!/usr/bin/env node
/* Exercise the cheat sheet's pure core.

     node tools/test-phrases.mjs

   No network, no arguments, no browser. Two things are worth pinning here and neither is
   visible to check-data.mjs: that a `say` string still reads correctly once the stress
   marks are taken back out of it, and that the price reader regroups into 만 the way
   Korean does rather than the way English wants to. The second is the whole reason the
   reader exists, so it is the half with the most cases. */

import { countMatching, hasStress, isWord, matchesPhrase, saySpoken, sayParts, sections, tiersFor } from "../src/lib/phrases.js";
import { WON_MAX, wonReading } from "../src/lib/won.js";
import { RULE_DRIFT_MAX, fmtUsd, fmtWon, parseAmount, roughRule, usdToWon, wonToUsd } from "../src/lib/money.js";
import { GROUPS, NUMBERS, PHRASES, PRICE_PRESETS, TIERS } from "../src/data/phrases.js";
import { CURRENCY, WON_PER_USD } from "../src/data/rates.js";
import { TOOLS } from "../src/data/tools.js";

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
/* The counter counts what the page it is on can show, which is not every row any more:
   the money tier is a different tool with a different page behind it. */
ok("an empty query counts every row the two pages hold between them",
  countMatching("", "phrases") + countMatching("", "money") === PHRASES.length);
ok("and the cheat sheet does not count the money page's rows",
  countMatching("", "phrases") < PHRASES.length);

const s = sections("bill");
ok("sections drops the tiers and groups a query empties",
  eq(s.map(x => [x.tier.id, x.groups.map(g => g.group.id)]), [["trip", ["food"]]]));
ok("and keeps say and hear rows apart",
  s[0].groups[0].say.length === 1 && s[0].groups[0].hear.length === 0);
ok("an unfiltered page has every group its own tiers hold",
  sections("").flatMap(x => x.groups).length
    + sections("", "money").flatMap(x => x.groups).length === GROUPS.length);

/* ---------- the two tools ---------- */
group("which page a row is on");

ok("every tier names a tool that exists", TIERS.every(t => TOOLS.some(x => x.id === (t.page || "phrases"))));
ok("both tools have tiers behind them", TOOLS.every(t => tiersFor(t.id).length > 0));
ok("money is not on the cheat sheet", !sections("").some(x => x.groups.some(g => g.group.id === "money")));
ok("and the cheat sheet is not on the money page",
  !sections("", "money").some(x => x.groups.some(g => g.group.id === "basics")));
/* The words grid is the reason "hot", "cold" and "iced" are findable at all; it is a
   third shape on the page and must not fall into the phrase buckets. */
const daily = sections("")[0].groups.find(g => g.group.id === "words");
ok("the word grid comes back as words, not as rows", !!daily && daily.words.length > 10
  && !daily.say.length && !daily.hear.length);
ok("and a word knows it is one", isWord(PHRASES.find(p => p.id === "w-iced")));
for (const w of ["hot", "cold", "iced", "ice", "water"])
  ok(`"${w}" finds something`, countMatching(w, "phrases") > 0);

/* ---------- the money ---------- */
group("won, in dollars");

const R = WON_PER_USD;
ok("the shipped rate is a positive number", R > 0 && Number.isFinite(R));
ok("there is one currency and it is the dollar", CURRENCY.code === "USD" && CURRENCY.symbol === "$");
ok("won to dollars is the division", Math.abs(wonToUsd(8900, R) - 8900 / R) < 1e-9);
ok("dollars to won is the multiplication, in whole won", usdToWon(20, R) === Math.round(20 * R));
ok("a typed string is cleaned up first", wonToUsd("₩15,000", R) === wonToUsd(15000, R));
ok("so is one with the dollar sign stuck on it", usdToWon("$ 12.50", R) === usdToWon(12.5, R));
/* The same rule lib/won.js follows: nothing beats a confident wrong number, because this
   one gets paid. */
for (const bad of ["", " ", "abc", "12abc", "-5", "0", null, undefined])
  ok(`${JSON.stringify(bad)} converts to nothing rather than a guess`,
    wonToUsd(bad, R) === null && usdToWon(bad, R) === null);
ok("a rate of nothing converts to nothing", wonToUsd(1000, 0) === null);
ok("a small amount keeps its cents", fmtUsd(16.853) === "$16.85");
ok("a large one drops them", fmtUsd(1124.4) === "$1,124");
ok("won is formatted the way a price tag is", fmtWon(68000) === "₩68,000");
ok("and rounds rather than showing a fraction of a won", fmtWon(17800.4) === "₩17,800");
/* The rule of thumb counts in 만, because Korea does — a per-thousand rule at 1,350 won
   to the dollar would be "x0.74", which nobody multiplies in a queue. */
const rule = roughRule(R);
ok("the shipped rate gets a rule of thumb", !!rule);
ok("and it is honest to within a few percent",
  Math.abs(rule.round - 10000 / R) / (10000 / R) <= RULE_DRIFT_MAX);
ok("it is stated per ten thousand", rule.text.startsWith("₩10,000"));
ok("the multiplier and the amount in front of it are the same number",
  rule.text.includes(fmtUsd(rule.round)) && rule.text.endsWith("×" + Number(rule.round.toFixed(2))));
/* Where rounding to something memorable would drift too far, there is no rule rather
   than a catchy one that is wrong by a tenth. */
ok("a rate no rounding can make memorable gets none", roughRule(10000 / 22) === null);
ok("and neither does a rate off any scale a traveller sees", roughRule(5) === null);
ok("a nonsense rate gets none either", roughRule(0) === null && roughRule(-2) === null);

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
