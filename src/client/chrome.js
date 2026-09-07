import { night, setNight } from "./state.js";
import { save } from "./store.js";
import { setToolBtn } from "./toolbtn.js";

/* The site chrome that is the same on all three pages, and was written twice: once in
   main.js and once in tool-boot.js, four lines each, with a comment in tool-boot
   explaining that it was a copy because importing main.js would drag Leaflet onto a page
   with no map. That reason is sound and the copy was still the wrong way round — two
   copies of a boot sequence are two things that can quietly disagree about it. So it
   lives here instead, in a module that touches neither the map nor a tool page, and both
   of them import it.

   Nothing runs at import time. */

/* The body ships class="night" so the first paint is never a white flash; if this browser
   remembered otherwise, that is undone here rather than in the markup. */
export function applyNight(){
  const btn = document.getElementById("nightToggle");
  document.body.classList.toggle("night", night);
  if (btn) setToolBtn(btn, night ? "day" : "night", night ? "Day" : "Night");
}

/** The toggle. `after` is what the map page has to do on top: everything it has already
    drawn was painted from tokens, so it has to be drawn again. A tool page passes nothing. */
export function wireNightToggle(after){
  const btn = document.getElementById("nightToggle");
  if (!btn) return;
  btn.onclick = () => {
    setNight(!night);
    save({ night });
    applyNight();
    if (after) after();
  };
}
