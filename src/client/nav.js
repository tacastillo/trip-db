import { ALL_LEG, LEGS } from "../data/places.js";
import { TOOLS } from "../data/tools.js";
import { closeSheet, openSheet, syncSheet } from "./sheet.js";
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

let onCity = null;
const trigger = { city:null, tool:null };

/** The map page hands in setTab; without one, a city is a link. */
export function setNavHandler(fn){ onCity = fn; }

/* "Everywhere" sits at the top of the list rather than after Busan, because it is the
   answer to a different question than the three under it: not "which city", but "stop
   asking me which city". The trip's own order follows it. */
const CITY_ROWS = [ALL_LEG, ...LEGS];
const legById = (id) => CITY_ROWS.find(l => l.id === id);

/* ---------------- the triggers ---------------- */

/** Relabel both triggers. Called by setTab, so the header cannot disagree with the map. */
export function syncNav(){
  const l = legById(currentTab);
  if (trigger.city){
    trigger.city.querySelector(".nv-l").textContent = l ? l.label : "Korea";
    trigger.city.querySelector(".nv-d").textContent = l ? l.dates : "";
  }
  if (trigger.tool) trigger.tool.querySelector(".nv-l").textContent = currentTool.short || currentTool.label;
  syncSheet();
}

/* ---------------- the menus ---------------- */

/* Both are sheets, and client/sheet.js is the one that knows how a sheet behaves. What
   is left here is the two questions and their answers. */

/* A city is only ticked on the map: on a tool page no city is where you are — the map is
   simply pointed at one. */
const citySection = () => ({
  title: onCity ? "Show me" : "Open the map at",
  label: "Cities", key: "city", closeOnPick: true,
  rows: CITY_ROWS.map(l => ({ value:l.id, label:l.label, note:l.dates })),
  selected: () => currentTool.id === "map" ? currentTab : null,
  /* In place where there is a map to move; a link where there is not. `city` is the
     plan grammar's own parameter, and plan-boot honours it over the store. */
  onPick: (id) => { if (onCity) onCity(id); else location.href = `${base}index.html?city=${id}`; },
});

const toolSection = () => ({
  title: "Tools", label: "Tools", key: "tool", closeOnPick: true,
  rows: ALL_TOOLS.map(t => ({ value:t.id, label:t.label, note:t.note, icon:t.icon,
                              href:`${base}${t.id === "map" ? "" : t.page}` })),
  selected: () => currentTool.id,
});

/** Open one of the two sheets. Opening either closes the other. */
export function openMenu(kind){
  const city = kind === "city";
  openSheet({
    key: kind,
    label: city ? "Cities" : "Tools",
    className: "nv-menu",
    anchor: trigger[kind],
    place: "anchor",
    sections: [city ? citySection() : toolSection()],
  });
}

/** Kept as their own names because window.trip publishes them and both pages drive them. */
export const openNav = () => openMenu("city");
export const openTools = () => openMenu("tool");
/* Closes a nav sheet and not the look panel: this is published, and a closeNav() that
   shut the palette would be lying about what it does. */
export const closeNav = () => { closeSheet("city"); closeSheet("tool"); };

/* ---------------- go ---------------- */
/* Called from each page's boot block, never at import time. */
export function bootNav(){
  trigger.city = document.getElementById("navTrig");
  trigger.tool = document.getElementById("toolTrig");
  if (trigger.city) trigger.city.onclick = () => openMenu("city");
  if (trigger.tool) trigger.tool.onclick = () => openMenu("tool");
  syncNav();
}
