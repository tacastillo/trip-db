/* Opening hours, and whether a place is open right now.

   This file exists because the trip's source database grew a real `Hours (24h)` column.
   That is the whole justification: the grammar below is *structured at source*, not prose
   scraped out of a note. The standing rule next door in plan-core.js still holds — `meta`
   is a sentence someone typed and must never be parsed into a schedule — and nothing here
   reads it. Two different things that must not be confused.

   Nothing is scheduled. There are still no arrival times, no dwell times and no durations
   anywhere on this map; all this can say is when a door is open and when it is not. */

export const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_RE = "mon|tue|wed|thu|fri|sat|sun";
const SPAN_RE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

export const MINS_PER_DAY = 1440;

/** "26:00" -> 1560. Closing times run past midnight; opening times never do. */
function toMin(h, m){ return (+h) * 60 + (+m); }

/** 1560 -> "02:00". Wraps, because that is the time a person reads off a clock. */
export function fmtMin(min){
  const t = ((min % MINS_PER_DAY) + MINS_PER_DAY) % MINS_PER_DAY;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* "Mon-Wed" is a range and wraps the week, so "Sun-Wed" is four days; "Sat,Sun" is a
   list. Same two shapes closedDays() reads out of meta, which is not a coincidence —
   both were written by the same hand into the same database. */
function dayList(str){
  const names = String(str).toLowerCase().match(new RegExp(DAY_RE, "g")) || [];
  if (!names.length) return null;
  if (!/[-–—]/.test(str) || names.length !== 2) return names;
  const a = DOW.indexOf(names[0]), b = DOW.indexOf(names[1]);
  if (a < 0 || b < 0) return names;
  const out = [];
  for (let i = a; ; i = (i + 1) % 7){ out.push(DOW[i]); if (i === b || out.length > 7) break; }
  return out;
}

function spans(str){
  const out = [];
  for (const part of String(str).split(",")){
    const m = SPAN_RE.exec(part.trim());
    if (!m) return null;
    const from = toMin(m[1], m[2]), to = toMin(m[3], m[4]);
    if (from >= MINS_PER_DAY || to <= from) return null;   // opens past midnight, or closes before it opens
    out.push([from, to]);
  }
  return out.length ? out : null;
}

/* Every form that actually occurs in the source column:

     24h
     Daily 09:00-22:00
     Daily 10:00-14:50,17:00-21:30              a lunch break
     Daily 09:30-18:30; closed Tue
     Daily 10:00-18:30; LO 18:00                last order, carried but not enforced
     Mon-Thu 10:30-20:00; Fri-Sun 10:30-20:30
     Tue-Thu 11:00-17:00; Fri 10:30-17:00; Sat,Sun 11:00-17:00; closed Mon
     Sun-Wed 19:00-26:00; Thu-Sat 19:00-28:00   26:00 is 02:00 the next morning

   Anything else returns null and the caller shows the string verbatim. That is the point:
   an hours line nobody can parse is still an hours line a person can read, and guessing at
   one would be worse than printing it. */
export function parseHours(str){
  const src = String(str || "").trim();
  if (!src) return null;

  const perDay = {};
  for (const d of DOW) perDay[d] = [];
  const closed = [];
  let lastOrder = null, sawSchedule = false;

  for (const raw of src.split(";")){
    const seg = raw.trim();
    if (!seg) continue;

    let m;
    if ((m = /^closed\s+(.+)$/i.exec(seg))){
      const days = dayList(m[1]);
      if (!days) return null;
      for (const d of days) if (closed.indexOf(d) < 0) closed.push(d);
      continue;
    }
    if ((m = /^LO\s+(\d{1,2}):(\d{2})$/i.exec(seg))){
      lastOrder = toMin(m[1], m[2]);
      continue;
    }
    if (/^24h$/i.test(seg)){
      for (const d of DOW) perDay[d] = [[0, MINS_PER_DAY]];
      sawSchedule = true;
      continue;
    }
    if ((m = new RegExp(`^(daily|(?:${DAY_RE})(?:\\s*[-–—,]\\s*(?:${DAY_RE}))*)\\s+(.+)$`, "i").exec(seg))){
      const days = /^daily$/i.test(m[1]) ? DOW.slice() : dayList(m[1]);
      const times = spans(m[2]);
      if (!days || !times) return null;
      for (const d of days) perDay[d] = times;
      sawSchedule = true;
      continue;
    }
    return null;
  }

  if (!sawSchedule && !closed.length) return null;
  /* A closing day beats an opening time: "Daily 09:30-18:30; closed Tue" sets all seven
     days and then takes Tuesday back out. */
  for (const d of closed) perDay[d] = [];
  return { perDay, closed, lastOrder };
}

/** The place's closing days, however they happen to be known. */
export function closedFromHours(hours){
  const h = parseHours(hours);
  if (!h) return null;
  const shut = DOW.filter(d => !h.perDay[d].length);
  return shut.length === 7 ? null : shut;   // seven means we parsed nothing useful
}

/* `clock` is {dow, minutes} and is always passed in — this file never reads a clock, which
   is what lets tools/test-hours.mjs drive it at 01:30 on a Tuesday without a browser. */
export function openState(place, clock){
  const h = place && parseHours(place.hours);
  if (!h || !clock || DOW.indexOf(clock.dow) < 0) return { state: "unknown" };
  const today = DOW.indexOf(clock.dow), now = clock.minutes;

  /* Yesterday first. A bar that shuts at 26:00 on Monday is still open at 01:30 on
     Tuesday, and Tuesday's own table says nothing about it. */
  for (const back of [1, 0]){
    const d = DOW[(today - back + 7) % 7], shift = back * MINS_PER_DAY;
    for (const [from, to] of h.perDay[d]){
      if (now + shift >= from && now + shift < to)
        return { state: "open", until: to - shift, lastOrder: h.lastOrder };
    }
  }

  for (let ahead = 0; ahead < 8; ahead++){
    const d = DOW[(today + ahead) % 7];
    for (const [from] of h.perDay[d]){
      if (ahead > 0 || from > now)
        return { state: "closed", opensAt: from, opensDow: d, opensAhead: ahead };
    }
  }
  return { state: "closed" };   // never open, on any day
}
