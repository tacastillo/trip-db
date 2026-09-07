/* The four test files' shared scaffolding, which each of them used to declare for itself:
   the same eight lines, copied, and already drifted — test-pipeline named its counter
   differently and printed its verdict in another shape, which is exactly what a fourth
   copy is for. Nothing here knows anything about the trip. */

let failures = 0;

/** A check. `detail` says what went wrong and is printed only when something did. */
export const ok = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail && !pass ? `\n        ${detail}` : ""}`);
};

/** The same, but the detail is shown on a pass too. For the geometry pipeline, where the
    measurement is the point: "within a metre" is a claim, "0.03 m" is the evidence. */
export const okMeasured = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

export const group = (n) => console.log(`\n${n}`);
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The last line, and the exit code CI reads. */
export function verdict(){
  console.log(failures ? `\n${failures} failed\n` : "\nall good\n");
  process.exit(failures ? 1 : 0);
}
