/* The Korean cheat sheet. Yours to edit, the way places.js is — nothing generates this.

   Organised by how often you reach for it, not by where you are standing. A phrasebook
   sorted into "Restaurants" and "Markets" is sorted for the person who wrote it: on a
   phone you do not scroll to a chapter, you want the six things you say forty times a
   day to be the first thing on the screen. So the tiers are the sections, and the
   situation is a heading inside them.

   Three fields do three different jobs and none of them substitutes for another:

     rom   the standard romanization. It is here to be typed into Papago and to be
           matched against signage, and for nothing else.
     say   what to actually make with your mouth, read exactly as spelled. The stress
           is marked with *asterisks* rather than CAPITALS — lib/phrases.js turns each
           marked run into a span the stylesheet paints in the accent, which is legible
           at a glance in a way shouting is not. Every row carries at least one mark and
           check-data.mjs fails if one does not.

           THIS COLUMN IS NOT ROMANIZATION AND IS NOT TO BE CORRECTED. It is one
           person's phonetic spelling, tuned by saying the words out loud until each row
           came out right, for a mouth that reads English. Accuracy to Korean phonology
           is the one thing it does not optimise for, and "fixing" it toward that is how
           you get `jweh-song-ham-nee-da` — which is genuinely closer to 죄송합니다 and
           which nobody can pronounce. It was `jay-SONG-HAM-nee-da` and it is again.
           A row that is nearer the real sound and unreadable aloud is a broken row.
           `rom` is where the correct spelling lives; leave `say` to its author.
     alt   search synonyms, never displayed. The word you thought of is rarely the word
           in the "Meaning" column: you think "bill", the sheet says "Check, please".

   `hear:true` marks the other direction — what a counter says to you. Those rows are
   collapsed behind one control per group, because recognising eight sentences is a
   different job from producing them and mixing the two doubles the height of the page.

   `ko` is deliberately present and deliberately empty. This sheet ships romanization
   only, which makes it a study sheet rather than something you can point at: you cannot
   show "gyesanhae juseyo" to anyone. Adding hangul later is then a rendering change and
   a fill-in-the-column job, not a re-entry of every row — which is the whole reason the
   field is here at all. check-data.mjs allows it empty and rejects hangul anywhere else. */

export const TIERS = [
  { id:"daily", label:"Every day",     note:"Ten. Learn these and the rest is a lookup." },
  { id:"trip",  label:"This trip",     note:"The counters you will actually stand at." },
  { id:"rare",  label:"If it comes up", note:"Here so it is not somewhere else." },
];

/* Order here is the order on the page and the order of the jump bar. */
export const GROUPS = [
  { id:"basics", tier:"daily", label:"Basics" },
  { id:"food",   tier:"trip",  label:"Food" },
  { id:"cafe",   tier:"trip",  label:"Cafe" },
  { id:"shops",  tier:"trip",  label:"Shops" },
  { id:"taxi",   tier:"trip",  label:"Taxi" },
  { id:"money",  tier:"trip",  label:"Money" },
  { id:"help",   tier:"rare",  label:"Help" },
  { id:"more",   tier:"rare",  label:"More" },
];

