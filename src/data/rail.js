/* The two vendored networks under the leg ids the rest of the code uses. Jeju has no
   metro; an empty list is the whole of its handling. */

import { SUBWAY_BUSAN } from "./subway-busan.js";
import { SUBWAY } from "./subway.js";

export const RAIL = { seoul: SUBWAY, busan: SUBWAY_BUSAN, jeju: [] };
