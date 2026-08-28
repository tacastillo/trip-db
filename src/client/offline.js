import { save, saved } from "./store.js";
import { currentTab } from "./state.js";
import { setToolBtn } from "./toolbtn.js";
import { LEGS, PLACES } from "../data/places.js";
import { TILE_KB, offlinePack, tileUrl } from "../lib/tiles.js";
import { tileStyle } from "./basemap.js";

/* Making the map survive a dead SIM.

   Everything the page is made of already ships in this repository, so the service
   worker in public/sw.js can keep the whole shell after one visit without being asked.
   Street tiles are the exception — they are CARTO's, fetched live, and there is no
   honest way to have them in a pocket in Jeju except to fetch them while you still
   have wifi and keep them. That is what this button does, one leg at a time, with the
   count said out loud first: it is somebody else's bandwidth and your storage. */

export let swReady = null;               // the registration, once there is one
export let packing = false;

/** Exactly what the live layer will ask for, because both come out of tileUrl(). */
export function tileUrls(cityId, style){
  const places = PLACES.filter(p => p.city === cityId);
  return offlinePack(places).map(t => tileUrl(style || tileStyle(), t));
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
  /* A pack is only any use for the base it was downloaded in — the worker caches by URL
     and the style is a segment of it. Saying "Saved" for a pack that can never be hit is
     worse than saying nothing, because the thing it is wrong about is standing in Jeju
     with no signal. */
  const usable = !!st && st.style === tileStyle();
  b.classList.toggle("on", usable);
  setToolBtn(b, "offline", usable ? "Saved" : st ? "Re-save" : "Offline");
  b.title = usable
    ? `${leg}'s tiles are already on this device (${st.tiles} of them, saved ${st.at.slice(0, 10)}). Tap to refresh them.`
    : st
      ? `${leg}'s saved tiles are for a different map style, so they cannot be used. Tap to download this one (about ${packMb(currentTab)} MB).`
      : `Download ${leg}'s map tiles so the map works with no signal (about ${packMb(currentTab)} MB)`;
}

export async function savePack(){
  const b = offlineBtn();
  const reg = swReady && await swReady;
  if (!reg || !navigator.serviceWorker.controller){
    if (b){
      setToolBtn(b, "offline", "no worker");
      b.title = "This browser is not running the offline worker, so tiles cannot be kept. Everything else still works.";
    }
    return;
  }
  if (packing) return;
  const style = tileStyle();
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
  return tileUrls(cityId, tileStyle()).length;
}

/** Roughly what a leg weighs, for the tooltip. The number is a courtesy, not a promise. */
export function packMb(cityId){
  const style = tileStyle();
  return Math.round(packSize(cityId) * (TILE_KB[style] || 40) / 1024);
}