export const PHRASES = [
  /* ---- basics: every day ---- */
  { id:"hello", group:"basics", en:"Hello", rom:"annyeonghaseyo",
    say:"ahn-*young*-ha-say-yo", alt:["hi","good morning","greeting"], ko:"" },
  { id:"thanks", group:"basics", en:"Thank you", rom:"gamsahamnida",
    say:"*kahm*-sah-*ham*-nee-da", alt:["thanks","cheers","grateful"], ko:"" },
  { id:"sorry", group:"basics", en:"Sorry / excuse me", rom:"joesonghamnida",
    say:"*jay*-song-*ham*-nee-da", alt:["apologise","apologize","pardon","my bad","squeeze past"], ko:"" },
  { id:"yeogiyo", group:"basics", en:"Excuse me! (calling staff over)", rom:"yeogiyo",
    say:"*yaw*-gee-yo", alt:["waiter","server","order","call staff","hey","attention"], ko:"" },
  { id:"yes", group:"basics", en:"Yes", rom:"ne", say:"*neh*", alt:["yeah","ok","correct"], ko:"" },
  { id:"no", group:"basics", en:"No", rom:"aniyo", say:"*ah*-nee-yo", alt:["nope","nah"], ko:"" },
  { id:"thisone", group:"basics", en:"This one, please", rom:"igeo juseyo",
    say:"*ee*-guh joo-*say*-yo", alt:["order","point at it","give me this","that one"], ko:"" },
  { id:"howmuch", group:"basics", en:"How much is it?", rom:"eolmayeyo",
    say:"ol-*mah*-yay-yo", alt:["price","cost","how much"], ko:"" },
  { id:"toilet", group:"basics", en:"Where's the bathroom?", rom:"hwajangsil eodiyeyo",
    say:"*hwa*-jang-*seel* oh-dee-*yay*-yo", alt:["toilet","restroom","loo","wc","bathroom"], ko:"" },
  { id:"okay", group:"basics", en:"It's okay / no thanks", rom:"gwaenchanayo",
    say:"*gwen*-cha-na-yo", alt:["fine","all good","never mind","no thank you","i'm good"], ko:"" },

  /* ---- food ---- */
  { id:"menu", group:"food", en:"Menu, please", rom:"menyupan juseyo",
    say:"*meh*-nyoo-pahn joo-*say*-yo", alt:["menu"], ko:"" },
  { id:"fortwo", group:"food", en:"Table for two", rom:"du myeongieyo",
    say:"doo *myung*-ee-eh-yo", alt:["two people","party of two","table","seats"], ko:"" },
  { id:"booked", group:"food", en:"I have a reservation", rom:"yeyakaesseoyo",
    say:"*yeh*-yah-*kess*-oh-yo", alt:["reservation","booking","booked"], ko:"" },
  { id:"spicy", group:"food", en:"Is this spicy?", rom:"igeo maewoyo",
    say:"*ee*-guh *may*-oo-oh-yo", alt:["spicy","hot","chilli","chili"], ko:"" },
  { id:"notspicy", group:"food", en:"Please make it not spicy", rom:"an maepge haejuseyo",
    say:"ahn *mep*-geh *heh*-joo-say-yo", alt:["mild","less spicy","not spicy"], ko:"" },
  { id:"onemore", group:"food", en:"One more, please", rom:"hana deo juseyo",
    say:"*hah*-nah daw joo-*say*-yo", alt:["another","again","one more","refill"], ko:"" },
  { id:"banchan", group:"food", en:"More side dishes, please", rom:"banchan deo juseyo",
    say:"*bahn*-chahn daw joo-*say*-yo", alt:["sides","side dishes","banchan","kimchi","refill"], ko:"" },
  { id:"recommend", group:"food", en:"What do you recommend?", rom:"chucheonhae juseyo",
    say:"*choo*-chun-heh joo-*say*-yo", alt:["recommend","suggestion","best","popular","signature"], ko:"" },
  { id:"whatisit", group:"food", en:"What is this?", rom:"igeo mwoyeyo",
    say:"*ee*-guh *mwuh*-yay-yo", alt:["what is it","unknown dish","identify"], ko:"" },
  { id:"bill", group:"food", en:"Check, please", rom:"gyesanhae juseyo",
    say:"geh-*sahn*-heh joo-*say*-yo", alt:["bill","check","pay","cheque","tab","settle up"], ko:"" },
  { id:"togo", group:"food", en:"To go, please", rom:"pojanghae juseyo",
    say:"poh-*jahng*-heh joo-*say*-yo", alt:["takeaway","take away","takeout","box","leftovers","wrap"], ko:"" },
  { id:"beforeeating", group:"food", en:"Said before eating", rom:"jal meokgetseumnida",
    say:"jahl *muck*-get-*sum*-nee-da", alt:["bon appetit","grace","start eating","tuck in"], ko:"" },
  { id:"aftereating", group:"food", en:"Said after eating", rom:"jal meogeotseumnida",
    say:"jahl *maw*-gut-*sum*-nee-da", alt:["thanks for the meal","finished","that was good"], ko:"" },
  { id:"h-howmany", group:"food", hear:true, en:"How many people?", rom:"myeot bunisseyo",
    say:"myut *boo*-nee-say-yo", alt:["how many","party size"], ko:"" },
  { id:"h-finished", group:"food", hear:true, en:"Are you finished?", rom:"da deusyeosseoyo",
    say:"dah *doo*-shyoss-oh-yo", alt:["done","finished","clear the plates"], ko:"" },
  { id:"h-elsefood", group:"food", hear:true, en:"Anything else?", rom:"deo piryohan geo isseoyo",
    say:"daw *pee*-ryo-hahn guh *ee*-soh-yo", alt:["anything else","need more"], ko:"" },

  /* ---- cafe ---- */
  { id:"iced", group:"cafe", en:"Iced americano", rom:"aiseu amerikano",
    say:"*ah*-ee-suh ah-*meh*-ree-*kah*-no", alt:["coffee","americano","iced coffee","cold brew"], ko:"" },
  { id:"hotone", group:"cafe", en:"A hot one, please", rom:"ttatteutan geo juseyo",
    say:"*tah*-tuh-tahn guh joo-*say*-yo", alt:["hot","warm","not iced"], ko:"" },
  { id:"forhere", group:"cafe", en:"For here", rom:"yeogiseo meogeulgeyo",
    say:"*yaw*-gee-suh *maw*-gul-geh-yo", alt:["eat in","dine in","stay","sit in"], ko:"" },
  { id:"cafetogo", group:"cafe", en:"To go", rom:"pojangiyo",
    say:"poh-*jahng*-ee-yo", alt:["takeaway","takeout","to go","cup"], ko:"" },
  { id:"h-forhere", group:"cafe", hear:true, en:"For here or to go?", rom:"yeogiseo deuseyo? gajyeogaseyo?",
    say:"*yaw*-gee-suh *duh*-say-yo? gah-*jyaw*-gah-say-yo?", alt:["for here","to go","eat in"], ko:"" },
  { id:"h-size", group:"cafe", hear:true, en:"What size?", rom:"saijeu eotteoke deurilkkayo",
    say:"*sigh*-juh uh-*tuh*-keh duh-*reel*-kah-yo", alt:["size","large","small","regular"], ko:"" },
  { id:"h-points", group:"cafe", hear:true, en:"Do you have a points card?", rom:"jeongnip haseyo",
    say:"*jung*-neep *hah*-say-yo", alt:["points","stamp","membership","loyalty"], ko:"" },

  /* ---- shops ---- */
  { id:"discount", group:"shops", en:"Any chance of a discount?", rom:"kkakka juseyo",
    say:"*kah*-kah joo-*say*-yo", alt:["discount","cheaper","haggle","bargain","deal","knock off"], ko:"" },
  { id:"cashonly", group:"shops", en:"Cash only?", rom:"hyeongeumman doenayo",
    say:"*hyun*-goom-mahn *dwen*-ah-yo", alt:["cash","cash only","card not accepted"], ko:"" },
  { id:"tryon", group:"shops", en:"Can I try it on?", rom:"ibeo bwado dwaeyo",
    say:"*ee*-buh *bwah*-doh dweh-yo", alt:["try on","fitting room","changing room","fit"], ko:"" },
  { id:"twoofthese", group:"shops", en:"Two of these, please", rom:"igeo du gae juseyo",
    say:"*ee*-guh doo geh joo-*say*-yo", alt:["two","quantity","a couple","pair"], ko:"" },
  { id:"h-bag", group:"shops", hear:true, en:"Would you like a bag?", rom:"bongtu deurilkkayo",
    say:"*bong*-too duh-*reel*-kah-yo", alt:["bag","carrier","sack"], ko:"" },
  { id:"h-cashorcard", group:"shops", hear:true, en:"Cash or card?", rom:"hyeongeumiseyo kadeuseyo",
    say:"*hyun*-goo-mee-say-yo *kah*-duh-say-yo", alt:["cash","card","how are you paying"], ko:"" },

  /* ---- taxi ---- */
  { id:"takemehere", group:"taxi", en:"Please take me here (point at the map)", rom:"yeogiro gajuseyo",
    say:"*yaw*-gee-roh gah-*joo*-say-yo", alt:["taxi","destination","go here","driver","address"], ko:"" },
  { id:"howlong", group:"taxi", en:"How long will it take?", rom:"eolmana geollyeoyo",
    say:"ol-*mah*-nah *gaw*-lyaw-yo", alt:["how long","time","duration","eta","arrive"], ko:"" },
  { id:"dropoff", group:"taxi", en:"Please let me off here", rom:"yeogiseo naeryeojuseyo",
    say:"*yaw*-gee-suh *neh*-ryaw-joo-say-yo", alt:["stop here","drop off","get out","pull over"], ko:"" },
  { id:"callkakao", group:"taxi", en:"Please call a Kakao taxi", rom:"kakao taeksi bulleojuseyo",
    say:"*kah*-kah-oh *tayk*-see *bool*-law-joo-say-yo", alt:["taxi","kakao t","cab","uber","hail"], ko:"" },
  { id:"h-whereto", group:"taxi", hear:true, en:"Where to?", rom:"eodiro mosilkkayo",
    say:"oh-dee-roh *moh*-sheel-kah-yo", alt:["where","destination","where are you going"], ko:"" },

  /* ---- money ---- */
  { id:"cardok", group:"money", en:"Do you take card?", rom:"kadeu doenayo",
    say:"*kah*-duh *dwen*-ah-yo", alt:["card","credit","visa","payment","tap","contactless"], ko:"" },
  { id:"receipt", group:"money", en:"Receipt, please", rom:"yeongsujeung juseyo",
    say:"*yung*-soo-jung joo-*say*-yo", alt:["receipt","invoice","proof"], ko:"" },

  /* ---- help ---- */
  { id:"help", group:"help", en:"Help me!", rom:"dowajuseyo",
    say:"*doh*-wah-joo-say-yo", alt:["help","emergency","sos"], ko:"" },
  { id:"hospital", group:"help", en:"Where's the hospital?", rom:"byeongwon eodiyeyo",
    say:"*byung*-wohn oh-dee-*yay*-yo", alt:["hospital","doctor","er","emergency room","clinic","a&e"], ko:"" },
  { id:"police", group:"help", en:"Please call the police", rom:"gyeongchal bulleojuseyo",
    say:"*gyung*-chahl *bool*-law-joo-say-yo", alt:["police","112","emergency","crime"], ko:"" },
  { id:"passport", group:"help", en:"I lost my passport", rom:"yeogwon ireobeoryeosseoyo",
    say:"*yaw*-gwohn *ee*-raw-buh-*ryaw*-soh-yo", alt:["passport","lost","stolen","embassy"], ko:"" },
  { id:"ithurts", group:"help", en:"It hurts", rom:"apayo",
    say:"*ah*-pah-yo", alt:["pain","hurts","sore","ouch","ache"], ko:"" },
  { id:"gentler", group:"help", en:"A little more gently, please", rom:"jogeumman deo salsallyo",
    say:"*joh*-goom-mahn daw *sahl*-sahl-lyo", alt:["gentle","softer","massage","spa","scrub","easy"], ko:"" },

  /* ---- more ---- */
  { id:"english", group:"more", en:"Do you speak English?", rom:"yeongeo haseyo",
    say:"*yung*-uh *ha*-say-yo", alt:["english","speak english"], ko:"" },
  { id:"nokorean", group:"more", en:"I don't speak Korean", rom:"hangugeo motaeyo",
    say:"*hahn*-goo-guh *moh*-tay-yo", alt:["no korean","don't speak","cannot speak"], ko:"" },
  { id:"onemoment", group:"more", en:"One moment", rom:"jamsimanyo",
    say:"*jahm*-shee-*mahn*-yo", alt:["wait","hold on","just a second","one moment","hang on"], ko:"" },
  { id:"whattime", group:"more", en:"What time is it?", rom:"myeot siyeyo",
    say:"myut *see*-yay-yo", alt:["time","clock","what time"], ko:"" },
  { id:"station", group:"more", en:"Where's the train station?", rom:"gichayeok eodiyeyo",
    say:"*gee*-chah-*yock* oh-dee-*yay*-yo", alt:["station","train","ktx","subway","platform"], ko:"" },
  { id:"gate", group:"more", en:"Which gate number?", rom:"myeot beon geiteuyeyo",
    say:"myut bun *geh*-ee-tuh-*yay*-yo", alt:["gate","boarding","flight","airport"], ko:"" },
  { id:"idp", group:"more", en:"I have an international driving permit", rom:"gukje unjeon myeonheojeung isseoyo",
    say:"*gook*-jeh *oon*-jun *myawn*-huh-jung ee-*soh*-yo", alt:["driving","licence","license","rental car","idp","permit","hire car"], ko:"" },
  { id:"confirmbooking", group:"more", en:"I'd like to confirm my reservation", rom:"yeyak hwaginhago sipeoyo",
    say:"*yeh*-yahk *hwa*-gin-hah-go *ship*-oh-yo", alt:["confirm","reservation","appointment","booking","clinic"], ko:"" },
];

