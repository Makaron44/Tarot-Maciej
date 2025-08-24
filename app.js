'use strict';

/* =============== utils =============== */
const plSlug = (s) => (s || '')
  .toLowerCase()
  .replaceAll('ą','a').replaceAll('ć','c').replaceAll('ę','e').replaceAll('ł','l')
  .replaceAll('ń','n').replaceAll('ó','o').replaceAll('ś','s').replaceAll('ż','z').replaceAll('ź','z')
  .replaceAll(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const randBool = () => Math.random() < 0.5;
const $ = (sel) => document.querySelector(sel);

/* =============== DOM refs =============== */
const elHeader  = $('header');
const elBoard   = $('#board');
const elReading = $('#reading');
const elSpread  = $('#spread');
const elReversed= $('#reversed');
const btnShuffle= $('#shuffle');
const btnDraw   = $('#draw');
const btnReset  = $('#reset');
const btnCopy   = $('#copy');

// Wgrywanie talii
const btnDeckFolder = $('#btnDeckFolder');
const btnDeckFiles  = $('#btnDeckFiles');
const inpFolder     = $('#deckFolder');
const inpFiles      = $('#deckFiles');
const btnClearDeck  = $('#clearDeck');
const deckStatus    = $('#deckStatus');

// Panel informacji o talii
const deckInfoBtn     = $('#deckInfoBtn');
const deckInfo        = $('#deckInfo');
const deckInfoClose   = $('#deckInfoClose');
const deckInfoSummary = $('#deckInfoSummary');
const deckInfoList    = $('#deckInfoList');

/* =============== obrazy: domyślne i wgrywane =============== */
const IMAGE_FOLDER = 'images';
const ASSET_VERSION = '1'; // podbij gdy podmienisz statyczne obrazki

// mapa: karta -> objectURL z wgranych plików
// oryginalne pliki (File) – potrzebne do zapisu w IndexedDB
const customDeck = new Map(); // 'major-0'..'major-21', 'minor-Buławy-A' itd.
const customFiles = new Map(); // key -> File
const keyForCard = (c) => c.arcana==='Major' ? `major-${c.id}` : `minor-${c.suit}-${c.rank}`;

function defaultImagePath(card){
  if(card.arcana === 'Major'){
    const fname = `major_${String(card.id).padStart(2,'0')}_${plSlug(card.name)}.png`;
    return `./${IMAGE_FOLDER}/${fname}?v=${ASSET_VERSION}`;
  }
  const suit = plSlug(card.suit);
  const rmap = { 'A':'a','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'10',
    'Paź':'paz','Rycerz':'rycerz','Królowa':'krolowa','Król':'krol' };
  return `./${IMAGE_FOLDER}/minor_${suit}_${rmap[card.rank]}.png?v=${ASSET_VERSION}`;
}
function imageFor(card){ return customDeck.get(keyForCard(card)) || defaultImagePath(card); }

/* =============== rozpoznawanie nazw plików (PL/EN) =============== */
const suitSyn = new Map(Object.entries({
  'bulawy':'Buławy','wands':'Buławy','wand':'Buławy',
  'kielichy':'Kielichy','cups':'Kielichy','cup':'Kielichy','puchary':'Kielichy',
  'miecze':'Miecze','swords':'Miecze','sword':'Miecze',
  'denary':'Denary','pentacles':'Denary','pentacle':'Denary','coins':'Denary','coin':'Denary','pentakle':'Denary'
}));
const rankSyn = new Map(Object.entries({
  'a':'A','as':'A','ace':'A',
  '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'10',
  'paz':'Paź','page':'Paź','valet':'Paź',
  'rycerz':'Rycerz','knight':'Rycerz',
  'krolowa':'Królowa','queen':'Królowa',
  'krol':'Król','king':'Król'
}));
const MAJOR_NAMES = [
  [0,'glupiec','fool'],[1,'mag','magician'],[2,'kaplanka','high-priestess'],[3,'cesarzowa','empress'],
  [4,'cesarz','emperor'],[5,'kaplan','hierophant'],[6,'kochankowie','lovers'],[7,'rydwan','chariot'],
  [8,'sila','strength'],[9,'pustelnik','hermit'],[10,'kolofortuny','wheel-of-fortune'],[11,'sprawiedliwosc','justice'],
  [12,'wisielec','hanged-man'],[13,'smierc','death'],[14,'umiarkowanie','temperance'],[15,'diabel','devil'],
  [16,'wieza','tower'],[17,'gwiazda','star'],[18,'ksiezyc','moon'],[19,'slonce','sun'],
[20,'sadostateczny','judgement'],[21,'swiat','world']
];
const majorNameToId = new Map(); for(const [id,pl,en] of MAJOR_NAMES){ majorNameToId.set(pl,id); majorNameToId.set(en,id); }

function romanToInt(str){
  const map = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
  let s = (str||'').toUpperCase(), i=0, res=0;
  while(i < s.length){
    if(i+1 < s.length && map[s.slice(i,i+2)]){ res += map[s.slice(i,i+2)]; i += 2; }
    else { res += map[s[i]] || 0; i++; }
  }
  return res || null;
}

function mapFilesToDeck(fileList){
  // oczyść poprzednie
  for(const url of customDeck.values()) try{ URL.revokeObjectURL(url); }catch{}
  customDeck.clear();
  customFiles.clear();

  const files = Array.from(fileList || []);
  for(const f of files){
    if(!/\.(png|jpg|jpeg|webp|heic)$/i.test(f.name)) continue;

    const url = URL.createObjectURL(f);
    const stem = plSlug(f.name.replace(/\.(png|jpg|jpeg|webp|heic)$/i,''));
    const parts = stem.split('-');

    // Minor: suit + rank
    let suit=null, rank=null;
    for(const t of parts){ if(suitSyn.has(t)) suit = suitSyn.get(t); if(rankSyn.has(t)) rank = rankSyn.get(t); }
    if(suit && rank){
      const k = `minor-${suit}-${rank}`;
      if(!customDeck.has(k)){ customDeck.set(k, url);customFiles.set(k, f); continue; }
    }

    // Major: numer arab., rzymski, nazwa
    let id = null;
    const mNum = stem.match(/\b([0-1]?\d|2[0-1])\b/); if(mNum){ id = parseInt(mNum[1],10); }
    if(id===null){ const mRom = stem.match(/\b(m|cm|d|cd|c|xc|l|xl|x|ix|v|iv|i)+\b/); if(mRom){ const val = romanToInt(mRom[0]); if(val>=0 && val<=21) id=val; } }
    if(id===null){ const norm = s => s.replace(/[-_\s]/g, '');
  const ns = norm(stem);
  for (const [name, idTry] of majorNameToId.entries()) {
    if (ns.includes(norm(name))) { id = idTry; break; } } }
    if(id!==null && id>=0 && id<=21){
      const k = `major-${id}`;
      if(!customDeck.has(k)){ customDeck.set(k, url);customFiles.set(k, f); continue; }
    }

    // nie dopasowano – zwolnij
    try{ URL.revokeObjectURL(url); }catch{}
  }

  // status w belce
  const majors = Array.from(customDeck.keys()).filter(k=>k.startsWith('major-')).length;
  const minors = Array.from(customDeck.keys()).filter(k=>k.startsWith('minor-')).length;
  const defMaj = 22 - majors, defMin = 56 - minors;
  if(deckStatus){
    deckStatus.textContent = (majors+minors)
      ? `Talia własna: ${majors}/22 Major, ${minors}/56 Minor · Domyślne: ${defMaj+defMin}`
      : 'Nie rozpoznano plików – na iOS wybierz wiele plików (Zaznacz wszystko).';
  }
}

/* =============== znaczenia =============== */
const SUIT_THEMES = {
  'Buławy': {pos:'działanie, kreatywność, pasja (Ogień)', neg:'wypalenie, impulsywność, rozproszenie energii'},
  'Kielichy': {pos:'uczucia, relacje, intuicja (Woda)', neg:'przelewanie emocji, zależność, ucieczka w fantazję'},
  'Miecze': {pos:'myślenie, komunikacja, decyzje (Powietrze)', neg:'nadmierna analiza, konflikty słowne, ostrze krytyki'},
  'Denary': {pos:'materia, praca, zdrowie, pieniądze (Ziemia)', neg:'skąpstwo/rozrzutność, stagnacja, lęk o bezpieczeństwo'}
};
const RANK_THEMES = {
  'A':{pos:'początek i czysta esencja tematu – świeża szansa', neg:'blokada startu, rozproszenie uwagi'},
  '2':{pos:'wybór, balans dwóch opcji', neg:'chwiejność i przeciąganie decyzji'},
  '3':{pos:'rozszerzenie zasięgu, współpraca', neg:'rozminięcie oczekiwań'},
  '4':{pos:'stabilizacja i fundament', neg:'zastój lub sztywność'},
  '5':{pos:'tarcia, próba charakteru', neg:'spór dla zasady'},
  '6':{pos:'uznanie, ulga, przejście', neg:'fałszywe zwycięstwo'},
  '7':{pos:'obrona pozycji, strategia', neg:'paranoja, walka ze wszystkim'},
  '8':{pos:'tempo i zmiany w locie', neg:'chaos bez planu'},
  '9':{pos:'wytrwałość, granice', neg:'wyczerpanie, lęk'},
  '10':{pos:'kulminacja i domknięcie', neg:'przeciążenie'},
  'Paź':{pos:'nauka, ciekawość, wieści', neg:'niedojrzałość, plotka'},
  'Rycerz':{pos:'ruch, misja, impet', neg:'nierozważny pęd'},
  'Królowa':{pos:'opiekuńcza mądrość, wpływ', neg:'zawłaszczanie'},
  'Król':{pos:'odpowiedzialność, decyzja', neg:'autorytaryzm'}
};
const TUP = [
  ({r,s})=>`Esencja rangi: ${r}. Temat żywiołu: ${s}. Wybierz jeden konkret i zrób go dziś.`,
  ({r,s})=>`To moment na ${r.toLowerCase()}. W obszarze: ${s}. Zadbaj o klarowny zamiar.`,
  ({r,s})=>`Konstruktywny kierunek: ${r}. Kontekst: ${s}. Zacznij od małego kroku.`,
  ({r,s})=>`Równowaga między „chcę” a „mogę”. ${r}. W tle działa żywioł: ${s}.`
];
const TREV = [
  ({r,s})=>`Cień: ${r}. W temacie: ${s}. Zatrzymaj pęd, uprość zasady i wróć do podstaw.`,
  ({r,s})=>`Uwaga na ${r.toLowerCase()}. W sferze: ${s}. Najpierw porządek, potem ruch.`,
  ({r,s})=>`To, co trudne: ${r}. W obszarze: ${s}. Daj sobie czas i odsapnij.`,
  ({r,s})=>`Drobna korekta kursu potrzebna – ${r}. Kontekst: ${s}.`
];
const ACTIONS = [
  'Zdefiniuj jeden najbliższy krok (15–30 min) i zrób go dziś.',
  'Porozmawiaj z kimś kluczowym i upewnij się, że rozumiecie cel tak samo.',
  'Odetnij trzy rozpraszacze na 24h (powiadomienia, zbędne spotkanie…).',
  'Spisz założenia i kryterium „wystarczająco dobrze”.'
];
const QUESTIONS = [
  'Co ma największą dźwignię teraz?',
  'Jak wyglądałaby wersja o 20% prostsza?',
  'Którego lęku unikasz – i jaki byłby mikro-ruch?',
  'Jakie wsparcie możesz poprosić dziś?'
];

const MAJOR_TEXT = {
  0:{u:'Nowy początek, zaufanie do życia i ciekawość ścieżki. Zrób pierwszy krok bez nadmiaru planu – praktyka wyjaśni resztę.', r:'Brawura lub ucieczka od odpowiedzialności. Uziemij marzenie w prostym działaniu i sprawdzaj fakty.'},
  1:{u:'Świadome kierowanie energią – masz zasoby, by „zmaterializować” zamiar. Kanałuj uwagę w jednym kierunku.', r:'Rozproszenie mocy/„za dużo naraz”. Zdefiniuj jedno „dlaczego” i usuń szum.'},
  2:{u:'Cicha wiedza, intuicja i praca z symbolami. Odpowiedzi są pod powierzchnią.', r:'Zagłuszona intuicja lub sekrety. Zapytaj ciało: co czuje, gdy myślisz o tej decyzji?'},
  3:{u:'Obfitość, twórczość, pielęgnowanie wzrostu. Daj projektowi czas i troskę.', r:'Przesada w opiece albo zaniedbanie siebie. Przywróć równowagę w dawaniu/odbieraniu.'},
  4:{u:'Struktura i granice dają wolność. Klarowne zasady = spokój.', r:'Nadmierna kontrola. Poluzuj śrubę i powierz ludziom odpowiedzialność.'},
  5:{u:'Mentor, tradycja, praktyki, które niosą. Ucz się na sprawdzonych wzorcach.', r:'Dogmatyzm lub bunt dla buntu. Dopasuj rytuały do realiów.'},
  6:{u:'Wybór zgodny z sercem i wartościami. Partnerstwo, w którym obie strony rosną.', r:'Dysonans wartości lub pokusa krótkiej drogi. Zobacz długofalowe konsekwencje.'},
  7:{u:'Wola, kierunek, ruch naprzód. Skupienie jednoczy przeciwieństwa.', r:'Pęd bez steru / nadmierna presja. Zgraj tempo z realnym paliwem.'},
  8:{u:'Łagodna siła, odwaga i przyjaźń z instynktem. Cierpliwość działa.', r:'Samokrytyka i napięcie. Wróć do oddechu i ciała.'},
  9:{u:'Wgląd i mądrość samotności. Zmniejsz hałas, aby usłyszeć serce.', r:'Izolacja bez celu. Porozmawiaj z zaufaną osobą – światło się dzieli.'},
  10:{u:'Zmiana cyklu, los rusza kołem. Elastyczność to supermoc.', r:'Opór przed nieuchronnym. Przestań trzymać to, co i tak się kończy.'},
  11:{u:'Uczciwość, równowaga, konsekwencja. Sprawy się wyrównują.', r:'Poczucie niesprawiedliwości. Zbierz pełne dane – nie tylko narrację.'},
  12:{u:'Inna perspektywa. Oddanie kontroli, by zobaczyć więcej.', r:'Stagnacja i perfekcyjne czekanie. Zrób mały, nieidealny ruch.'},
  13:{u:'Domknięcie etapu i transformacja. Miejsce robi się na nowe.', r:'Lęk przed końcem. Uznaj żal, ale nie blokuj przemiany.'},
  14:{u:'Alchemia i złoty środek. Dozuje się postęp kropla po kropli.', r:'Ekstrema i rozjazd proporcji. Wróć do rytmu/regularności.'},
  15:{u:'Światło pada na więzy i cienie – widząc je, odzyskujesz wybór.', r:'Uzależnienie od kontroli. Zamień „muszę” na świadome „chcę/nie chcę”.'},
  16:{u:'Przebudzenie, pęknięcie fasady – wchodzi prawda.', r:'Trzymanie ruin. Pozwól runąć temu, co i tak nie służy.'},
  17:{u:'Nadzieja, uzdrowienie, łagodna inspiracja. Małe kroki wystarczą.', r:'Zgaszona iskra. Zadbaj o źródła, które Cię karmią.'},
  18:{u:'Kraina snów, symbole, mgła. Ufaj intuicji i weryfikuj.', r:'Lęki się rozpraszają – porządkuj granice między wyobraźnią a faktami.'},
  19:{u:'Radość, witalność, prostota. Świeć pełnią.', r:'Przeginanie i ego. Zadbaj o regenerację i granice.'},
  20:{u:'Powołanie i decyzja. Nadszedł czas, by odpowiedzieć na zew.', r:'Surowa autoocena. Wyciągnij lekcję i idź dalej lżej.'},
  21:{u:'Integracja i domknięcie cyklu. Celebruj pełnię.', r:'Rozproszenie i brak domknięć. Dokończ to, co otwarte.'},
};

function buildMinorMeaning(suit, rank, i){
  const r = RANK_THEMES[rank], s = SUIT_THEMES[suit];
  const up  = TUP[i % TUP.length]({r:r.pos, s:s.pos});
  const rev = TREV[i % TREV.length]({r:r.neg, s:s.neg});
  const act = ACTIONS[i % ACTIONS.length];
  const q   = QUESTIONS[(i+1) % QUESTIONS.length];
  return { u:`${up} ➤ Działanie: ${act} ➤ Pytanie: ${q}.`, r:`${rev} ➤ Działanie: ${act} ➤ Pytanie: ${q}.` };
}

/* =============== talia, rozkłady, stan =============== */
const SUITS = ['Buławy','Kielichy','Miecze','Denary'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','Paź','Rycerz','Królowa','Król'];

const MAJOR = [
  [0,'Głupiec'],[1,'Mag'],[2,'Kapłanka'],[3,'Cesarzowa'],[4,'Cesarz'],[5,'Kapłan'],
  [6,'Kochankowie'],[7,'Rydwan'],[8,'Siła'],[9,'Pustelnik'],[10,'Koło Fortuny'],[11,'Sprawiedliwość'],
  [12,'Wisielec'],[13,'Śmierć'],[14,'Umiarkowanie'],[15,'Diabeł'],[16,'Wieża'],[17,'Gwiazda'],
  [18,'Księżyc'],[19,'Słońce'],[20,'Sąd Ostateczny'],[21,'Świat'],
].map(([id,name])=>({ id, name, arcana:'Major', suit:null, rank:null, keywords:[], meaning:{ u:MAJOR_TEXT[id].u, r:MAJOR_TEXT[id].r } }));

const DECK = [
  ...MAJOR,
  ...SUITS.flatMap((suit,si)=>RANKS.map((rank,ri)=>{
    const id = 22 + si*14 + ri;
    const kw = { 'Buławy':['energia','działanie','pasja'], 'Kielichy':['uczucia','intuicja','więź'],
                 'Miecze':['logika','komunikacja','decyzja'], 'Denary':['praca','zdrowie','finanse'] }[suit];
    return { id, name:`${rank} ${suit}`, arcana:'Minor', suit, rank, keywords:kw, meaning:buildMinorMeaning(suit,rank,id) };
  }))
];

const SPREADS = {
  one:{ name:'1 karta – szybka wskazówka', positions:[{label:'Wskazówka'}] },

  three:{ name:'3 karty – Przeszłość / Teraźniejszość / Przyszłość',
    positions:[{label:'Przeszłość'},{label:'Teraźniejszość'},{label:'Przyszłość'}]
  },

  celtic:{ name:'Krzyż celtycki – 10 kart',
    positions:[
      {label:'Sytuacja'},{label:'Wyzwanie'},{label:'Świadomość'},{label:'Podświadomość'},{label:'Przeszłość'},
      {label:'Przyszłość'},{label:'Ty sam/a'},{label:'Otoczenie'},{label:'Nadzieje/Obawy'},{label:'Rezultat'}
    ]
  },

  gwiazda5:{ name:'Gwiazda – 5 kart',
    positions:[
      {label:'Sytuacja'},{label:'Wyzwanie'},{label:'Rada'},{label:'Co sprzyja'},{label:'Wynik'}
    ]
  },

  podkowa7:{ name:'Podkowa – 7 kart',
    positions:[
      {label:'Przeszłość'},{label:'Teraźniejszość'},{label:'Przeszkoda'},{label:'Wsparcie'},
      {label:'Rada'},{label:'Nadzieje/Obawy'},{label:'Wynik'}
    ]
  },

  zwiazek6:{ name:'Związek – 6 kart',
    positions:[
      {label:'Ty'},{label:'Partner'},{label:'Twoje potrzeby'},{label:'Jego/jej potrzeby'},{label:'Co was łączy'},{label:'Potencjał/Wynik'}
    ]
  },

  decyzja6:{ name:'Decyzja – 6 kart (2×3 + wynik)',
    positions:[
      {label:'Opcja A – plusy'},{label:'Opcja A – minusy'},{label:'Opcja A – wynik'},
      {label:'Opcja B – plusy'},{label:'Opcja B – minusy'},{label:'Opcja B – wynik'}
    ]
  }
};
/* 2) Generator opcji w <select> (poza SPREADS!) */
function buildSpreadOptions(){
  const sel = document.getElementById('spread');
  if(!sel) return;
  sel.innerHTML = '';
  for (const [id, s] of Object.entries(SPREADS)) {
    const opt = document.createElement('option');
    opt.value = id;           // klucz: one/three/celtic/...
    opt.textContent = s.name; // etykieta widoczna
    sel.appendChild(opt);
  }
  // ustaw domyślny/ostatni wybór
  if (!state.spreadKey || !SPREADS[state.spreadKey]) state.spreadKey = 'three';
  sel.value = state.spreadKey;
}

// wywołaj raz po starcie (po zdefiniowaniu state!)
buildSpreadOptions();

const state = { deck:[], includeReversed:true, spreadKey:'three', drawn:[] };

/* =============== renderowanie =============== */
function newDeck(){ state.deck = DECK.map(c=>({...c})); shuffle(state.deck); }

function renderEmptyBoard(){
  const spread = SPREADS[state.spreadKey];
  elBoard.innerHTML = '';
  spread.positions.forEach((pos,i)=>{
    const c = document.createElement('div');
    c.className='card'; c.dataset.revealed='false';
    c.innerHTML = `
      <div class="back face">
        <span class="pos-index">${i+1}. ${pos.label}</span>
        <div class="sigil">✶</div>
      </div>
      <div class="front face"></div>`;
    elBoard.appendChild(c);
  });
}

function renderCard(item){
  const {card,reversed,positionIndex} = item;
  const pos = SPREADS[state.spreadKey].positions[positionIndex];
  const node = document.createElement('div');
  node.className='card'; node.dataset.revealed='false'; node.dataset.id = card.id;

  const front = document.createElement('div');
  front.className='front face';
  front.innerHTML = `
    <div class="name">${card.name}${reversed?' (odwrócona)':''}</div>
    <div class="img"><img alt="${card.name}" src="${imageFor(card)}" loading="lazy"></div>
    <div class="body">
      <div><span class="badge">${card.arcana}${card.suit? ' · '+card.suit : ''}</span></div>
      <p class="kw" style="margin-top:8px">Słowa klucze: ${card.keywords.join(', ')}</p>
      <p style="margin-top:8px">${reversed?card.meaning.r:card.meaning.u}</p>
    </div>
    <div class="footer"><span>${pos.label}</span><span>kliknij, aby odwrócić</span></div>`;

  const back = document.createElement('div');
  back.className='back face';
  back.innerHTML = `
    <span class="pos-index">${positionIndex+1}. ${pos.label}</span>
    <div class="sigil">✶</div>
    ${reversed?'<span class="rev">odwr.</span>':''}
  `;

  // fallback, gdy obrazka brak
  const img = front.querySelector('img');
  img.addEventListener('error', ()=>{
    console.warn('Brak obrazka:', img.src);
    const wrap = front.querySelector('.img'); wrap.classList.add('no-art'); img.remove();
  });

  node.appendChild(back); node.appendChild(front);
  node.addEventListener('click', ()=>{ node.dataset.revealed = node.dataset.revealed==='true' ? 'false':'true'; });
  return node;
}

function draw(){
  const spread = SPREADS[state.spreadKey];
  state.drawn = []; elBoard.innerHTML='';
  for(let i=0;i<spread.positions.length;i++){
    if(state.deck.length===0) newDeck();
    const card = state.deck.shift();
    const reversed = state.includeReversed ? randBool() : false;
    const item = { card, reversed, positionIndex:i };
    state.drawn.push(item); elBoard.appendChild(renderCard(item));
  }
  updateReading();
}

/* =============== interpretacja (redukcja powtórek) =============== */
function dedupe(lines){
  const seen = new Map();
  return lines.map((L, idx)=>{
    const key = (L.text || '').slice(0,80).toLowerCase();
    if(seen.has(key)){
      const first = seen.get(key);
      L.text = `Ta karta wzmacnia wątek z pozycji ${first+1} („${lines[first].pos}”). ` + L.text;
    }else seen.set(key, idx);
    return L;
  });
}

function updateReading(){
  const spread = SPREADS[state.spreadKey];
  const lines = state.drawn.map(({card,reversed,positionIndex},i)=>({
    pos: spread.positions[positionIndex].label,
    title: `${i+1}. ${spread.positions[positionIndex].label}`,
    name: card.name + (reversed?' (odwr.)':''),
    meta: `${card.arcana}${card.suit? ' · '+card.suit: ''}`,
    keywords: card.keywords,
    text: reversed? card.meaning.r : card.meaning.u
  }));
  const merged = dedupe(lines);
  elReading.innerHTML = merged.map(l=>`
    <div class="reading-item">
      <div class="kicker">${l.title} · <span class="meta">${l.meta}</span></div>
      <div class="title">${l.name}</div>
      <div class="meta">Słowa klucze: ${l.keywords.join(', ')}</div>
      <div style="margin-top:6px">${l.text}</div>
    </div>`).join('');
  try{ localStorage.setItem('tarot:last', JSON.stringify({when:new Date().toISOString(), spread:spread.name, lines:merged})); }catch{}
}

function copyReading(){
  const spreadName = SPREADS[state.spreadKey].name;
  const text = [
    `Rozkład: ${spreadName}`,
    ...state.drawn.map(({card,reversed,positionIndex},i)=>{
      const pos = SPREADS[state.spreadKey].positions[positionIndex].label;
      const meaning = reversed? card.meaning.r : card.meaning.u;
      return `${i+1}. ${pos}: ${card.name}${reversed?' (odwr.)':''} — ${meaning}`;
    })
  ].join('\n');
  navigator.clipboard.writeText(text).then(()=>{
    if(btnCopy){ btnCopy.textContent='Skopiowano ✔'; setTimeout(()=>btnCopy.textContent='Kopiuj opis',1500); }
  }).catch(()=> alert('Nie udało się skopiować.'));
}

/* =============== scroll & sticky header =============== */
function setHeaderHeightVar(){
  const h = elHeader?.getBoundingClientRect().height || 64;
  document.documentElement.style.setProperty('--header-h', `${Math.round(h)}px`);
}
function scrollToBoard(){
  const headerH = elHeader?.getBoundingClientRect().height || 64;
  const y = elBoard.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: y, behavior: 'smooth' });
}
let lastY = window.scrollY, headerHidden = false;
function onScrollDir(){
  const y  = window.scrollY, dy = y - lastY; lastY = y;
  const headerH = elHeader?.getBoundingClientRect().height || 64;
  const beyondHeader = y > headerH + 10;
  if (dy > 5 && beyondHeader && !headerHidden){ document.body.classList.add('scrolldown'); headerHidden = true; }
  else if (dy < -5 && headerHidden){ document.body.classList.remove('scrolldown'); headerHidden = false; }
}
// --- IndexedDB helpers ---
function openTarotDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open('tarot', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('deckFiles')){
        db.createObjectStore('deckFiles', { keyPath: 'key' }); // {key, name, blob}
      }
      if(!db.objectStoreNames.contains('meta')){
        db.createObjectStore('meta', { keyPath: 'k' });       // {k:'hasSavedDeck', v:true/false}
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// zamiana requestu IDB -> Promise
function idb(req){
  return new Promise((resolve, reject)=>{
    req.onsuccess = ()=> resolve(req.result);
    req.onerror   = ()=> reject(req.error);
  });
}
async function saveDeckToIDB(){
  try{
    if(!customFiles.size){
      alert('Najpierw wczytaj własną talię (folder/pliki).');
      return;
    }
    const db = await openTarotDB();
    const tx = db.transaction(['deckFiles','meta'], 'readwrite');
    const filesStore = tx.objectStore('deckFiles');

    // wyczyść poprzedni zapis
    await idb(filesStore.clear());

    let count = 0;
    for(const [key, file] of customFiles.entries()){
      await idb(filesStore.put({ key, name: file.name, blob: file }));
      count++;
    }
    await idb(tx.objectStore('meta').put({ k:'hasSavedDeck', v:true }));
    await new Promise(res=> tx.oncomplete = res);

    if(deckStatus) deckStatus.textContent = `Zapisano w przeglądarce: ${count} plików.`;
    alert('Talia zapisana offline. Przy następnym uruchomieniu załaduje się automatycznie.');
  }catch(e){
    console.warn('saveDeckToIDB error', e);
    alert('Nie udało się zapisać talii (quota/zezwolenia).');
  }
}
// (e) Wczytaj zapisaną talię z IndexedDB
async function loadDeckFromIDB(auto = false){
  try{
    const db = await openTarotDB();

    // jeśli auto, sprawdź flagę czy w ogóle coś było zapisane
    if (auto){
      const metaStore = db.transaction('meta').objectStore('meta');
      const flag = await idb(metaStore.get('hasSavedDeck'));
      if (!flag || !flag.v) return; // brak zapisu – wyjdź cicho
    }

    const filesStore = db.transaction('deckFiles').objectStore('deckFiles');
    const rows = await idb(filesStore.getAll()); // [{key, name, blob}, ...]

    // wyczyść aktualną talię i URLe
    for (const url of customDeck.values()){
      try { URL.revokeObjectURL(url); } catch {}
    }
    customDeck.clear();
    customFiles.clear();

    // odtwórz mapy z zapisanych blobów
    let majors = 0, minors = 0;
    for (const row of (rows || [])){
      const blob = row.blob;
      const url  = URL.createObjectURL(blob);        // do renderu
      customDeck.set(row.key, url);
      // z blobu tworzymy File, aby można było ponownie zapisać talię
      customFiles.set(row.key, new File([blob], row.name, { type: blob.type || 'image/*' }));
      if (row.key.startsWith('major-')) majors++; else if (row.key.startsWith('minor-')) minors++;
    }

    // status w belce
    if (deckStatus){
      const defMaj = 22 - majors, defMin = 56 - minors;
      deckStatus.textContent = rows?.length
        ? `Talia (IDB): ${majors}/22 Major, ${minors}/56 Minor · Domyślne: ${defMaj+defMin}`
        : 'Brak zapisanej talii.';
    }

    // odśwież UI
    if (state.drawn.length){ draw(); } else { renderEmptyBoard(); }

  }catch(err){
    console.warn('loadDeckFromIDB error', err);
  }
}
function guessMime(name){
  const ext = name.toLowerCase().split('.').pop();
  return ext === 'png' ? 'image/png'
       : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
       : ext === 'webp' ? 'image/webp'
       : 'application/octet-stream';
}

// Wczytanie talii z ZIP (plik z inputa)
async function loadZipDeck(file, {autoSave=true} = {}){
  try{
    if(!window.JSZip){ alert('Brak JSZip – sprawdź <script> w index.html.'); return; }
    const zip = await JSZip.loadAsync(file);

    const files = [];
    const entries = Object.values(zip.files);

    // iterujemy po plikach w zipie (pomijamy katalogi)
    for (const entry of entries){
      if(entry.dir) continue;
      const base = entry.name.split('/').pop(); // nazwa bez ścieżki
      const lower = base.toLowerCase();
      if(!/\.(png|jpg|jpeg|webp|heic)$/.test(lower)) continue;

      const blob = await entry.async('blob');
      const f = new File([blob], lower, { type: blob.type || guessMime(lower) });
      files.push(f);
    }

    if(!files.length){
      alert('ZIP nie zawiera obrazków (.png/.jpg/.jpeg/.webp/.heic).');
      return;
    }

    // używamy istniejącej logiki mapowania nazw -> kart
    mapFilesToDeck(files);

    // (opcjonalnie) auto-zapis do IndexedDB
    if(autoSave && typeof saveDeckToIDB === 'function'){
      await saveDeckToIDB();
    }

    // odśwież UI
    if(state.drawn.length){ draw(); } else { renderEmptyBoard(); }

  }catch(err){
    console.warn('loadZipDeck error', err);
    alert('Nie udało się wczytać ZIP. Upewnij się, że to poprawny plik.');
  }
}


/* =============== Panel: Szczegóły talii =============== */
function computeDeckStats(){
  let customMajor=0, customMinor=0;
  const items = DECK.map(c=>{
    const isCustom = customDeck.has(keyForCard(c));
    if(isCustom){ c.arcana==='Major' ? customMajor++ : customMinor++; }
    return { name:c.name, arcana:c.arcana, suit:c.suit, isCustom };
  });
  const usedNow = state.drawn.map(({card})=>{
    const isCustom = customDeck.has(keyForCard(card));
    return { name:card.name, isCustom };
  });
  return {
    customMajor, customMinor,
    defaultMajor: 22 - customMajor, defaultMinor: 56 - customMinor,
    items, usedNow
  };
}
function renderDeckInfo(filter='all'){
  const s = computeDeckStats();
  const totalCustom  = s.customMajor + s.customMinor;
  const totalDefault = s.defaultMajor + s.defaultMinor;

  if(deckInfoSummary){
    deckInfoSummary.innerHTML = `
      <div>Wczytane własne: <b>${s.customMajor}/22</b> Major, <b>${s.customMinor}/56</b> Minor (łącznie <b>${totalCustom}/78</b>).</div>
      <div>Domyślne w użyciu: <b>${s.defaultMajor}/22</b> Major, <b>${s.defaultMinor}/56</b> Minor (łącznie <b>${totalDefault}/78</b>).</div>
      ${state.drawn.length ? `<div>W rozkładzie teraz: ${
        s.usedNow.map(u => `${u.isCustom?'🟢':'🟦'} ${u.name}`).join(', ')
      }</div>` : ''}`;
  }
  const list = s.items.filter(it => filter==='all' ? true : (filter==='custom' ? it.isCustom : !it.isCustom));
  if(deckInfoList){
    deckInfoList.innerHTML = list.map(it=>`
      <div class="cardrow">
        <div class="title">${it.name}</div>
        <div class="src">${it.arcana}${it.suit ? ' · '+it.suit : ''} — źródło: ${it.isCustom ? 'własna' : 'domyślna'}</div>
      </div>
    `).join('');
  }
  if(deckInfo){ deckInfo.hidden = false; deckInfo.classList.add('show'); }
}

/* =============== events =============== */
if(elSpread)   elSpread.addEventListener('change', e=>{ state.spreadKey = e.target.value; renderEmptyBoard(); });
if(elReversed) elReversed.addEventListener('change', e=>{ state.includeReversed = e.target.checked; });
if(btnShuffle) btnShuffle.addEventListener('click', ()=>{ newDeck(); });
if(btnDraw)    btnDraw.addEventListener('click', ()=>{
  if(state.deck.length < SPREADS[state.spreadKey].positions.length) newDeck();
  draw();
  if (window.innerWidth < 920) scrollToBoard();
});
if(btnReset)   btnReset.addEventListener('click', ()=>{ newDeck(); state.drawn=[]; renderEmptyBoard(); elReading.innerHTML=''; });
if(btnCopy)    btnCopy.addEventListener('click', copyReading);
const btnLoadZip = document.getElementById('btnLoadZip');
const zipInput   = document.getElementById('zipInput');

btnLoadZip?.addEventListener('click', () => zipInput?.click());

zipInput?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  await loadZipDeck(file, { autoSave: true }); // auto zapis po imporcie
  zipInput.value = ''; // wyczyść input
});


