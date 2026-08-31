import { sayParts } from "../lib/phrases.js";

/* One row of the sheet, drawn the same way on both pages that have rows.

   It was a copy in each boot module, which is how the two got to disagree about what a
   row is made of. There is nothing page-specific in a row, so there is one of these.

   The stress marks become spans here and nowhere else: lib/phrases.js does the parsing so
   a test can see it, this only paints, and the colour is the stylesheet's. */
export const sayHtml = (say) => sayParts(say)
  .map(p => p.stress ? `<span class="ph-st">${p.text}</span>` : p.text).join("");

/* Two lines, and which two matters.

   The compact draft of this put the meaning and the romanization on one line together —
   both small, both muted, both Inter — so "Hello / annyeonghaseyo" read as one sentence
   in one font and you had to work out which half was English. Two fields that are the
   same size and colour on the same line are one field.

   So the romanization sits with the line it belongs to instead: it is the same words as
   the phonetic spelling, just spelled the standard way for Papago and for matching a
   sign, and beside 19px of bold display type at 11.5px muted it cannot be mistaken for
   the meaning. The meaning keeps the label line above, on its own. Still two lines. */
export const rowHtml = (p) => `<div class="phrow" data-id="${p.id}">
  <div class="ph-en">${p.en}</div>
  <div class="ph-b"><span class="ph-say">${sayHtml(p.say)}</span><span class="ph-rom">${p.rom}</span></div>
</div>`;

/* What a counter says back, behind one control. Rendered only where a group has any —
   an empty "0 replies" toggle is a control asking to be explained, the same argument
   that keeps the been-there chip off the map page's first morning. */
export const hearHtml = (rows, gid) => !rows.length ? "" : `<div class="phhear" data-hear="${gid}">
  <button class="phhear-t" type="button" aria-expanded="false">What they'll say back<span class="ct">${rows.length}</span></button>
  <div class="phhear-b">${rows.map(rowHtml).join("")}</div>
</div>`;

/** Wire every "what they'll say back" toggle inside a container that was just rendered. */
export function wireHear(root){
  root.querySelectorAll(".phhear-t").forEach(b => b.onclick = () => {
    const box = b.closest(".phhear");
    b.setAttribute("aria-expanded", String(box.classList.toggle("on")));
  });
}