/* Two counting systems, and only one of them is worth learning whole.

   Sino-Korean does money, dates, minutes and phone numbers, which is nearly everything
   you will hear said at you, so it is here in full up to 만. Native Korean does people
   and things, and in practice you will use it for one sentence — "two, please" — so it
   stops at four rather than filling a column you will never read.

   These are the syllables lib/won.js assembles a price out of; check-data.mjs pins the
   two tables together so a fixed typo here cannot leave the price reader saying the old
   thing. */
export const NUMBERS = [
  { n:1,     sino:"il",    sinoSay:"eel",   nat:"hana", natSay:"hah-nah" },
  { n:2,     sino:"i",     sinoSay:"ee",    nat:"dul",  natSay:"dool" },
  { n:3,     sino:"sam",   sinoSay:"sahm",  nat:"set",  natSay:"set" },
  { n:4,     sino:"sa",    sinoSay:"sah",   nat:"net",  natSay:"net" },
  { n:5,     sino:"o",     sinoSay:"oh" },
  { n:6,     sino:"yuk",   sinoSay:"yook" },
  { n:7,     sino:"chil",  sinoSay:"cheel" },
  { n:8,     sino:"pal",   sinoSay:"pahl" },
  { n:9,     sino:"gu",    sinoSay:"goo" },
  { n:10,    sino:"sip",   sinoSay:"sheep" },
  { n:100,   sino:"baek",  sinoSay:"bek" },
  { n:1000,  sino:"cheon", sinoSay:"chun" },
  { n:10000, sino:"man",   sinoSay:"mahn" },
];

/* What the price reader offers before you have typed anything: a coffee, a lunch, a
   dinner for two. Enough to show what the control does without making you think of a
   number first. */
export const PRICE_PRESETS = [4500, 15000, 68000];
