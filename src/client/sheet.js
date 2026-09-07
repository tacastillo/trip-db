import { icon } from "../lib/icons.js";
import { esc } from "../lib/design.js";

/* The one sheet, and the three things that open one: the two nav menus and the look
   panel. They were the same overlay written twice — build a string, make a div with
   role="dialog", innerHTML it, append it to the body, wire the rows, handle Escape,
   close and remove — down to a byte-identical mark() helper in each file. Two copies of
   an overlay is two overlays that can drift, and these had: the nav menu closed on an
   outside tap and gave focus back to its trigger, and the look panel did neither.

   At most one is open at a time. That was already nav's rule for its own pair, and the
   reason generalises: two sheets over a map is two things covering the thing they are
   about.

   Nothing here runs at import time, and this file imports nothing that touches the map. */

let el = null, spec = null, openKey = "";

/** "" when nothing is open. */
export const openSheetKey = () => openKey;

/* One row. The shape both menus were writing four times over — the cities, the tools,
   the palettes and the bases — differing only in a class prefix and a data attribute.

   `attrs` is what keeps the palette swatches honest: data-palette lands verbatim on the
   row element, [data-palette] sets --pal-* on any element, so a swatch painted in
   var(--pal-accent) inside that row is that palette's real accent. This builder never
   learns what a palette is and no colour is copied into JS. `lead` is raw for the same
   reason: it is the caller's own markup. */
function rowHtml(row, sec, i){
  const tag = row.href ? "a" : "button";
  const lead = row.lead || (row.icon ? `<span class="sh-ic">${icon(row.icon)}</span>` : "");
  const extra = Object.keys(row.attrs || {}).map(k => ` ${k}="${esc(row.attrs[k])}"`).join("");
  return `<${tag} class="sh-row" data-${sec.key}="${esc(row.value)}" data-sh="${i}"`
    + (row.href ? ` href="${esc(row.href)}"` : "")
    + ` role="option" aria-selected="false"${extra}>${lead}`
    + `<span class="sh-txt"><b>${esc(row.label)}</b>`
    + (row.note ? `<em>${esc(row.note)}</em>` : "")
    + `</span><span class="sh-tick">${icon("check")}</span></${tag}>`;
}

function sectionHtml(sec, i){
  return (sec.title ? `<div class="sh-sec">${esc(sec.title)}</div>` : "")
    + `<div class="sh-list" role="listbox" aria-label="${esc(sec.label || sec.title || "")}">`
    + sec.rows.map(r => rowHtml(r, sec, i)).join("")
    + `</div>`;
}

function headHtml(h){
  if (!h) return "";
  return `<div class="sh-head"><div><b>${esc(h.title)}</b>`
    + (h.hint ? `<span>${esc(h.hint)}</span>` : "")
    + `</div>`
    + (h.close ? `<button class="sh-x" data-sh-close title="Close" aria-label="Close">${icon("close")}</button>` : "")
    + `</div>`;
}

/* The data attribute a row carries, as the DOM spells it back: data-map-pick reads as
   dataset.mapPick. */
const camel = (k) => k.replace(/-([a-z])/g, (m, c) => c.toUpperCase());

/** Open a sheet. Opening the key that is already open closes it instead. */
export function openSheet(next){
  const was = openKey;
  if (el) closeSheet();
  if (was === next.key) return null;

  spec = next;
  openKey = next.key;
  el = document.createElement("div");
  el.className = `sh-sheet ${next.className || ""}`.trim();
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", next.label || "");
  el.innerHTML = headHtml(next.head) + next.sections.map(sectionHtml).join("");
  document.body.appendChild(el);

  /* One delegated listener rather than a pass per section. A row with no onPick is an
     <a> that navigates on its own — never preventDefault here, or the deployed
     /phrases.html stops opening. */
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-sh-close]")){ closeSheet(); return; }
    const row = e.target.closest(".sh-row");
    if (!row || !el.contains(row)) return;
    const sec = spec.sections[Number(row.dataset.sh)];
    if (!sec) return;
    const value = row.dataset[camel(sec.key)];
    if (sec.closeOnPick) closeSheet();
    if (sec.onPick) sec.onPick(value, row);
  });

  place();
  document.addEventListener("keydown", onKey);
  /* Capture, so a tap that lands on the map closes this before the map acts on it. */
  if (next.dismiss !== "none") document.addEventListener("pointerdown", onOutside, true);
  addEventListener("resize", place);
  /* Only the triggers carry aria-expanded; the title is deliberately not a control. */
  if (next.anchor && next.anchor.hasAttribute("aria-expanded")) next.anchor.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => el && el.classList.add("on"));
  syncSheet();
  const first = el.querySelector(".sh-row.on") || el.querySelector(".sh-row");
  if (first) first.focus();
  return el;
}

/** Close what is open. With a key, only if that key is what is open. */
export function closeSheet(key){
  if (!el || (key && key !== openKey)) return;
  document.removeEventListener("keydown", onKey);
  document.removeEventListener("pointerdown", onOutside, true);
  removeEventListener("resize", place);
  const anchor = spec && spec.anchor;
  el.remove();
  el = null; spec = null; openKey = "";
  if (anchor){
    if (anchor.hasAttribute("aria-expanded")) anchor.setAttribute("aria-expanded", "false");
    /* A div cannot take focus, and the title is not going to be given a tabindex to make
       this work — a focusable title is a different control. So the nav triggers get their
       focus back and the look panel's title does not. */
    if (typeof anchor.focus === "function" && anchor.tabIndex >= 0) anchor.focus();
  }
}

/** Re-ask every section which row is on. A no-op when nothing is open, which is what
    lets applyPalette() call it on every load, long before a panel exists. */
export function syncSheet(){
  if (!el || !spec) return;
  spec.sections.forEach((sec, i) => {
    const on = sec.selected ? sec.selected() : null;
    el.querySelectorAll(`.sh-row[data-sh="${i}"]`).forEach(row => {
      const is = row.dataset[camel(sec.key)] === on;
      row.classList.toggle("on", is);
      row.setAttribute("aria-selected", is ? "true" : "false");
    });
  });
}

/* Where an anchored sheet hangs. Handed to CSS as two custom properties rather than
   written as top/left, because the phone wants it at the bottom of the screen instead
   and an inline style would beat the media query that puts it there. Measured rather
   than assumed: a tools sheet under the city trigger is a sheet that lost its anchor. */
function place(){
  if (!el || !spec || spec.place !== "anchor" || !spec.anchor) return;
  const r = spec.anchor.getBoundingClientRect();
  const w = el.offsetWidth || 290;
  el.style.setProperty("--sh-top", `${Math.round(r.bottom + 6)}px`);
  el.style.setProperty("--sh-left", `${Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 14)))}px`);
}

function onKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeSheet(); } }
/* The anchor is not outside: without this the fifth tap on the title would open the
   panel and the same tap would close it again. */
function onOutside(e){
  if (!el) return;
  const a = spec && spec.anchor;
  if (!el.contains(e.target) && !(a && a.contains(e.target))) closeSheet();
}
