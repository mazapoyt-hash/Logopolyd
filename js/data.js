// ===== Board & card data (classic Monopoly, US edition) =====
const GROUP_COLORS = {
  brown: '#8b5a3c', lightblue: '#9fd5e8', pink: '#d63f8c', orange: '#f18a21',
  red: '#e02929', yellow: '#f2d21f', green: '#1fa84f', darkblue: '#2456c4',
  // inner-ring (metro) color groups
  'i-cyan': '#17b8c4', 'i-lime': '#7cb342', 'i-amber': '#ffa726', 'i-rose': '#ec407a',
};

const PLAYER_COLORS = [
  { name: 'purple', grad: ['#8b2fc9', '#c22fb4'], solid: '#a12fc4' },
  { name: 'blue',   grad: ['#1d6fd6', '#22a5d8'], solid: '#1f8ad7' },
  { name: 'green',  grad: ['#3f9e2f', '#7ec12a'], solid: '#5cb02c' },
  { name: 'gold',   grad: ['#b98a1c', '#d8b93a'], solid: '#c9a22b' },
  { name: 'red',    grad: ['#c92f2f', '#e06a2f'], solid: '#d44d2f' },
  { name: 'teal',   grad: ['#158f8f', '#1fc0a8'], solid: '#1aa89c' },
];

