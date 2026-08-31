import { CURRENCY, WON_PER_USD } from "../data/rates.js";

/* Turning a price tag into money you can feel.

   The pure half, like lib/won.js next door — no DOM, no fetch, no clock. tools/ imports
   this straight into node, and there is deliberately nothing here that reaches for a live
   rate: this page works with no signal at all, so a rate is data that ships and is
   editable, never something fetched at the till. See src/data/rates.js.

   The two jobs are opposite directions of the same arithmetic. `wonToUsd` is the one you
   do standing in front of a menu; `usdToWon` is the one you do before you leave, working
   out what a fifty-dollar dinner looks like in won. */

/* A number off an input, commas, symbols and spaces and all. Anything that is not a
   plain positive number comes back null rather than a guess — the same rule wonReading()
   follows, and for the same reason: a converter that is confidently wrong is worse than
   one that says nothing, because you would pay it. */
export function parseAmount(v){
  const s = String(v == null ? "" : v).replace(/[\s,₩$]/g, "");
  if (!s || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Won → dollars. `won` is the rate: how many won one dollar buys. */
export function wonToUsd(amount, won){
  const n = parseAmount(amount);
  if (n == null || !(won > 0)) return null;
  return n / won;
}

/** And back the other way, rounded to whole won because nothing here is priced finer. */
export function usdToWon(amount, won){
  const n = parseAmount(amount);
  if (n == null || !(won > 0)) return null;
  return Math.round(n * won);
}

/* Cents while the number is small enough for them to mean something, none once it is
   not: "$16.85" is a price and "$1,124.00" is two characters of noise. */
export function fmtUsd(v){
  if (v == null || !Number.isFinite(v)) return "";
  const dp = v < 1000 ? 2 : 0;
  return CURRENCY.symbol + v.toLocaleString("en-US", { minimumFractionDigits:dp, maximumFractionDigits:dp });
}

export function fmtWon(v){
  if (v == null || !Number.isFinite(v)) return "";
  return "₩" + Math.round(v).toLocaleString("en-US");
}

/* The trick you actually use at a stall, where nobody is opening a converter.

   It is per ten thousand rather than per thousand because that is how Korea counts —
   prices are read in 만, a 만 is what the price reader next door regroups into, and at
   1,350 won to the dollar a per-thousand rule would be "×0.74", which is not a number
   anyone multiplies in their head in a queue.

   Only offered when the rounding stays honest to within a few percent: a memorable
   number that is wrong by a tenth is worse than doing the division. Null means "no rule
   of thumb worth carrying", and the page says nothing rather than something catchy. */
export const RULE_DRIFT_MAX = 0.04;
export function roughRule(won){
  if (!(won > 0)) return null;
  const per = 10000 / won;
  if (per < 0.5 || per > 200) return null;
  const step = per < 2 ? 0.1 : per < 20 ? 0.5 : 5;
  const round = Math.round(per / step) * step;
  if (!round || Math.abs(round - per) / per > RULE_DRIFT_MAX) return null;
  /* One number, said once: the multiplier in the sentence and the amount in front of it
     have to be the same thing, or the rule reads as two different rules. */
  const said = String(Number(round.toFixed(2)));
  return { per, round,
    text: `₩10,000 ≈ ${fmtUsd(round)} — knock off four zeros, then ×${said}` };
}

export { WON_PER_USD };
