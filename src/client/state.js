import { saved } from "./store.js";
import { CAT_ORDER } from "../data/places.js";

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

/* both written by their toggle button in main.js and read by the map */
export let night = saved.night !== false;
export const setNight = (v) => { night = v; };

export let railOn = saved.railOn !== false;
export const setRailOn = (v) => { railOn = v; };