// dopasowanie obrazka: F = cover/contain
document.addEventListener('keydown', (e)=>{ if((e.key||'').toLowerCase()==='f'){ document.body.classList.toggle('fit-contain'); } });

// wgrywanie talii: wykryj wsparcie folderów
const supportsDir = (()=>{ const i=document.createElement('input'); i.type='file'; return 'webkitdirectory' in i; })();
if(btnDeckFolder && !supportsDir){ btnDeckFolder.style.display='none'; }

if(btnDeckFolder && inpFolder){ btnDeckFolder.addEventListener('click', ()=> inpFolder.click()); inpFolder.addEventListener('change', (e)=> handleFiles(e.target.files)); }
if(btnDeckFiles  && inpFiles ){ btnDeckFiles .addEventListener('click', ()=> inpFiles .click()); inpFiles .addEventListener('change', (e)=> handleFiles(e.target.files)); }

function handleFiles(fileList){
  const files = Array.from(fileList || []);
  if(!files.length){
    if(deckStatus) deckStatus.textContent = 'Nie wybrano plików. Na iOS wybierz wiele plików (Zaznacz → Zaznacz wszystko).';
    return;
  }
  mapFilesToDeck(files);
  if(state.drawn.length){ draw(); } else { renderEmptyBoard(); }
}