// Property tiles are named after countries (Rento-style). Prices, rent and
// color groups are unchanged from classic Monopoly — only the labels differ.
const TILES = [
  { name: 'GO', type: 'go' },
  { name: 'Молдова', type: 'prop', group: 'brown', price: 60, house: 50, rent: [2, 10, 30, 90, 160, 250] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Грузия', type: 'prop', group: 'brown', price: 60, house: 50, rent: [4, 20, 60, 180, 320, 450] },
  { name: 'Income Tax', type: 'tax', amount: 200 },
  { name: 'Северный вокзал', type: 'rail', price: 200 },
  { name: 'Украина', type: 'prop', group: 'lightblue', price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'Chance', type: 'chance' },
  { name: 'Беларусь', type: 'prop', group: 'lightblue', price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'Казахстан', type: 'prop', group: 'lightblue', price: 120, house: 50, rent: [8, 40, 100, 300, 450, 600] },
  { name: 'Jail / Visiting', type: 'jail' },
  { name: 'Польша', type: 'prop', group: 'pink', price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'Электростанция', type: 'util', price: 150 },
  { name: 'Чехия', type: 'prop', group: 'pink', price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'Венгрия', type: 'prop', group: 'pink', price: 160, house: 100, rent: [12, 60, 180, 500, 700, 900] },
  { name: 'Восточный вокзал', type: 'rail', price: 200 },
  { name: 'Турция', type: 'prop', group: 'orange', price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Греция', type: 'prop', group: 'orange', price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'Португалия', type: 'prop', group: 'orange', price: 200, house: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { name: 'Free Parking', type: 'free' },
  { name: 'Испания', type: 'prop', group: 'red', price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'Chance', type: 'chance' },
  { name: 'Италия', type: 'prop', group: 'red', price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'Нидерланды', type: 'prop', group: 'red', price: 240, house: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { name: 'Южный вокзал', type: 'rail', price: 200 },
  { name: 'Швеция', type: 'prop', group: 'yellow', price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'Норвегия', type: 'prop', group: 'yellow', price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'Водоканал', type: 'util', price: 150 },
  { name: 'Финляндия', type: 'prop', group: 'yellow', price: 280, house: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { name: 'Go To Jail', type: 'gotojail' },
  { name: 'Франция', type: 'prop', group: 'green', price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'Германия', type: 'prop', group: 'green', price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Австрия', type: 'prop', group: 'green', price: 320, house: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { name: 'Западный вокзал', type: 'rail', price: 200 },
  { name: 'Chance', type: 'chance' },
  { name: 'Япония', type: 'prop', group: 'darkblue', price: 350, house: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { name: 'Luxury Tax', type: 'tax', amount: 100 },
  { name: 'США', type: 'prop', group: 'darkblue', price: 400, house: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];

const CHANCE_CARDS = [
  { text: 'Отправляйтесь в США', act: 'moveTo', v: 39 },
  { text: 'Отправляйтесь на GO. Получите ₩200', act: 'moveTo', v: 0 },
  { text: 'Отправляйтесь в Нидерланды. Если пройдёте GO — получите ₩200', act: 'moveTo', v: 24 },
  { text: 'Отправляйтесь в Польшу. Если пройдёте GO — получите ₩200', act: 'moveTo', v: 11 },
  { text: 'Отправляйтесь на ближайший вокзал и заплатите двойную аренду, если он занят', act: 'nearRail' },
  { text: 'Отправляйтесь на ближайшее коммунальное предприятие. Если оно занято — заплатите 10× бросок кубиков', act: 'nearUtil' },
  { text: 'Банк выплачивает вам дивиденды ₩50', act: 'money', v: 50 },
  { text: 'Освобождение из тюрьмы. Карту можно сохранить', act: 'jailcard' },
  { text: 'Вернитесь на 3 клетки назад', act: 'back3' },
  { text: 'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200', act: 'jail' },
  { text: 'Ремонт недвижимости: заплатите ₩25 за каждый дом и ₩100 за каждый отель', act: 'repairs', h: 25, ho: 100 },
  { text: 'Штраф за превышение скорости ₩15', act: 'money', v: -15 },
  { text: 'Отправляйтесь на Северный вокзал. Если пройдёте GO — получите ₩200', act: 'moveTo', v: 5 },
  { text: 'Вас избрали председателем правления. Заплатите каждому игроку ₩50', act: 'payEach', v: 50 },
  { text: 'Ваш кредит на строительство погашен. Получите ₩150', act: 'money', v: 150 },
];

const CHEST_CARDS = [
  { text: 'Отправляйтесь на GO. Получите ₩200', act: 'moveTo', v: 0 },
  { text: 'Банковская ошибка в вашу пользу. Получите ₩200', act: 'money', v: 200 },
  { text: 'Оплата врача. Заплатите ₩50', act: 'money', v: -50 },
  { text: 'Продажа акций принесла вам ₩50', act: 'money', v: 50 },
  { text: 'Освобождение из тюрьмы. Карту можно сохранить', act: 'jailcard' },
  { text: 'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200', act: 'jail' },
  { text: 'Каждый игрок платит вам ₩50 за праздник', act: 'collectEach', v: 50 },
  { text: 'Возврат налога. Получите ₩20', act: 'money', v: 20 },
  { text: 'Ваш день рождения! Каждый игрок дарит вам ₩10', act: 'collectEach', v: 10 },
  { text: 'Страховка жизни приносит ₩100', act: 'money', v: 100 },
  { text: 'Оплата больницы ₩100', act: 'money', v: -100 },
  { text: 'Оплата школы ₩50', act: 'money', v: -50 },
  { text: 'Гонорар консультанта ₩25', act: 'money', v: 25 },
  { text: 'Уличный ремонт: ₩40 за каждый дом, ₩115 за каждый отель', act: 'repairs', h: 40, ho: 115 },
  { text: 'Вы заняли 2 место в конкурсе красоты. Получите ₩10', act: 'money', v: 10 },
  { text: 'Вы получили наследство ₩100', act: 'money', v: 100 },
];

const CUR = '₩';

// ===== Game settings (chosen by the host before creating a room) =====
const DEFAULT_SETTINGS = {
  startMoney: 1500,     // starting cash for everyone
  turnTimer: 0,         // seconds per turn, 0 = off (auto-ends stalled turns)
  auction: false,       // declined/unaffordable tiles go to auction
  freeParkingPot: false,// taxes & fines pile in the center, claimed on Free Parking
  innerCircle: false,   // OFF by default — opt-in modification. When on, outer stations lead into a 24-tile inner ring.
  speedDie: false,      // extra speed die for faster games
  theme: 'classic',     // board skin
};

// Board skins: field + tile paper colors used by the 3D board texture.
const BOARD_THEMES = {
  classic: { name: 'Классика',  field: '#9cc7aa', vignette: 'rgba(25,65,40,0.22)', paper: '#e9e2c8', ink: '#1d1c18' },
  midnight:{ name: 'Полночь',   field: '#20293f', vignette: 'rgba(0,0,0,0.42)',    paper: '#e7ebf5', ink: '#1a2036' },
  sunset:  { name: 'Закат',     field: '#e7b489', vignette: 'rgba(120,50,20,0.28)',paper: '#fbefdd', ink: '#3a2415' },
  mono:    { name: 'Графит',    field: '#c9ccce', vignette: 'rgba(20,20,25,0.3)',  paper: '#f2f3f4', ink: '#1c1e20' },
};

// ===== Inner ring ("metro" circle) =====
// The four outer stations (rail tiles) are the entrances. Landing on ANY outer
// station teleports you into this inner ring; you leave again by landing on an
// inner metro tile, which returns you to the station you came from.
//
// 24 tiles total, absolute board indices 40..63. Layout per the metro concept:
//   - 4 metro tiles at relative 0, 6, 12, 18 (the ring "corners" = exits)
//   - 4 color groups of 2 buyable countries each (8 lands total)
//   - the remaining 12 squares are money-only BONUS / TAX tiles.
//
// IMPORTANT: the inner ring intentionally has NO Chance/Chest tiles. Those draw
// cards whose moveTo/jail actions use OUTER-ring indices, which would teleport a
// player out of the inner ring and corrupt their ring state. Bonus/Tax tiles
// only change money, so they never move the player and keep the ring consistent.
const OUTER_STATIONS = [5, 15, 25, 35];   // outer rail tiles that lead inside
const INNER_BASE = 40;                     // absolute index of inner tile 0
const INNER_COUNT = 24;

const INNER_TILES = (() => {
  // Per-side blueprint: 6 tiles each (index 0 is always the metro corner).
  // 'b' = bonus (gain), 't' = tax (pay); otherwise the next country of the side.
  const sides = [
    { g: 'i-cyan',  price: 120, house: 60,  rent: [8, 40, 100, 300, 450, 600],
      names: ['Куба', 'Перу'],
      plan: ['metro', 'prop', 'bonus', 'prop', 'tax', 'bonus'] },
    { g: 'i-lime',  price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950],
      names: ['Тунис', 'Гана'],
      plan: ['metro', 'prop', 'tax', 'prop', 'bonus', 'tax'] },
    { g: 'i-amber', price: 240, house: 150, rent: [20, 100, 300, 750, 925, 1100],
      names: ['Непал', 'Катар'],
      plan: ['metro', 'prop', 'bonus', 'prop', 'tax', 'bonus'] },
    { g: 'i-rose',  price: 320, house: 200, rent: [28, 150, 450, 1000, 1200, 1400],
      names: ['Оман', 'Фиджи'],
      plan: ['metro', 'prop', 'tax', 'prop', 'bonus', 'tax'] },
  ];
  const tiles = [];
  for (const side of sides) {
    let pi = 0;   // country index for this side
    for (const kind of side.plan) {
      if (kind === 'metro') tiles.push({ name: 'Metro', type: 'metro' });
      else if (kind === 'bonus') tiles.push({ name: 'Бонус', type: 'bonus', amount: 100 });
      else if (kind === 'tax') tiles.push({ name: 'Налог', type: 'tax', amount: 100 });
      else tiles.push({
        name: side.names[pi++], type: 'prop', group: side.g,
        price: side.price, house: side.house, rent: side.rent.slice(),
      });
    }
  }
  return tiles;
})();

// Combined board: outer (0..39) + inner (40..63). Index tiles via BOARD[idx].
const BOARD = TILES.concat(INNER_TILES);

// Ring helpers on the combined index space.
function ringBase(pos) { return pos >= INNER_BASE ? INNER_BASE : 0; }
function ringLen(pos) { return pos >= INNER_BASE ? INNER_COUNT : 40; }
function isInner(pos) { return pos >= INNER_BASE; }
