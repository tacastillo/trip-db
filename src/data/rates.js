/* What a won is worth, in money you already think in.

   Yours to edit, like places.js and phrases.js. There is no network at runtime here —
   the whole page is built to work with a dead SIM in Jeju — so a rate is data, it ships
   with the site, and it goes stale the moment it is written. That is fine and it is
   said out loud: the page prints the date below beside every conversion, and the rate
   itself is editable on the money page, where the number you got at the ATM beats
   anything shipped in a repository three months earlier.

   `won` is how many won one unit of the currency buys. One number per currency, because
   a bid/ask spread is a thing a bank has and a thing a traveller does not.

   HOME is the one the page opens on. Everything else is one tap away and the choice is
   remembered like night mode. */
export const RATES_AS_OF = "2026-08";

export const HOME = "AUD";

export const RATES = [
  { code:"AUD", symbol:"A$",  label:"Australian dollar", won:890 },
  { code:"USD", symbol:"US$", label:"US dollar",         won:1350 },
  { code:"EUR", symbol:"€",   label:"Euro",              won:1470 },
  { code:"GBP", symbol:"£",   label:"Pound",             won:1730 },
  { code:"SGD", symbol:"S$",  label:"Singapore dollar",  won:1030 },
  { code:"NZD", symbol:"NZ$", label:"NZ dollar",         won:810 },
  { code:"CAD", symbol:"C$",  label:"Canadian dollar",   won:985 },
  { code:"JPY", symbol:"¥",   label:"Yen",               won:9.1 },
];

/* What the converter offers before you have typed anything. A coffee, a bowl of
   something, a dinner, a taxi across Seoul — enough to show what the control does
   without making you think of a number first. */
export const WON_PRESETS = [4500, 15000, 68000];
