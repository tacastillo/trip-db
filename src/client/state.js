import { saved } from "./store.js";
import { ALL_LEG, CAT_ORDER } from "../data/places.js";

/* index.html kept every mutable in one block; here each one lives with the module
   that writes it and is read elsewhere as a live binding. What is left in this file
   is the handful that more than one module writes, which is what a setter is for. */

/* Leaflet's map object. It lives here rather than with the rest of the Leaflet
   handles because it is the one thing read while the modules are still being
   evaluated — setView() consults it as the view module loads — and this file
   depends on nothing but the data, so it is always ready first. */
export let map;
export const setMap = (v) => { map = v; };

/* the category filters. Mutated in place and never replaced, so no setter. A chip you
   switched off last night is still off this morning — see store.js. An unknown key in
   what was stored is ignored rather than trusted: the category table can change under
   a browser that remembered the old one. */
export const active = {};
CAT_ORDER.forEach(k => active[k] = !saved.cats || saved.cats[k] !== false);

/* written by setTab, and by bootPlan when the link names a different leg */
export let currentTab = "seoul";
export const setCurrentTab = (v) => { currentTab = v; };

/* The map used to show exactly one leg's places, which made the calendar a filter on
   what you were allowed to see: on the Busan tab, Jeju did not exist. That is fine on
   the day it is true and wrong every other day — a ferry is late, you are back in Seoul
   for an afternoon, somebody asks what is near. So the tab can also be ALL_CITY, which
   is not a leg (it has no dates, no hotel and no tile pack) but is a legitimate answer
   to "what is the map showing": everything.

   Everything that used to compare p.city === currentTab asks inTab() instead, which is
   the whole of the difference. A day still belongs to a real leg — plan.city is never
   this — so the hotel brackets, the closed-day cautions and the ride from the hotel are
   untouched by it. */
export const ALL_CITY = ALL_LEG.id;
export const allTab = () => currentTab === ALL_CITY;
export const inTab = (p) => currentTab === ALL_CITY || p.city === currentTab;

/* both written by their toggle button in main.js and read by the map */
export let night = saved.night !== false;
export const setNight = (v) => { night = v; };

export let railOn = saved.railOn !== false;
export const setRailOn = (v) => { railOn = v; };

/* Whether the URL named a city, and which. Read by map.js: a day restored from the store
   frames itself on boot, which quietly drags the map back to that day's leg — fine when
   you just reloaded, wrong when you have this moment asked for another city from the nav
   menu. Stating a city is the more recent instruction, so it wins over the framing. */
export let statedCity = "";
export const setStatedCity = (v) => { statedCity = v || ""; };
