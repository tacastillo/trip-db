import { save, saved } from "./store.js";
import { currentTab, night } from "./state.js";
import { setToolBtn } from "./toolbtn.js";
import { LEGS, PLACES } from "../data/places.js";
import { offlinePack } from "../lib/tiles.js";

/* Making the map survive a dead SIM.

   Everything the page is made of already ships in this repository, so the service
   worker in public/sw.js can keep the whole shell after one visit without being asked.
   Street tiles are the exception — they are CARTO's, fetched live, and there is no
   honest way to have them in a pocket in Jeju except to fetch them while you still
   have wifi and keep them. That is what this button does, one leg at a time, with the
   count said out loud first: it is somebody else's bandwidth and your storage. */

export const TILE_TEMPLATE = "https://a.basemaps.cartocdn.com/{style}/{z}/{x}/{y}.png";
export let swReady = null;               // the registration, once there is one
export let packing = false;

export function tileUrls(cityId, style){
  const places = PLACES.filter(p => p.city === cityId);
  return offlinePack(places).map(t => TILE_TEMPLATE
    .replace("{style}", style).replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y));
}

/** Only over http(s), and only where the browser has one: opening the built page off a
    file:// path has no origin to scope a worker to, and this is not the thing that
    should break that. */
export function registerSW(){
  if (!("serviceWorker" in navigator)) return null;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return null;
  const url = new URL("sw.js", document.baseURI).href;
  swReady = navigator.serviceWorker.register(url, { scope: new URL("./", document.baseURI).href })
    .catch(() => { swReady = null; return null; });
  return swReady;
}

export function offlineBtn(){ return document.getElementById("offlineToggle"); }

export function packState(cityId){
  return (saved.offline || {})[cityId] || null;
}

export function syncOfflineButton(){
  const b = offlineBtn();
  if (!b) return;
  if (packing) return;                  // mid-download the label is the progress
  const st = packState(currentTab);
  const leg = (LEGS.find(l => l.id === currentTab) || {}).label || currentTab;
  b.classList.toggle("on", !!st);
  setToolBtn(b, "⤓", st ? "Saved" : "Offline");
  b.title = st
    ? `${leg}'s tiles are already on this device (${st.tiles} of them, saved ${st.at.slice(0, 10)}). Tap to refresh them.`
    : `Download ${leg}'s map tiles so the map works with no signal`;
}

export async function savePack(){
  const b = offlineBtn();
  const reg = swReady && await swReady;
  if (!reg || !navigator.serviceWorker.controller){
    if (b){
      setToolBtn(b, "⤓", "no worker");
      b.title = "This browser is not running the offline worker, so tiles cannot be kept. Everything else still works.";
    }
    return;
  }
  if (packing) return;
  const style = night ? "dark_all" : "light_all";
  const urls = tileUrls(currentTab, style);
  packing = true;
  // the percentage takes the icon's place: the label beside it is hidden on the very
  // device most likely to be doing this, standing in a hotel lobby
  if (b) setToolBtn(b, "0%", "Saving");
  const ch = new MessageChannel();
  ch.port1.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === "cache-progress" && b) setToolBtn(b, `${Math.round(m.done / m.total * 100)}%`, "Saving");
    if (m.type === "cache-done"){
      packing = false;
      const offline = Object.assign({}, saved.offline);
      offline[currentTab] = { at: new Date().toISOString(), tiles: m.got + (m.total - m.got - m.failed), style };
      save({ offline });
      syncOfflineButton();
      if (m.failed && b) b.title += ` ${m.failed} tile${m.failed > 1 ? "s" : ""} would not download; the rest are here.`;
    }
  };
  navigator.serviceWorker.controller.postMessage({ type:"cache-tiles", urls }, [ch.port2]);
}

/** How big the ask is, for the label on the button's own tooltip and for tests. */
export function packSize(cityId){
  return tileUrls(cityId, "dark_all").length;
}
