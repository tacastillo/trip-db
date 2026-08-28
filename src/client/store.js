/* What the page remembers between visits.

   A day plan lives in the query string and that stays true: the URL is still the only
   thing that can be shared, and when a link names stops it wins outright. This is the
   other half of that — what a reload used to throw away for no good reason. Night mode,
   the category chips, which side tab you were on, what you have already been to, and
   the day you were building when you closed the tab.

   localStorage throws rather than returns null in a locked-down Safari, and quota
   errors happen, so every touch is wrapped: losing what was remembered is a shame, not
   a reason for the page to stop. `storeOk` says which world we are in and the plan pane
   says so out loud rather than silently forgetting. */

export const STORE_KEY = "trip-db/v1";

export let storeOk = true;
export let saved = read();

function read(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e){
    storeOk = false;
    return {};
  }
}

/* Debounced for the same reason syncPlanUrl is: dragging a stop or typing a title
   would otherwise write on every frame. */
let writeTimer = null;
export function save(patch){
  Object.assign(saved, patch);
  if (!storeOk) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); }
    catch (e){ storeOk = false; }
  }, 250);
}

export function forget(){
  saved = {};
  try { localStorage.removeItem(STORE_KEY); } catch (e){ storeOk = false; }
}
