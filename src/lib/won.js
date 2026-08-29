import { NUMBERS } from "../data/phrases.js";

/* Reading a price out loud.

   This exists because the hard part of Korean money is not the vocabulary, it is the
   regrouping. English counts in thousands and Korean counts in 만 — ten-thousands — so
   15,000 is not "fifteen thousand" but "one man, five cheon", and the arithmetic happens
   somewhere behind your eyes while a queue forms behind you. A table of ten numbers does
   not help with that; a thing you type 15000 into does.

   It is computed rather than listed for the same reason the rides are traced rather than
   stored: a table of prices is a table of the prices somebody thought of, and the one on
   the tag will not be in it.

   What it deliberately does NOT do is smooth the sound changes. 육만 is really said
   closer to "yungman" than "yukman", and encoding that would mean encoding Korean
   assimilation rules from memory with nothing here able to check them — the same trap as
   an unverifiable app scheme. So the syllables are concatenated mechanically, which is
   always understood and never confidently wrong. */

const syl = (n) => NUMBERS.find(x => x.n === n);
/* the digits, and the three place values a four-digit group is built from */
const ONES = Array.from({ length: 9 }, (_, i) => syl(i + 1));
const PLACES = [
  { at:1000, ...syl(1000) },
  { at:100,  ...syl(100)  },
  { at:10,   ...syl(10)   },
];
/* and the group units above that. 억 and 조 are not in the data table because no price
   on this trip is written in them; they are here so a stray digit degrades to a reading
   rather than to null. */
const GROUPS = [
  { rom:"",    say:"" },
  { rom:"man", say:"mahn" },
  { rom:"eok", say:"eok" },
  { rom:"jo",  say:"jo" },
];

export const WON_MAX = 1e16;   // four groups of four digits

/* A place value is stressed and the digit in front of it is not, which is what makes
   "pahl-CHUN-goo-BEK" scan. lib/phrases.js turns the marks into spans. */
const mark = (s) => `*${s}*`;

/** One group of at most four digits, e.g. 8900 -> "palcheon gubaek". */
function readGroup(v){
  const rom = [], say = [];
  let rest = v;
  for (const p of PLACES){
    const d = Math.floor(rest / p.at);
    rest %= p.at;
    if (!d) continue;
    /* Korean says 천, not 일천: the leading one is dropped at every place value but
       never on the group units, where 일억 keeps it. */
    rom.push(d === 1 ? p.sino : ONES[d - 1].sino + p.sino);
    say.push(d === 1 ? mark(p.sinoSay) : `${ONES[d - 1].sinoSay}-${mark(p.sinoSay)}`);
  }
  if (rest){ rom.push(ONES[rest - 1].sino); say.push(ONES[rest - 1].sinoSay); }
  /* No separator inside a group: 사천오백 is one word, so "sacheonobaek" is what you
     type into Papago. The `say` column is where it is made readable — that is its job,
     and splitting the difference in both would leave "sip iman" for 십이만. */
  return { rom: rom.join(""), say: say.join("-") };
}

/**
 * How a won amount is said.
 * @param {number|string} amount a whole number of won
 * @returns {{rom:string, say:string}|null} null for anything that is not a price
 */
export function wonReading(amount){
  /* A string comes straight off an input, commas and all. Anything that is not a plain
     whole number returns null rather than a guess: a price reader that is confidently
     wrong is worse than one that says nothing, because you would read it out. */
  const n = typeof amount === "string" ? Number(amount.replace(/[\s,]/g, "")) : amount;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n >= WON_MAX) return null;

  const rom = [], say = [];
  for (let i = GROUPS.length - 1; i >= 0; i--){
    const v = Math.floor(n / 10 ** (4 * i)) % 10000;
    if (!v) continue;
    const g = GROUPS[i], part = readGroup(v);
    /* 만 alone is 만, not 일만 — the one place the leading one goes on a group unit too.
       억 and 조 keep theirs, which is why this is a test and not a blanket rule. */
    const bare = v === 1 && i === 1;
    rom.push(bare ? g.rom : part.rom + g.rom);
    say.push(bare ? mark(g.say) : part.say + (g.say ? `-${mark(g.say)}` : ""));
  }
  return { rom: `${rom.join(" ")} won`, say: `${say.join(" ")} wohn` };
}
