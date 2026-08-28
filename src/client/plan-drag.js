import { renderPlan } from "./plan-pane.js";
import { planDragFrom, planMoveBody, planRenderQueued, setPlanDragFrom, setPlanDragging, setPlanRenderQueued } from "./plan-state.js";

/* ---------------- dragging a stop ---------------- */

export function planDragStart(e){
  const rows = [].slice.call(document.querySelectorAll("#planpane .pstop"));
  setPlanDragFrom(+e.currentTarget.dataset.drag);
  if (planDragFrom < 0 || !rows.length) return;
  setPlanDragging(true);
  e.currentTarget.setPointerCapture(e.pointerId);
  rows[planDragFrom].classList.add("dragging");
  const move = ev => {
    let to = rows.length - 1;
    for (let i = 0; i < rows.length; i++){
      const r = rows[i].getBoundingClientRect();
      if (ev.clientY < r.top + r.height / 2){ to = i; break; }
    }
    rows.forEach((r, i) => r.classList.toggle("dropbefore", i === to && i !== planDragFrom));
  };
  const end = ev => {
    document.removeEventListener("pointermove", move);
    ["pointerup","pointercancel","lostpointercapture"].forEach(k => document.removeEventListener(k, end));
    let to = -1;
    rows.forEach((r, i) => { if (r.classList.contains("dropbefore")) to = i; });
    rows.forEach(r => r.classList.remove("dragging", "dropbefore"));
    setPlanDragging(false);
    const from = planDragFrom;
    setPlanDragFrom(-1);
    // rows are the day's stops; the hotel at either end is not one of them
    if (to >= 0) planMoveBody(from, to > from ? to - 1 : to);
    else if (planRenderQueued){ setPlanRenderQueued(false); renderPlan(); }
  };
  document.addEventListener("pointermove", move);
  // all three, or a cancelled gesture leaves the pane frozen mid-drag
  ["pointerup","pointercancel","lostpointercapture"].forEach(k => document.addEventListener(k, end));
}

