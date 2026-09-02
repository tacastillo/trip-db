import { save, saved } from "./store.js";
import { esc } from "../lib/design.js";
import { icon } from "../lib/icons.js";
import { placeLinks } from "../lib/plan-core.js";

/* Which map app the hand-off opens, and the one button that opens it.

   There used to be two buttons side by side, a filled Naver and a quiet Kakao, on every
   hop row and both cards. A fortnight of the trip settled what that was worth: the
   second one was never once tapped, and it cost 44px of a 390px card every time. But
   deleting it is the wrong fix — Kakao is what half of Korea navigates with, and the
   day you want it is the day Naver has nothing for the place you are standing outside.

   So it is one control with a choice behind it: the button opens the app that is on,
   the caret beside it changes which, and the change is remembered like night mode. The
   default is Naver because that is the link this repository builds and pins.

   Nothing here re-renders anything. Both links are already on the element, in
   data-naver and data-kakao, so switching apps rewrites hrefs in place — the same
   reason geo-me.js fills its distances in place rather than redrawing the list under a
   thumb. An open card, a hop row and the walk home all change together and none of
   them flickers. */

export const MAP_APPS = [
  { id:"naver", label:"Naver", full:"Naver Maps", note:"what this map's links are built against" },
  { id:"kakao", label:"Kakao", full:"Kakao Map", note:"what half of Korea navigates with" },
];
const appById = (id) => MAP_APPS.find(a => a.id === id) || MAP_APPS[0];
export let mapApp = MAP_APPS.some(a => a.id === saved.mapApp) ? saved.mapApp : MAP_APPS[0].id;

export function setMapApp(id){
  if (!MAP_APPS.some(a => a.id === id) || id === mapApp) return;
  mapApp = id;
  save({ mapApp });
  syncGoBtns();
}

/** The one control on this page that hands you to something that actually navigates,
    so it is filled, accent-coloured and a 44px target on a phone. Every hop, both ends
    of the day and the card go through this, which is what keeps it the same thing
    wherever it lands. It takes the place rather than a link: there is no origin any
    more, and a button that means "open this" needs nothing but what to open. */
export function goBtnHtml(p){
  const links = placeLinks(p);
  const app = appById(mapApp);
  return `<span class="phop-go" data-naver="${esc(links.naver)}" data-kakao="${esc(links.kakao)}" data-to="${esc(p.name)}">
    <a class="phop-a" href="${esc(links[app.id])}" target="_blank" rel="noopener noreferrer"
      aria-label="Open ${esc(p.name)} in ${app.full}">${app.label} ${icon("out", "phop-a-x")}</a>
    <button class="phop-pick" type="button" aria-haspopup="true" aria-expanded="false"
      aria-label="Open places in a different map app">${icon("chevron", "phop-pick-i")}</button>
    <span class="go-menu" role="menu">${MAP_APPS.map(a => `
      <button class="go-opt${a.id === mapApp ? " on" : ""}" type="button" role="menuitemradio"
        aria-checked="${a.id === mapApp}" data-app="${a.id}">
        <span class="go-opt-t"><b>${a.full}</b><em>${a.note}</em></span>
        <span class="go-opt-k">${icon("check")}</span>
      </button>`).join("")}</span>
  </span>`;
}

/** Repoint every button on the page at the app that is now on. */
export function syncGoBtns(){
  const app = appById(mapApp);
  document.querySelectorAll(".phop-go").forEach(g => {
    const a = g.querySelector(".phop-a");
    if (a){
      a.href = g.dataset[app.id] || a.href;
      a.innerHTML = `${app.label} ${icon("out", "phop-a-x")}`;
      a.setAttribute("aria-label", `Open ${g.dataset.to || "this place"} in ${app.full}`);
    }
    g.querySelectorAll(".go-opt").forEach(o => {
      const on = o.dataset.app === mapApp;
      o.classList.toggle("on", on);
      o.setAttribute("aria-checked", String(on));
    });
  });
}

function closeGo(except){
  document.querySelectorAll(".phop-go.open").forEach(g => {
    if (g === except) return;
    g.classList.remove("open");
    const b = g.querySelector(".phop-pick");
    if (b) b.setAttribute("aria-expanded", "false");
  });
}

/** Boot code, so it is called from main.js rather than run on import. One listener on
    the document, because these buttons are rebuilt on every render and a listener per
    button would be re-bound every time the pane redraws. */
export function initGoBtns(){
  document.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null;
    const opt = t && t.closest(".go-opt");
    if (opt){ e.preventDefault(); closeGo(); setMapApp(opt.dataset.app); return; }
    const pick = t && t.closest(".phop-pick");
    if (!pick){ closeGo(); return; }
    e.preventDefault();
    const g = pick.closest(".phop-go");
    const open = !g.classList.contains("open");
    closeGo(g);
    g.classList.toggle("open", open);
    pick.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGo(); });
}
