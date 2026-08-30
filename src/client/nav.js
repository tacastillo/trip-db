import { LEGS } from "../data/places.js";
import { TOOLS } from "../data/tools.js";
import { icon } from "../lib/icons.js";
import { currentTab } from "./state.js";

/* The one way around this site: which leg the map is on, and which tool you are in.

   It used to be a row of leg tabs with the cheat sheet stuck on the end as a fourth
   pill, which was wrong twice over. The sheet is not a place you go to, and four things
   do not fit a row that has space for two and a half — fitting them cost the three legs
   thirty pixels of their dates at 390px. One trigger, one menu, two headings.

   Imported by BOTH pages, so it may import neither map.js nor tabs.js. Picking a city is
   handed in the way palette.js is handed its redraw (setPaletteHandler in main.js): the
   map page passes setTab and switches leg in place, and the cheat sheet, which has no map
   to switch, has no handler and navigates instead. That is also what keeps tabs.js ->
   nav.js a one-way import with no cycle. */

/* astro.config's base, stated on <html> by Shell.astro: nothing in a bundled module can
   read import.meta.env.BASE_URL at runtime, and every link here has to carry it. */
const base = document.documentElement.dataset.base || "./";

/* Which tool this page is, if it is one. The trigger says where you are, and on the
   cheat sheet "Seoul" would be a lie. */
const here = TOOLS.find(t => location.pathname.endsWith(t.page)) || null;

let menu = null, trigger = null, onCity = null;

/** The map page hands in setTab; without one, a city is a link. */
export function setNavHandler(fn){ onCity = fn; }

const legById = (id) => LEGS.find(l => l.id === id);

/* ---------------- the trigger ---------------- */

/** Relabel the trigger. Called by setTab, so the header cannot disagree with the map. */
export function syncNav(){
  if (!trigger) return;
  const l = here ? null : legById(currentTab);
  trigger.querySelector(".nv-l").textContent = here ? here.label : (l ? l.label : "Korea");
  trigger.querySelector(".nv-d").textContent = here ? here.note : (l ? l.dates : "");
  if (menu) syncMenu();
}

/* ---------------- the menu ---------------- */

function menuHtml(){
  const cities = LEGS.map(l => `
    <button class="nv-row" data-city="${l.id}" role="option" aria-selected="false">
      <span class="nv-txt"><b>${l.label}</b><em>${l.dates}</em></span>
      <span class="nv-tick">${icon("check")}</span>
    </button>`).join("");
  const tools = TOOLS.map(t => `
    <a class="nv-row" href="${base}${t.page}" data-tool="${t.id}" role="option" aria-selected="false">
      <span class="nv-ic">${icon(t.icon)}</span>
      <span class="nv-txt"><b>${t.label}</b><em>${t.note}</em></span>
      <span class="nv-tick">${icon("check")}</span>
    </a>`).join("");
  /* The map is a tool row too when you are not on it — it is where the cities live, so
     the cheat sheet needs a way back that is not the browser's own button. */
  const toMap = here ? `
    <a class="nv-row" href="${base}" data-tool="map">
      <span class="nv-ic">${icon("map")}</span>
      <span class="nv-txt"><b>The map</b><em>where everything is</em></span>
      <span class="nv-tick">${icon("check")}</span>
    </a>` : "";
  return `<div class="nv-sec">Cities</div>
    <div class="nv-list" role="listbox" aria-label="Cities">${cities}</div>
    <div class="nv-sec">Tools</div>
    <div class="nv-list" role="listbox" aria-label="Tools">${toMap}${tools}</div>`;
}

export function openNav(){
  if (menu) return closeNav();
  menu = document.createElement("div");
  menu.className = "nv-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Go to");
  menu.innerHTML = menuHtml();
  document.body.appendChild(menu);
  menu.querySelectorAll("[data-city]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.city;
    closeNav();
    /* In place where there is a map to move; a link where there is not. `city` is the
       plan grammar's own parameter, and plan-boot honours it over the store. */
    if (onCity) onCity(id);
    else location.href = `${base}index.html?city=${id}`;
  }));
  place();
  document.addEventListener("keydown", onNavKey);
  document.addEventListener("pointerdown", onNavOutside, true);
  addEventListener("resize", place);
  if (trigger) trigger.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => menu && menu.classList.add("on"));
  syncMenu();
  const first = menu.querySelector(".nv-row.on") || menu.querySelector(".nv-row");
  if (first) first.focus();
}

export function closeNav(){
  if (!menu) return;
  document.removeEventListener("keydown", onNavKey);
  document.removeEventListener("pointerdown", onNavOutside, true);
  removeEventListener("resize", place);
  menu.remove();
  menu = null;
  if (trigger){ trigger.setAttribute("aria-expanded", "false"); trigger.focus(); }
}

/* Where the sheet hangs. Handed to CSS as two custom properties rather than written as
   top/left, because the phone wants it at the bottom of the screen instead and an inline
   style would beat the media query that puts it there. On a desktop it belongs under the
   control that opened it — floating over the title, which is where a fixed 14px put it,
   reads as a panel that has lost its anchor. */
function place(){
  if (!menu || !trigger) return;
  const r = trigger.getBoundingClientRect();
  const w = menu.offsetWidth || 290;
  menu.style.setProperty("--nv-top", `${Math.round(r.bottom + 6)}px`);
  menu.style.setProperty("--nv-left", `${Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 14)))}px`);
}

function onNavKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeNav(); } }
function onNavOutside(e){
  if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) closeNav();
}

/* Which row is on. The cheat sheet ticks itself rather than a city, because on that page
   no city is where you are. */
function syncMenu(){
  if (!menu) return;
  const mark = (nodes, is) => nodes.forEach(b => {
    const on = is(b);
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  mark(menu.querySelectorAll("[data-city]"), b => !here && b.dataset.city === currentTab);
  mark(menu.querySelectorAll("[data-tool]"), b => !!here && b.dataset.tool === here.id);
}

/* ---------------- go ---------------- */
/* Called from each page's boot block, never at import time. */
export function bootNav(){
  trigger = document.getElementById("navTrig");
  if (!trigger) return;
  trigger.onclick = openNav;
  syncNav();
}
