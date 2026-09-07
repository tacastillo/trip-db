import { save, saved } from "./store.js";

/* A remembered choice off a short list, which the page has two of: which palette is on
   and which CARTO base the tiles come from. They were written twice, three functions
   each, identical but for the names — same URL-param-then-store-then-default cascade,
   same "write it onto <html> as a data attribute", same "only write to the store when it
   is not already what is there, because this runs on every load".

   The live binding stays with the module that owns it — `palette` and `basemap` are read
   elsewhere as bare names and that is the house pattern — so the assignment comes back
   through onApply rather than being kept in here. */
export function optionSetting({ ids, param, attr, key, onApply }){
  const fallback = ids[0];
  const known = (v) => ids.indexOf(v) >= 0 ? v : null;

  /** What the URL asks for, then what this browser remembers, then the default. */
  const wanted = (search) =>
    known(new URLSearchParams(String(search || "").replace(/^\?/, "")).get(param))
    || known(saved[key]) || fallback;

  /* On <html> rather than <body> so the tokens are in scope for everything, including
     the rules that hang off body.night. */
  const apply = (name) => {
    const v = known(name) || fallback;
    document.documentElement.dataset[attr] = v;
    if (onApply) onApply(v);
    return v;
  };

  const boot = () => {
    const want = wanted(location.search);
    apply(want);
    if (saved[key] !== want) save({ [key]: want });
    return want;
  };

  return { fallback, wanted, apply, boot };
}
