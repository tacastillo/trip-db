import { GROUPS, PHRASES, TIERS } from "../data/phrases.js";

/* The pure half of the cheat sheet: how a `say` string is read, how the search matches,
   and what order the page is in. No DOM here — tools/test-phrases.mjs imports this
   straight into node. */

/* ---------------- stress ---------------- */

/* The starting draft of this sheet shouted the stressed syllable in CAPITALS, which is
   how a phrasebook has always done it and is the wrong tool on a screen: capitals change
   the letterforms, so you read the word twice — once to decode it and once to find the
   emphasis. Colour does not touch the letters at all. The mark stays in the data because
   the data has to be editable in a text file; the paint happens here. */
const MARK = /\*([^*]+)\*/g;

/**
 * Split a `say` string into runs, flagging the stressed ones.
 * @param {string} say e.g. "*kahm*-sah-*ham*-nee-da"
 * @returns {{text:string, stress:boolean}[]}
 */
export function sayParts(say){
  const s = String(say || "");
  const out = [];
  let at = 0;
  for (const m of s.matchAll(MARK)){
    if (m.index > at) out.push({ text: s.slice(at, m.index), stress: false });
    out.push({ text: m[1], stress: true });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ text: s.slice(at), stress: false });
  /* An unmarked string is a legal reading, just an unemphasised one. check-data.mjs is
     what insists every row in the data carries a mark; a lone stray asterisk left in an
     edit should still render the words rather than swallow the rest of the line. */
  return out.filter(p => p.text);
}

/** The same string with the marks taken out — what search matches and what copies out. */
export const saySpoken = (say) => String(say || "").replace(/\*/g, "");

/** Whether a `say` string carries any emphasis at all. Its own pattern rather than
    MARK, which is global and would carry lastIndex between calls. */
export const hasStress = (say) => /\*[^*]+\*/.test(String(say || ""));

/* ---------------- search ---------------- */

/* The same shape as matchesQuery() in plan-core.js — AND over whitespace tokens,
   case-insensitive, substring rather than prefix — so the two search boxes on this site
   behave identically and neither has to be learned.
   What is different is `alt`. The word you reach for is almost never the word in the
   Meaning column: you think "bill", the sheet says "Check, please"; you think "toilet",
   the sheet says "bathroom". Those synonyms are never rendered — they exist so that
   typing the first thing in your head finds the row. */
export function matchesPhrase(p, q, groupLabel){
  const s = String(q || "").trim().toLowerCase();
  if (!s) return true;
  const hay = [p.en, p.rom, saySpoken(p.say), (p.alt || []).join(" "), groupLabel]
    .filter(Boolean).join(" ").toLowerCase();
  return s.split(/\s+/).every(t => hay.indexOf(t) >= 0);
}

/* ---------------- the order of the page ---------------- */

export const groupById = (id) => GROUPS.find(g => g.id === id);
export const tierById = (id) => TIERS.find(t => t.id === id);

/* The default page a tier belongs to, so a tier written before there were two tools
   still lands somewhere rather than nowhere. */
export const PAGE_DEFAULT = "phrases";
export const tierPage = (t) => (t && t.page) || PAGE_DEFAULT;
/* A word is not a phrase. Its group says so, rather than every row repeating it. */
export const isWordGroup = (g) => !!g && g.kind === "word";
export const isWord = (p) => isWordGroup(groupById(p.group));

/** Which tiers a page is made of, in order. */
export const tiersFor = (page) => TIERS.filter(t => tierPage(t) === (page || PAGE_DEFAULT));

/**
 * The page, as sections, filtered by a query. Groups and tiers with nothing left in them
 * are dropped, which is what empties the jump bar in step with the list.
 *
 * Three buckets rather than two, because a word grid, a phrase row and a thing you only
 * have to recognise are three different shapes on screen — see styles/phrases.css.
 * @param {string} [q] the search box
 * @param {string} [page] which tool is asking; the cheat sheet by default
 */
export function sections(q, page){
  return tiersFor(page).map(tier => ({
    tier,
    groups: GROUPS.filter(g => g.tier === tier.id).map(group => {
      const mine = PHRASES.filter(p => p.group === group.id && matchesPhrase(p, q, group.label));
      return isWordGroup(group)
        ? { group, words: mine, say: [], hear: [] }
        : { group, words: [], say: mine.filter(p => !p.hear), hear: mine.filter(p => p.hear) };
    }).filter(s => s.say.length || s.hear.length || s.words.length),
  })).filter(s => s.groups.length);
}

/** Every row a page holds, query or no query — what the "3 of 59" counter counts. */
export function pageRows(page, q){
  const ids = new Set(tiersFor(page).map(t => t.id));
  return PHRASES.filter(p => {
    const g = groupById(p.group);
    if (!g || !ids.has(g.tier)) return false;
    return matchesPhrase(p, q, g.label);
  });
}

/** How many rows a query leaves, for the "3 of 59" the search box reports. */
export const countMatching = (q, page) => pageRows(page, q).length;