if(btnClearDeck){
  btnClearDeck.addEventListener('click', ()=>{
    for(const url of customDeck.values()) try{ URL.revokeObjectURL(url); }catch{}
    customDeck.clear();
    if(deckStatus) deckStatus.textContent = 'Talia własna wyłączona (domyślne obrazki aktywne).';
    if(state.drawn.length){ draw(); } else { renderEmptyBoard(); }
  });
}
// zapisz/usuń zapisaną talię (IndexedDB)
const btnSaveDeck        = document.getElementById('saveDeck');
const btnDeleteSavedDeck = document.getElementById('deleteSavedDeck');

btnSaveDeck?.addEventListener('click', saveDeckToIDB);
btnDeleteSavedDeck?.addEventListener('click', deleteSavedDeck);


// Panel talii
if(deckInfoBtn)   deckInfoBtn.addEventListener('click', ()=> renderDeckInfo('all'));
if(deckInfoClose) deckInfoClose.addEventListener('click', ()=>{ deckInfo.classList.remove('show'); deckInfo.hidden = true; });
if(deckInfo)      deckInfo.addEventListener('click', (e)=>{ if(e.target === deckInfo){ deckInfo.classList.remove('show'); deckInfo.hidden = true; }});
document.addEventListener('change', (e)=>{ if(e.target && e.target.name==='deckFilter'){ renderDeckInfo(e.target.value); }});

// scroll listeners
window.addEventListener('load', setHeaderHeightVar);
window.addEventListener('resize', setHeaderHeightVar);
window.addEventListener('scroll', ()=>{
  if(!onScrollDir._t){
    onScrollDir._t = true;
    requestAnimationFrame(()=>{ onScrollDir(); onScrollDir._t = false; });
  }
}, { passive:true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(err => console.warn('SW register failed', err));
  });
}


/* =============== start =============== */
newDeck();
renderEmptyBoard();
loadDeckFromIDB(true);

