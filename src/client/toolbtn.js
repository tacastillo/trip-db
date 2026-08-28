import { hasIcon, icon } from "../lib/icons.js";

/* The four toggles in the header, which is the tightest row on the page.

   On a phone the title and four labelled buttons do not fit on one line — the title
   wraps and the header eats a third of the screen before the map has drawn anything. So
   every toggle is an icon and a label in two spans, and mobile.css hides the labels: the
   icon is what you aim a thumb at anyway, and the accessible name stays on the button's
   own title/aria-label rather than in text that has to be rendered.

   Written through here rather than by assigning textContent, so a button cannot end up
   with its label back as one flat string on the one screen it does not fit.

   `what` is an icon name where there is one and plain text otherwise, because the
   offline button spends its download counting "0%".."100%" in the same 20px slot. */

export function setToolBtn(el, what, label){
  if (!el) return;
  const i = el.querySelector(".tb-i"), l = el.querySelector(".tb-l");
  if (!i || !l){ el.textContent = label; return; }
  if (hasIcon(what)){ const mark = icon(what); if (i.innerHTML !== mark) i.innerHTML = mark; }
  else if (i.textContent !== what){ i.textContent = what; }
  if (l.textContent !== label) l.textContent = label;
}
