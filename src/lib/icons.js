import { ICONS, ICON_BOX } from "../data/icons.js";

/* One function turns an icon name into markup, and everything on the page that shows
   an icon goes through it — the header toggles, the category pins, the buttons in a
   plan row. That is what stops a second size, a second stroke weight or a stray
   `fill` from creeping in one call site at a time.

   The strokes are `currentColor`, so an icon is coloured by the thing it sits in and
   never by its own rule: a category pin sets `color` on the pin, a button sets it on
   the button, and night mode is already handled by whatever token that colour came
   from. Size is the same — `width:1em`, so an icon is the size of the text beside it.

   Pure, and deliberately so: this returns a string of markup rather than an element,
   which is what lets the renderers keep building rows as template literals. */
export function icon(name, cls){
  const body = ICONS[name];
  /* An unknown name draws nothing rather than throwing. Degrade, do not break: a
     missing glyph is a gap in a row, a thrown error is a blank page. */
  if (!body) return "";
  return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 ${ICON_BOX} ${ICON_BOX}" `
    + `aria-hidden="true" focusable="false">${body}</svg>`;
}

export const hasIcon = (name) => !!ICONS[name];
