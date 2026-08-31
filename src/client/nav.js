import { LEGS } from "../data/places.js";
import { TOOLS } from "../data/tools.js";
import { icon } from "../lib/icons.js";
import { currentTab } from "./state.js";

/* The one way around this site — and it is two controls, not one.

   It started as a row of leg tabs with the cheat sheet stuck on the end as a fourth
   pill, which was wrong: the sheet is not a place you go to, and four things do not fit
   a row with space for two and a half. So the pills became one trigger and one menu
   with two headings in it, Cities and Tools — and that was wrong the other way round.
   Those two headings answer questions that have nothing to do with each other. "Which
   city is the map on" is about the map; "which tool am I in" is about which page you
   are looking at. Reading both off one list meant reading past the answer you did not
   want, and the tick sat on a city when you were not even on the map.

   Two triggers, then, side by side: where the map is pointed, and which tool you are in.
   Each opens a list with one question in it and one answer ticked. On a phone the pair
   still fits the row the three legs used to fill, because the tool trigger is an icon
   and a short word rather than a page title.

   Imported by BOTH pages, so it may import neither map.js nor tabs.js. Picking a city is
   handed in the way palette.js is handed its redraw (setNavHandler in main.js): the map
   page passes setTab and switches leg in place, and a tool page, which has no map to
   switch, has no handler and navigates instead. That is also what keeps tabs.js ->
   nav.js a one-way import with no cycle. */

/* astro.config's base, stated on <html> by Shell.astro: nothing in a bundled module can
   read import.meta.env.BASE_URL at runtime, and every link here has to carry it. */
const base = document.documentElement.dataset.base || "./";

/* The map is a tool too — it is a page you can be on, and on a tool page it is the way
   back. It is not in data/tools.js because it has no page file of its own to check. */
export const MAP_TOOL = { id:"map", page:"index.html", label:"The map", short:"Map",
  note:"where everything is", icon:"map" };
const ALL_TOOLS = [MAP_TOOL, ...TOOLS];

/* Which tool this page is. The trigger says where you are, and on the money page
   "Seoul" would be an answer to a question nobody asked. */
/* Matched with and without the extension: build.format is "file", so the deployed page
   really is /phrases.html — but the dev server serves it at /phrases, and a trigger that
   says "Map" while you are reading the phrases is the kind of thing you only notice in
   the browser. */
const isPage = (page) => {
  const p = location.pathname.replace(/\/$/, "");
  return p.endsWith(page) || p.endsWith(page.replace(/\.html$/, ""));
};
export const currentTool = TOOLS.find(t => isPage(t.page)) || MAP_TOOL;

let menu = null, openKind = "", onCity = null;
const trigger = { city:null, tool:null };

/** The map page hands in setTab; without one, a city is a link. */
export function setNavHandler(fn){ onCity = fn; }

const legById = (id) => LEGS.find(l => l.id === id);

/* ---------------- the triggers ---------------- */

/** Relabel both triggers. Called by setTab, so the header cannot disagree with the map. */
export function syncNav(){
  const l = legById(currentTab);
  if (trigger.city){
    trigger.city.querySelector(".nv-l").textContent = l ? l.label : "Korea";
    trigger.city.querySelector(".nv-d").textContent = l ? l.dates : "";
  }
  if (trigger.tool) trigger.tool.querySelector(".nv-l").textContent = currentTool.short || currentTool.label;
  if (menu) syncMenu();
}

/* ---------------- the menus ---------------- */

function citiesHtml(){
  return `<div class="nv-sec">${onCity ? "Show me" : "Open the map at"}</div>
    <div class="nv-list" role="listbox" aria-label="Cities">${LEGS.map(l => `
      <button class="nv-row" data-city="${l.id}" role="option" aria-selected="false">
        <span class="nv-txt"><b>${l.label}</b><em>${l.dates}</em></span>
        <span class="nv-tick">${icon("check")}</span>
      </button>`).join("")}</div>`;
}

function toolsHtml(){
  return `<div class="nv-sec">Tools</div>
    <div class="nv-list" role="listbox" aria-label="Tools">${ALL_TOOLS.map(t => `
      <a class="nv-row" href="${base}${t.id === "map" ? "" : t.page}" data-tool="${t.id}" role="option" aria-selected="false">
        <span class="nv-ic">${icon(t.icon)}</span>
        <span class="nv-txt"><b>${t.label}</b><em>${t.note}</em></span>
        <span class="nv-tick">${icon("check")}</span>
      </a>`).join("")}</div>`;
}

/** Open one of the two sheets. Opening either closes the other — two panels over a map
    is two things covering the thing they are about. */
export function openMenu(kind){
  const was = openKind;
  if (menu) closeNav();
  if (was === kind) return;
  openKind = kind;
  menu = document.createElement("div");
  menu.className = `nv-menu nv-${kind}`;
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", kind === "city" ? "Cities" : "Tools");
  menu.innerHTML = kind === "city" ? citiesHtml() : toolsHtml();
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
  const t = trigger[kind];
  if (t) t.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => menu && menu.classList.add("on"));
  syncMenu();
  const first = menu.querySelector(".nv-row.on") || menu.querySelector(".nv-row");
  if (first) first.focus();
}

/** Kept as its own name because window.trip publishes it and both pages drive it. */
export const openNav = () => openMenu("city");
export const openTools = () => openMenu("tool");

export function closeNav(){
  if (!menu) return;
  document.removeEventListener("keydown", onNavKey);
  document.removeEventListener("pointerdown", onNavOutside, true);
  removeEventListener("resize", place);
  menu.remove();
  menu = null;
  const t = trigger[openKind];
  openKind = "";
  if (t){ t.setAttribute("aria-expanded", "false"); t.focus(); }
}

/* Where the sheet hangs. Handed to CSS as two custom properties rather than written as
   top/left, because the phone wants it at the bottom of the screen instead and an inline
   style would beat the media query that puts it there. On a desktop it belongs under the
   control that opened it — which is now one of two, so it is measured rather than
   assumed: a tools sheet under the city trigger is a panel that has lost its anchor. */
function place(){
  const t = trigger[openKind];
  if (!menu || !t) return;
  const r = t.getBoundingClientRect();
  const w = menu.offsetWidth || 290;
  menu.style.setProperty("--nv-top", `${Math.round(r.bottom + 6)}px`);
  menu.style.setProperty("--nv-left", `${Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 14)))}px`);
}

function onNavKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeNav(); } }
function onNavOutside(e){
  const t = trigger[openKind];
  if (menu && !menu.contains(e.target) && t && !t.contains(e.target)) closeNav();
}

/* Which row is on. A city is only ticked on the map, because on a tool page no city is
   where you are — the map is simply pointed at one. */
function syncMenu(){
  if (!menu) return;
  const mark = (nodes, is) => nodes.forEach(b => {
    const on = is(b);
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  mark(menu.querySelectorAll("[data-city]"), b => currentTool.id === "map" && b.dataset.city === currentTab);
  mark(menu.querySelectorAll("[data-tool]"), b => b.dataset.tool === currentTool.id);
}

/* ---------------- go ---------------- */
/* Called from each page's boot block, never at import time. */
export function bootNav(){
  trigger.city = document.getElementById("navTrig");
  trigger.tool = document.getElementById("toolTrig");
  if (trigger.city) trigger.city.onclick = () => openMenu("city");
  if (trigger.tool) trigger.tool.onclick = () => openMenu("tool");
  syncNav();
}
