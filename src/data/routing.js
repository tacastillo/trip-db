/* The routing tables. These are yours to edit: PLACE_OFF overrides which station a spot
   gets off at, ROUTES says which lines and transfers get you there from the hotel, and
   STATION_COORDS is where those stations are.

   Station names are keys. ROUTES is keyed by them and PLACE_OFF points at them, so
   renaming one silently breaks a route — which is why tools/fetch-stations.mjs refreshes
   the coordinates but never the names, and reports what it could not match instead. */

/* ===========================================================
   SUBWAY ROUTING  —  easy to edit
   • Wrong line or transfer?      edit ROUTES["<off station>"]
   • A pin gets off at wrong stop? edit PLACE_OFF["<pin id>"]
   A pin with no PLACE_OFF entry falls back to the nearest station that has a
   route, so a new spot gets a ride without touching this table; PLACE_OFF is
   the override for when the nearest station isn't the one you'd actually use.
   Each leg is { line, to }. The LAST to = where you get off;
   an earlier to = the station you transfer at.
   Line refs: 1-7, 9, B=Suin–Bundang, SB=Sinbundang, GJ=Gyeongui–Jungang
   =========================================================== */
export const HOTEL_STATION = "Dongdaemun History & Culture Park";
export const PLACE_OFF = {
  "sancheong": "Euljiro 3-ga",
  "sosinisso": "Sinchon",
  "gyeonguipark": "Hongik Univ.",
  "yeongdongsl": "Sinsa",
  "zenzero-gn": "Gangnam-gu Office",
  "zenzero-dosan": "Apgujeong Rodeo",
  "commonground": "Konkuk Univ.",
  "muwol": "Gangnam",
  "yugdaljib": "Gangnam",
  "hyejin": "Yeoksam",
  "nudake-ss": "Seongsu",
  "gyeongbok": "Gyeongbokgung",
  "changdeok": "Anguk",
  "bukchon": "Anguk",
  "hanbok": "Anguk",
  "insadong": "Jonggak",
  "gwangjang": "Jongno 5-ga",
  "garlicboy": "Jongno 5-ga",
  "gwttukgam": "Gwanghwamun",
  "onion": "Anguk",
  "dotori": "Anguk",
  "cheongsudang": "Jongno 3-ga",
  "miltoast": "Jongno 3-ga",
  "nakwon": "Jongno 3-ga",
  "soha": "Jongno 3-ga",
  "jayeondo": "Jongno 3-ga",
  "damsot-ik": "Jongno 3-ga",
  "nseoul": "Myeongdong",
  "mokmyeok": "Myeongdong",
  "milestone-hannam": "Hangangjin",
  "leeum": "Hangangjin",
  "milestone-seongsu": "Ttukseom",
  "seoulforest": "Seoul Forest",
  "bornbred": "Majang",
  "mingles": "Apgujeong Rodeo",
  "hanmiok": "Apgujeong Rodeo",
  "wumok": "Apgujeong Rodeo",
  "damsot-ap": "Apgujeong Rodeo",
  "nudake": "Apgujeong Rodeo",
  "hongbaksa": "Hak-dong",
  "bunker": "Apgujeong",
  "lowide": "Apgujeong",
  "gebangsikdang": "Gangnam-gu Office",
  "garosugil": "Sinsa",
  "starfield": "Samseong",
  "anthracite": "Sangsu",
  "hummingbella": "Sangsu",
  "milomil": "Mangwon",
  "madeby": "Hongik Univ.",
  "yeouido": "Yeouinaru",
};
export const ROUTES = {
  "Euljiro 3-ga": [{"line": "2", "to": "Euljiro 3-ga"}],
  "Sinchon": [{"line": "2", "to": "Sinchon"}],
  "Konkuk Univ.": [{"line": "2", "to": "Konkuk Univ."}],
  "Gangnam": [{"line": "2", "to": "Gangnam"}],
  "Yeoksam": [{"line": "2", "to": "Yeoksam"}],
  "Seongsu": [ {line:"2", to:"Seongsu"} ],
  "Jongno 3-ga": [ {line:"5", to:"Jongno 3-ga"} ],
  "Gwanghwamun": [ {line:"5", to:"Gwanghwamun"} ],
  "Anguk": [ {line:"5", to:"Jongno 3-ga"}, {line:"3", to:"Anguk"} ],
  "Gyeongbokgung": [ {line:"5", to:"Jongno 3-ga"}, {line:"3", to:"Gyeongbokgung"} ],
  "Jonggak": [ {line:"5", to:"Jongno 3-ga"}, {line:"1", to:"Jonggak"} ],
  "Jongno 5-ga": [ {line:"4", to:"Dongdaemun"}, {line:"1", to:"Jongno 5-ga"} ],
  "Myeongdong": [ {line:"4", to:"Myeongdong"} ],
  // Line 6 runs right past the hotel: Cheonggu is one stop out on Line 5, and
  // riding west from there beats going out to Samgakji and doubling back.
  "Hangangjin": [ {line:"5", to:"Cheonggu"}, {line:"6", to:"Hangangjin"} ],
  "Ttukseom": [ {line:"2", to:"Ttukseom"} ],
  "Seoul Forest": [ {line:"2", to:"Wangsimni"}, {line:"B", to:"Seoul Forest"} ],
  "Majang": [ {line:"5", to:"Majang"} ],
  "Apgujeong Rodeo": [ {line:"2", to:"Wangsimni"}, {line:"B", to:"Apgujeong Rodeo"} ],
  "Apgujeong": [ {line:"4", to:"Chungmuro"}, {line:"3", to:"Apgujeong"} ],
  "Hak-dong": [ {line:"2", to:"Konkuk Univ."}, {line:"7", to:"Hak-dong"} ],
  "Sinsa": [ {line:"4", to:"Chungmuro"}, {line:"3", to:"Sinsa"} ],
  "Gangnam-gu Office": [ {line:"2", to:"Wangsimni"}, {line:"B", to:"Gangnam-gu Office"} ],
  "Samseong": [ {line:"2", to:"Samseong"} ],
  "Hongik Univ.": [ {line:"2", to:"Hongik Univ."} ],
  "Sangsu": [ {line:"4", to:"Samgakji"}, {line:"6", to:"Sangsu"} ],
  "Mangwon": [ {line:"4", to:"Samgakji"}, {line:"6", to:"Mangwon"} ],
  "Yeouinaru": [ {line:"5", to:"Yeouinaru"} ],
};
export const STATION_COORDS = {
  "Euljiro 3-ga": [37.566295, 126.991806],
  "Sinchon": [37.555134, 126.936893],
  "Gangnam": [37.497942, 127.027621],
  "Yeoksam": [37.500622, 127.036456],
  "Seongsu": [37.544569, 127.056102],
  "Anguk": [37.576828, 126.986171],
  "Apgujeong": [37.526185, 127.028499],
  "Apgujeong Rodeo": [37.527813, 127.040709],
  "Cheonggu": [37.560062, 127.013861],
  "Chungmuro": [37.561202, 126.994109],
  "Dongdaemun": [37.571179, 127.010509],
  "Dongdaemun History & Culture Park": [37.565138, 127.007805],
  "Gangnam-gu Office": [37.516994, 127.041355],
  "Gwanghwamun": [37.571616, 126.976903],
  "Gyeongbokgung": [37.575787, 126.973526],
  "Hak-dong": [37.513957, 127.03075],
  "Hangangjin": [37.539796, 127.001751],
  "Hongik Univ.": [37.556987, 126.925178],
  "Jonggak": [37.570175, 126.983183],
  "Jongno 3-ga": [37.571493, 126.9915],
  "Jongno 5-ga": [37.570987, 127.002022],
  "Konkuk Univ.": [37.540403, 127.070124],
  "Majang": [37.566098, 127.042881],
  "Mangwon": [37.556025, 126.910128],
  "Myeongdong": [37.560898, 126.986376],
  "Samgakji": [37.535478, 126.973889],
  "Samseong": [37.50884, 127.063143],
  "Sangsu": [37.547758, 126.922892],
  "Seoul Forest": [37.543592, 127.04474],
  "Sinsa": [37.516109, 127.019516],
  "Ttukseom": [37.547235, 127.04741],
  "Wangsimni": [37.561229, 127.037147],
  "Yeouinaru": [37.526853, 126.932529],
};

/* Rough door-to-door numbers, and honestly rough: Seoul metro averages about
   33 km/h once dwell time is in, a transfer costs a few minutes of stairs and
   platform, and street walking is never the straight line the map draws. */
/* One per statement, not one comma-separated line: tools/lib.mjs finds a constant
   by searching for the literal text `const NAME = `, so a name that only ever
   appears after a comma is invisible to the checkers. */
export const RIDE_KMH = 33;
export const WALK_KMH = 4.6;
export const XFER_MIN = 4;
export const WALK_BEND = 1.3;

/* The walk the nearest-station guess is allowed to hand you, in metres. Sized to
   the longest walk in PLACE_OFF, so a guess is never worse than a hand-set one —
   past that the nearest station isn't really the station for that spot. It also
   keeps cities with no station table of their own from matching anything. */
export const AUTO_WALK_MAX = 1100;
