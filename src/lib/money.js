import { RATES } from "../data/rates.js";

/* Turning a price tag into money you can feel.

   The pure half, like lib/won.js next door — no DOM, no fetch, no clock. tools/
   imports this straight into node, and there is deliberately nothing here that reaches
   for a live rate: this page works with no signal at all, so a rate is data that ships
   and is editable, never something fetched at the till. See src/data/rates.js.

   The two jobs are opposite directions of the same arithmetic. `wonToHome` is the one
   you do standing in front of a menu; `homeToWon` is the one you do before you leave,
   working out what a 50-dollar dinner looks like in won. */

export const rateFor = (code) => RATES.find(r => r.code === code) || RATES[0];

/* A number off an input, commas, symbols and spaces and all. Anything that is not a
   plain positive number comes back null rather than a guess — the same rule wonReading()
   follows, and for the same reason: a converter that is confidently wrong is worse than
   one that says nothing, because you would pay it. */
export function parseAmount(v){
  const s = String(v == null ? "" : v).replace(/[\s,₩$€£¥]/g, "").replace(/[A-Za-z]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Won → your money. `won` is the rate: how many won one unit buys. */
export function wonToHome(amount, won){
  const n = parseAmount(amount);
  if (n == null || !(won > 0)) return null;
  return n / won;
}

/** And back the other way, rounded to whole won because nothing here is priced finer. */
export function homeToWon(amount, won){
  const n = parseAmount(amount);
  if (n == null || !(won > 0)) return null;
  return Math.round(n * won);
}

/* Two decimals while the number is small enough for them to mean something, none once
   it is not: "A$16.85" is a price and "A$1,124.00" is two characters of noise. */
export function fmtHome(v, code){
  if (v == null || !Number.isFinite(v)) return "";
  const r = rateFor(code);
  const dp = v < 1000 ? 2 : 0;
  return r.symbol + v.toLocaleString("en-US", { minimumFractionDigits:dp, maximumFractionDigits:dp });
}

export function fmtWon(v){
  if (v == null || !Number.isFinite(v)) return "";
  return "₩" + Math.round(v).toLocaleString("en-US");
}

/* The trick you actually use at a stall, where nobody is opening a converter: drop the
   three zeros off the tag and multiply by one number you have memorised. It is only
   worth printing when that number is a nice one to hold in your head, which is what the
   rounding here is deciding — at 890 won to the dollar it is "×1.1" and honest to about
   two percent; at 9.1 won to the yen the same sentence would be a lie, so it is not
   offered. Null means "no rule of thumb worth carrying", and the page says nothing. */
export function roughRule(won, code){
  if (!(won > 0)) return null;
  const per1000 = 1000 / won;
  if (per1000 < 0.2 || per1000 > 20) return null;
  const step = per1000 < 1 ? 0.05 : per1000 < 3 ? 0.1 : 0.5;
  const round = Math.round(per1000 / step) * step;
  const off = Math.abs(round - per1000) / per1000;
  if (off > 0.06) return null;
  const r = rateFor(code);
  return { per1000, round,
    text: `₩1,000 ≈ ${r.symbol}${round.toFixed(round < 1 ? 2 : 1)} — drop three zeros, then ×${round.toFixed(round < 1 ? 2 : 1)}` };
}
