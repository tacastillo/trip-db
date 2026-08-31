/* What a won is worth in dollars.

   Yours to edit, like places.js and phrases.js. There is no network at runtime here —
   the whole page is built to work with a dead SIM in Jeju — so a rate is data, it ships
   with the site, and it goes stale the moment it is written. That is fine and it is said
   out loud: the page prints the date below beside the conversion, and the rate itself is
   editable on the money page, where the number you got at the ATM beats anything shipped
   in a repository months earlier.

   One currency, on purpose. This is a trip from the US with a US card in your pocket:
   the only two numbers involved are the won on the tag and what that is in dollars. A
   picker of eight currencies was seven rows of furniture in front of the one conversion
   anybody here is doing. If that ever changes it is a field, not a feature. */
export const RATES_AS_OF = "2026-08";

/** How many won one dollar buys. The one number this page rests on. */
export const WON_PER_USD = 1350;

export const CURRENCY = { code:"USD", symbol:"$", label:"US dollars" };

/* What the converter offers before you have typed anything. A coffee, a bowl of
   something, a dinner — enough to show what the control does without making you think of
   a number first. */
export const WON_PRESETS = [4500, 15000, 68000];
