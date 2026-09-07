/* The search box, which the map page and the phrase page each wired themselves: the same
   three handlers over different ids. The Escape one is the reason this is worth sharing —
   it stops propagation before clearing, so the key that empties the box is not also the
   key that closes the sheet over it, and that is easy to leave out of the second copy.

   `oninput` is assigned rather than added, because callers reach for it by hand to make
   the box re-read itself after setting a value from elsewhere. */
export function wireSearch(input, clear, onQuery){
  if (!input) return;
  input.oninput = () => {
    if (clear) clear.classList.toggle("on", !!input.value.trim());
    onQuery(input.value);
  };
  input.onkeydown = (e) => {
    if (e.key === "Escape" && input.value){ e.stopPropagation(); input.value = ""; input.oninput(); }
  };
  if (clear) clear.onclick = () => { input.value = ""; input.oninput(); input.focus(); };
}
