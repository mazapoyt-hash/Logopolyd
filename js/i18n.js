// ===== Lightweight i18n =====
// Static HTML nodes carry data-i18n / data-i18n-ph attributes; dynamic UI
// strings in ui.js go through t(key). The game engine log stays in the host's
// language (it is part of the shared state).

const I18N = {
  ru: {
    subtitle: 'Онлайн-игра с друзьями',
    playingAs: 'Играешь как', edit: 'изменить',
    yourName: 'Твоё имя', code: 'КОД',
    createRoom: 'Создать комнату', soloPlay: 'Игра с ботами', join: 'Войти',
    gameSettings: 'Настройки игры', botOpponents: 'Соперники-боты',
    startMoney: 'Стартовые деньги', turnTimer: 'Таймер хода', off: 'Выкл',
    timerHint: 'Если игрок завис или свернул игру — ход завершится сам.',
    boardTheme: 'Тема доски',
    themeClassic: 'Классика', themeMidnight: 'Полночь', themeSunset: 'Закат', themeMono: 'Графит',
    auctionT: 'Аукцион при отказе', auctionHint: 'Отказался от покупки — клетка уходит с молотка всем игрокам.',
    potT: 'Банк на «Бесплатной стоянке»', potHint: 'Налоги и штрафы копятся в центре. Попал на Free Parking — забрал всё.',
    metroT: 'Внутренний круг (метро)', metroHint: 'Модификация: попав на вокзал, спускаешься в метро — внутренний круг из 24 клеток. Выход — на клетке метро обратно на свой вокзал.',
    speedT: 'Быстрый режим (3-й кубик)', speedHint: 'Добавляет спид-кубик: больше движения и бонусные ходы.',
    roomCodeLabel: 'Код комнаты — отправь друзьям:', copy: 'Копировать', copied: 'Скопировано!',
    inviteTg: 'Пригласить в Telegram', players: 'Игроки:', startGame: 'Начать игру',
    waitingPlayers: 'Ожидание игроков…', reconnecting: 'Переподключение к игре…', connecting: 'Подключение к игре…',
    events: 'События', chatT: 'Чат', message: 'Сообщение…',
    rollDice: 'Бросить кубики', endTurn: 'Завершить ход', pay50: 'Заплатить ₩50', jailCardBtn: 'Карта выхода',
    actTrade: 'ОБМЕН', actBuild: 'СТРОИТЬ', actSell: 'ПРОДАТЬ', actMortgage: 'ЗАЛОГ', actRedeem: 'ВЫКУП', actEnd: 'КОНЕЦ ХОДА',
    yourTurn: 'Твой ход!', turnOf: 'Ходит', finishOrManage: 'Заверши ход или управляй имуществом',
    jailHint: 'Ты в тюрьме: плати, используй карту или бросай на дубль',
    winner: 'Победитель', victory: 'ПОБЕДА!', monopolist: 'монополист!', newGame: 'Новая игра',
    stPlayer: 'Игрок', stTotal: 'Итог', stTiles: 'Клеток', stRentIn: 'Аренда +', stRentOut: 'Аренда −', stCircles: 'Кругов',
    auction: 'Аукцион', currentBid: 'Текущая ставка', noBids: 'ставок нет', bid: 'Ставка', passBid: 'Пас',
    yourBalance: 'Твой баланс', bidding: 'Идут торги…', youPassed: 'Ты спасовал.',
    metro: 'Метро', metroQ: 'Спуститься в метро (внутренний круг)?', metroGo: 'Поехать', metroStayB: 'Остаться',
    choosingRoute: 'выбирает маршрут…',
    buyQ: 'Купить', buyB: 'Купить', declineB: 'Отказаться', decides: 'решает…',
    parkingPot: 'Банк стоянки', enterName: 'Введи имя', connErr: 'Ошибка соединения',
    hostBack: 'Создатель комнаты переподключается…',
  },
  uk: {
    subtitle: 'Онлайн-гра з друзями',
    playingAs: 'Граєш як', edit: 'змінити',
    yourName: "Твоє ім'я", code: 'КОД',
    createRoom: 'Створити кімнату', soloPlay: 'Гра з ботами', join: 'Увійти',
    gameSettings: 'Налаштування гри', botOpponents: 'Суперники-боти',
    startMoney: 'Стартові гроші', turnTimer: 'Таймер ходу', off: 'Вимк',
    timerHint: 'Якщо гравець завис або згорнув гру — хід завершиться сам.',
    boardTheme: 'Тема дошки',
    themeClassic: 'Класика', themeMidnight: 'Північ', themeSunset: 'Захід', themeMono: 'Графіт',
    auctionT: 'Аукціон при відмові', auctionHint: 'Відмовився від покупки — клітинка йде з молотка всім гравцям.',
    potT: 'Банк на «Безкоштовній стоянці»', potHint: 'Податки та штрафи накопичуються в центрі. Потрапив на Free Parking — забрав усе.',
    metroT: 'Внутрішнє коло (метро)', metroHint: 'Модифікація: потрапивши на вокзал, спускаєшся в метро — внутрішнє коло з 24 клітинок. Вихід — на клітинці метро назад на свій вокзал.',
    speedT: 'Швидкий режим (3-й кубик)', speedHint: 'Додає спід-кубик: більше руху та бонусні ходи.',
    roomCodeLabel: 'Код кімнати — надішли друзям:', copy: 'Копіювати', copied: 'Скопійовано!',
    inviteTg: 'Запросити в Telegram', players: 'Гравці:', startGame: 'Почати гру',
    waitingPlayers: 'Очікування гравців…', reconnecting: 'Перепідключення до гри…', connecting: 'Підключення до гри…',
    events: 'Події', chatT: 'Чат', message: 'Повідомлення…',
    rollDice: 'Кинути кубики', endTurn: 'Завершити хід', pay50: 'Заплатити ₩50', jailCardBtn: 'Карта виходу',
    actTrade: 'ОБМІН', actBuild: 'БУДУВАТИ', actSell: 'ПРОДАТИ', actMortgage: 'ЗАСТАВА', actRedeem: 'ВИКУП', actEnd: 'КІНЕЦЬ ХОДУ',
    yourTurn: 'Твій хід!', turnOf: 'Ходить', finishOrManage: 'Заверши хід або керуй майном',
    jailHint: "Ти у в'язниці: плати, використай карту або кидай на дубль",
    winner: 'Переможець', victory: 'ПЕРЕМОГА!', monopolist: 'монополіст!', newGame: 'Нова гра',
    stPlayer: 'Гравець', stTotal: 'Підсумок', stTiles: 'Клітинок', stRentIn: 'Оренда +', stRentOut: 'Оренда −', stCircles: 'Кіл',
    auction: 'Аукціон', currentBid: 'Поточна ставка', noBids: 'ставок немає', bid: 'Ставка', passBid: 'Пас',
    yourBalance: 'Твій баланс', bidding: 'Йдуть торги…', youPassed: 'Ти спасував.',
    metro: 'Метро', metroQ: 'Спуститися в метро (внутрішнє коло)?', metroGo: 'Поїхати', metroStayB: 'Залишитись',
    choosingRoute: 'обирає маршрут…',
    buyQ: 'Купити', buyB: 'Купити', declineB: 'Відмовитись', decides: 'вирішує…',
    parkingPot: 'Банк стоянки', enterName: "Введи ім'я", connErr: "Помилка з'єднання",
    hostBack: 'Творець кімнати перепідключаєть��я…',
  },
  en: {
    subtitle: 'Online game with friends',
    playingAs: 'Playing as', edit: 'edit',
    yourName: 'Your name', code: 'CODE',
    createRoom: 'Create room', soloPlay: 'Play vs bots', join: 'Join',
    gameSettings: 'Game settings', botOpponents: 'Bot opponents',
    startMoney: 'Starting money', turnTimer: 'Turn timer', off: 'Off',
    timerHint: 'If a player stalls or minimizes the game, the turn ends automatically.',
    boardTheme: 'Board theme',
    themeClassic: 'Classic', themeMidnight: 'Midnight', themeSunset: 'Sunset', themeMono: 'Graphite',
    auctionT: 'Auction on decline', auctionHint: 'Declined tiles go under the hammer for all players.',
    potT: 'Free Parking jackpot', potHint: 'Taxes and fines pile up in the center. Land on Free Parking to claim it all.',
    metroT: 'Inner circle (metro)', metroHint: 'Modifier: landing on a station takes you into the metro — an inner ring of 24 tiles. Exit at a metro tile back onto your own station.',
    speedT: 'Fast mode (3rd die)', speedHint: 'Adds a speed die: more movement and bonus moves.',
    roomCodeLabel: 'Room code — send it to friends:', copy: 'Copy', copied: 'Copied!',
    inviteTg: 'Invite via Telegram', players: 'Players:', startGame: 'Start game',
    waitingPlayers: 'Waiting for players…', reconnecting: 'Reconnecting to the game…', connecting: 'Joining the game…',
    events: 'Events', chatT: 'Chat', message: 'Message…',
    rollDice: 'Roll the dice', endTurn: 'End turn', pay50: 'Pay ₩50', jailCardBtn: 'Jail card',
    actTrade: 'TRADE', actBuild: 'BUILD', actSell: 'SELL', actMortgage: 'MORTGAGE', actRedeem: 'REDEEM', actEnd: 'END TURN',
    yourTurn: 'Your turn!', turnOf: 'Turn:', finishOrManage: 'End your turn or manage property',
    jailHint: 'You are in jail: pay, use a card, or roll doubles',
    winner: 'Winner', victory: 'VICTORY!', monopolist: 'is the monopolist!', newGame: 'New game',
    stPlayer: 'Player', stTotal: 'Total', stTiles: 'Tiles', stRentIn: 'Rent +', stRentOut: 'Rent −', stCircles: 'Laps',
    auction: 'Auction', currentBid: 'Current bid', noBids: 'no bids', bid: 'Bid', passBid: 'Pass',
    yourBalance: 'Your balance', bidding: 'Bidding in progress…', youPassed: 'You passed.',
    metro: 'Metro', metroQ: 'Head into the metro (inner circle)?', metroGo: 'Go', metroStayB: 'Stay',
    choosingRoute: 'is choosing a route…',
    buyQ: 'Buy', buyB: 'Buy', declineB: 'Decline', decides: 'is deciding…',
    parkingPot: 'Parking jackpot', enterName: 'Enter your name', connErr: 'Connection error',
    hostBack: 'The host is reconnecting…',
  },
  de: {
    subtitle: 'Online-Spiel mit Freunden',
    playingAs: 'Du spielst als', edit: 'ändern',
    yourName: 'Dein Name', code: 'CODE',
    createRoom: 'Raum erstellen', soloPlay: 'Gegen Bots spielen', join: 'Beitreten',
    gameSettings: 'Spieleinstellungen', botOpponents: 'Bot-Gegner',
    startMoney: 'Startgeld', turnTimer: 'Zug-Timer', off: 'Aus',
    timerHint: 'Wenn ein Spieler nicht reagiert, endet der Zug automatisch.',
    boardTheme: 'Brett-Design',
    themeClassic: 'Klassisch', themeMidnight: 'Mitternacht', themeSunset: 'Sonnenuntergang', themeMono: 'Graphit',
    auctionT: 'Auktion bei Ablehnung', auctionHint: 'Abgelehnte Felder kommen für alle Spieler unter den Hammer.',
    potT: 'Frei-Parken-Jackpot', potHint: 'Steuern und Strafen sammeln sich in der Mitte. Auf Frei Parken landen und alles kassieren.',
    metroT: 'Innerer Kreis (Metro)', metroHint: 'Modifikation: Auf einem Bahnhof geht es in die Metro — ein innerer Ring aus 24 Feldern. Ausstieg an einem Metro-Feld zurück zum eigenen Bahnhof.',
    speedT: 'Schnellmodus (3. Würfel)', speedHint: 'Fügt einen Tempowürfel hinzu: mehr Bewegung und Bonuszüge.',
    roomCodeLabel: 'Raumcode — schick ihn deinen Freunden:', copy: 'Kopieren', copied: 'Kopiert!',
    inviteTg: 'Über Telegram einladen', players: 'Spieler:', startGame: 'Spiel starten',
    waitingPlayers: 'Warten auf Spieler…', reconnecting: 'Wiederverbindung zum Spiel…', connecting: 'Spielbeitritt…',
    events: 'Ereignisse', chatT: 'Chat', message: 'Nachricht…',
    rollDice: 'Würfeln', endTurn: 'Zug beenden', pay50: '₩50 zahlen', jailCardBtn: 'Gefängnis-Karte',
    actTrade: 'HANDEL', actBuild: 'BAUEN', actSell: 'VERKAUFEN', actMortgage: 'HYPOTHEK', actRedeem: 'AUSLÖSEN', actEnd: 'ZUG ENDE',
    yourTurn: 'Du bist dran!', turnOf: 'Am Zug:', finishOrManage: 'Beende den Zug oder verwalte Besitz',
    jailHint: 'Du bist im Gefängnis: zahle, nutze eine Karte oder würfle einen Pasch',
    winner: 'Gewinner', victory: 'SIEG!', monopolist: 'ist der Monopolist!', newGame: 'Neues Spiel',
    stPlayer: 'Spieler', stTotal: 'Gesamt', stTiles: 'Felder', stRentIn: 'Miete +', stRentOut: 'Miete −', stCircles: 'Runden',
    auction: 'Auktion', currentBid: 'Aktuelles Gebot', noBids: 'keine Gebote', bid: 'Gebot', passBid: 'Passen',
    yourBalance: 'Dein Kontostand', bidding: 'Bieten läuft…', youPassed: 'Du hast gepasst.',
    metro: 'Metro', metroQ: 'In die Metro fahren (innerer Kreis)?', metroGo: 'Fahren', metroStayB: 'Bleiben',
    choosingRoute: 'wählt eine Route…',
    buyQ: 'Kaufen', buyB: 'Kaufen', declineB: 'Ablehnen', decides: 'entscheidet…',
    parkingPot: 'Parken-Jackpot', enterName: 'Gib deinen Namen ein', connErr: 'Verbindungsfehler',
    hostBack: 'Der Gastgeber verbindet sich neu…',
  },
};

let LANG = 'ru';
try { LANG = localStorage.getItem('mono_lang') || 'ru'; } catch (e) {}
if (!I18N[LANG]) LANG = 'ru';

function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || I18N.ru[key] || key;
}

function setLang(lang) {
  if (!I18N[lang]) return;
  LANG = lang;
  try { localStorage.setItem('mono_lang', lang); } catch (e) {}
  applyI18n();
}

// Translate all static nodes and highlight the active language button.
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('is-on', b.dataset.lang === LANG));
  document.documentElement.lang = LANG;
}

// ===== Dynamic game-content localization =====
// The shared game state (board, cards, log) is authored in Russian — the
// canonical language. Board labels and card popups are pure presentation, so
// each client localizes them at RENDER time by looking up the canonical string.
// This keeps multiplayer state identical for everyone while every viewer sees
// their own language.

// Extra UI strings used by ui.js modals (merged so we don't touch the big
// per-language blocks above).
Object.assign(I18N.ru, {
  appName: 'КАПИТАЛ',
  you: 'ты', owner: 'Владелец', bank: 'Банк', mortgaged: 'Заложено', pledge: 'залог',
  builtLabel: 'Построек', hotel: 'отель', balance: 'Баланс', gives: 'отдаёт',
  noFreePlots: 'Нет свободных участков', cardFor: 'Карта для', decidesShort: 'решает…',
  deckChance: 'ШАНС', deckChest: 'КАЗНА',
});
Object.assign(I18N.uk, {
  appName: 'КАПІТАЛ',
  you: 'ти', owner: 'Власник', bank: 'Банк', mortgaged: 'Закладено', pledge: 'застава',
  builtLabel: 'Будівель', hotel: 'готель', balance: 'Баланс', gives: 'віддає',
  noFreePlots: 'Немає вільних ділянок', cardFor: 'Картка для', decidesShort: 'вирішує…',
  deckChance: 'ШАНС', deckChest: 'СКАРБНИЦЯ',
});
Object.assign(I18N.en, {
  appName: 'CAPITAL',
  you: 'you', owner: 'Owner', bank: 'Bank', mortgaged: 'Mortgaged', pledge: 'mortgage',
  builtLabel: 'Buildings', hotel: 'hotel', balance: 'Balance', gives: 'gives',
  noFreePlots: 'No free plots', cardFor: 'Card for', decidesShort: 'is deciding…',
  deckChance: 'CHANCE', deckChest: 'TREASURY',
});
Object.assign(I18N.de, {
  appName: 'CAPITAL',
  you: 'du', owner: 'Besitzer', bank: 'Bank', mortgaged: 'Hypothek', pledge: 'Hypothek',
  builtLabel: 'Gebäude', hotel: 'Hotel', balance: 'Kontostand', gives: 'gibt',
  noFreePlots: 'Keine freien Felder', cardFor: 'Karte für', decidesShort: 'entscheidet…',
  deckChance: 'EREIGNIS', deckChest: 'STAATSKASSE',
});

// Board tile names, keyed by the canonical name in data.js. For ru only the
// special (English-named) tiles need mapping; countries/stations are already
// Russian and fall through to the canonical string.
const TILE_I18N = {
  ru: {
    'GO': 'СТАРТ', 'Community Chest': 'Казна', 'Chance': 'Шанс', 'Income Tax': 'Налог',
    'Luxury Tax': 'Налог', 'Jail / Visiting': 'Тюрьма', 'Free Parking': 'Парковка',
    'Go To Jail': 'В тюрьму', 'Metro': 'Метро', 'Бонус': 'Бонус', 'Налог': 'Налог',
  },
  uk: {
    'GO': 'СТАРТ', 'Community Chest': 'Скарбниця', 'Chance': 'Шанс', 'Income Tax': 'Податок',
    'Luxury Tax': 'Податок', 'Jail / Visiting': "В'язниця", 'Free Parking': 'Паркування',
    'Go To Jail': "До в'язниці", 'Metro': 'Метро', 'Бонус': 'Бонус', 'Налог': 'Податок',
    'Северный вокзал': 'Північний вокзал', 'Восточный вокзал': 'Східний вокзал',
    'Южный вокзал': 'Південний вокзал', 'Западный вокзал': 'Західний вокзал',
    'Электростанция': 'Електростанція', 'Водоканал': 'Водоканал',
    'Молдова': 'Молдова', 'Грузия': 'Грузія', 'Украина': 'Україна', 'Беларусь': 'Білорусь',
    'Казахстан': 'Казахстан', 'Польша': 'Польща', 'Чехия': 'Чехія', 'Венгрия': 'Угорщина',
    'Турция': 'Туреччина', 'Греция': 'Греція', 'Португалия': 'Португалія', 'Испания': 'Іспанія',
    'Италия': 'Італія', 'Нидерланды': 'Нідерланди', 'Швеция': 'Швеція', 'Норвегия': 'Норвегія',
    'Финляндия': 'Фінляндія', 'Франция': 'Франція', 'Германия': 'Німеччина', 'Австрия': 'Австрія',
    'Япония': 'Японія', 'США': 'США', 'Куба': 'Куба', 'Перу': 'Перу', 'Тунис': 'Туніс',
    'Гана': 'Гана', 'Непал': 'Непал', 'Катар': 'Катар', 'Оман': 'Оман', 'Фиджи': 'Фіджі',
  },
  en: {
    'GO': 'START', 'Community Chest': 'Treasury', 'Chance': 'Chance', 'Income Tax': 'Income Tax',
    'Luxury Tax': 'Luxury Tax', 'Jail / Visiting': 'Jail', 'Free Parking': 'Free Parking',
    'Go To Jail': 'Go To Jail', 'Metro': 'Metro', 'Бонус': 'Bonus', 'Налог': 'Tax',
    'Северный вокзал': 'North Station', 'Восточный вокзал': 'East Station',
    'Южный вокзал': 'South Station', 'Западный вокзал': 'West Station',
    'Электростанция': 'Power Plant', 'Водоканал': 'Waterworks',
    'Молдова': 'Moldova', 'Грузия': 'Georgia', 'Украина': 'Ukraine', 'Беларусь': 'Belarus',
    'Казахстан': 'Kazakhstan', 'Польша': 'Poland', 'Чехия': 'Czechia', 'Венгрия': 'Hungary',
    'Турция': 'Turkey', 'Греция': 'Greece', 'Португалия': 'Portugal', 'Испания': 'Spain',
    'Италия': 'Italy', 'Нидерланды': 'Netherlands', 'Швеция': 'Sweden', 'Норвегия': 'Norway',
    'Финляндия': 'Finland', 'Франция': 'France', 'Германия': 'Germany', 'Австрия': 'Austria',
    'Япония': 'Japan', 'США': 'USA', 'Куба': 'Cuba', 'Перу': 'Peru', 'Тунис': 'Tunisia',
    'Гана': 'Ghana', 'Непал': 'Nepal', 'Катар': 'Qatar', 'Оман': 'Oman', 'Фиджи': 'Fiji',
  },
  de: {
    'GO': 'START', 'Community Chest': 'Staatskasse', 'Chance': 'Ereignis', 'Income Tax': 'Steuer',
    'Luxury Tax': 'Zusatzsteuer', 'Jail / Visiting': 'Gefängnis', 'Free Parking': 'Frei Parken',
    'Go To Jail': 'Ins Gefängnis', 'Metro': 'Metro', 'Бонус': 'Bonus', 'Налог': 'Steuer',
    'Северный вокзал': 'Nordbahnhof', 'Восточный вокзал': 'Ostbahnhof',
    'Южный вокзал': 'Südbahnhof', 'Западный вокзал': 'Westbahnhof',
    'Электростанция': 'Kraftwerk', 'Водоканал': 'Wasserwerk',
    'Молдова': 'Moldawien', 'Грузия': 'Georgien', 'Украина': 'Ukraine', 'Беларусь': 'Belarus',
    'Казахстан': 'Kasachstan', 'Польша': 'Polen', 'Чехия': 'Tschechien', 'Венгрия': 'Ungarn',
    'Турция': 'Türkei', 'Греция': 'Griechenland', 'Португалия': 'Portugal', 'Испания': 'Spanien',
    'Италия': 'Italien', 'Нидерланды': 'Niederlande', 'Швеция': 'Schweden', 'Норвегия': 'Norwegen',
    'Финляндия': 'Finnland', 'Франция': 'Frankreich', 'Германия': 'Deutschland', 'Австрия': 'Österreich',
    'Япония': 'Japan', 'США': 'USA', 'Куба': 'Kuba', 'Перу': 'Peru', 'Тунис': 'Tunesien',
    'Гана': 'Ghana', 'Непал': 'Nepal', 'Катар': 'Katar', 'Оман': 'Oman', 'Фиджи': 'Fidschi',
  },
};

function tileName(name) {
  const m = TILE_I18N[LANG];
  return (m && m[name]) || name;
}

// Card texts, keyed by the canonical Russian text (unchanged in data.js so the
// shared state stays identical for everyone). Every displayed language —
// including ru — is remapped here to original wording (no Monopoly-verbatim
// phrasing) and uses "СТАРТ/START" instead of "GO".
const CARD_I18N = {
  ru: {
    'Отправляйтесь в США': 'Деловая поездка в США — переместитесь туда',
    'Отправляйтесь на GO. Получите ₩200': 'Возвращайтесь на СТАРТ и получите ₩200',
    'Отправляйтесь в Нидерланды. Если пройдёте GO — получите ₩200': 'Переезд в Нидерланды. За проход СТАРТА — ₩200',
    'Отправляйтесь в Польшу. Если пройдёте GO — получите ₩200': 'Переезд в Польшу. За проход СТАРТА — ₩200',
    'Отправляйтесь на ближайший вокзал и заплатите двойную аренду, если он занят': 'Поезд до ближайшего вокзала. Если он чужой — оплата вдвойне',
    'Отправляйтесь на ближайшее коммунальное предприятие. Если оно занято — заплатите 10× бросок кубиков': 'Двигайтесь к ближайшему предприятию. Если чужое — платите 10× бросок',
    'Банк выплачивает вам дивиденды ₩50': 'Дивиденды по вкладу — банк платит вам ₩50',
    'Освобождение из тюрьмы. Карту можно сохранить': 'Пропуск на свободу. Сохраните карту до нужного момента',
    'Вернитесь на 3 клетки назад': 'Сделайте три шага назад',
    'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200': 'Вас задержали! В тюрьму — без прохода СТАРТА и без ₩200',
    'Ремонт недвижимости: заплатите ₩25 за каждый дом и ₩100 за каждый отель': 'Плановый ремонт: ₩25 за каждый дом и ₩100 за каждый отель',
    'Штраф за превышение скорости ₩15': 'Штраф за превышение скорости — ₩15',
    'Отправляйтесь на Северный вокзал. Если пройдёте GO — получите ₩200': 'Поезд до Северного вокзала. За проход СТАРТА — ₩200',
    'Вас избрали председателем правления. Заплатите каждому игроку ₩50': 'Вы возглавили совет директоров. Выплатите каждому игроку ₩50',
    'Ваш кредит на строительство погашен. Получите ₩150': 'Инвестиции окупились — получите ₩150',
    'Банковская ошибка в вашу пользу. Получите ₩200': 'Перерасчёт в вашу пользу — получите ₩200',
    'Оплата врача. Заплатите ₩50': 'Визит к врачу — заплатите ₩50',
    'Продажа акций принесла вам ₩50': 'Вы удачно продали акции — прибыль ₩50',
    'Каждый игрок платит вам ₩50 за праздник': 'Вы устроили приём — каждый игрок платит вам ₩50',
    'Возврат налога. Получите ₩20': 'Налоговый вычет — получите ₩20',
    'Ваш день рождения! Каждый игрок дарит вам ₩10': 'У вас день рождения! Каждый игрок дарит вам ₩10',
    'Страховка жизни приносит ₩100': 'Выплата по страховке — ₩100',
    'Оплата больницы ₩100': 'Счёт из клиники — ₩100',
    'Оплата школы ₩50': 'Плата за обучение — ₩50',
    'Гонорар консультанта ₩25': 'Вам выплатили гонорар консультанта — ₩25',
    'Уличный ремонт: ₩40 за каждый дом, ₩115 за каждый отель': 'Благоустройство: ₩40 за каждый дом и ₩115 за каждый отель',
    'Вы заняли 2 место в конкурсе красоты. Получите ₩10': 'Второе место на городском конкурсе — приз ₩10',
    'Вы получили наследство ₩100': 'Вам досталось наследство — ₩100',
  },
  uk: {
    'Отправляйтесь в США': 'Ділова поїздка до США — перемістіться туди',
    'Отправляйтесь на GO. Получите ₩200': 'Повертайтесь на СТАРТ і отримайте ₩200',
    'Отправляйтесь в Нидерланды. Если пройдёте GO — получите ₩200': 'Переїзд до Нідерландів. За прохід СТАРТУ — ₩200',
    'Отправляйтесь в Польшу. Если пройдёте GO — получите ₩200': 'Переїзд до Польщі. За прохід СТАРТУ — ₩200',
    'Отправляйтесь на ближайший вокзал и заплатите двойную аренду, если он занят': 'Потяг до найближчого вокзалу. Якщо він чужий — оплата вдвічі',
    'Отправляйтесь на ближайшее коммунальное предприятие. Если оно занято — заплатите 10× бросок кубиков': 'Рухайтесь до найближчого підприємства. Якщо чуже — платіть 10× кидок',
    'Банк выплачивает вам дивиденды ₩50': 'Дивіденди за вкладом — банк платить вам ₩50',
    'Освобождение из тюрьмы. Карту можно сохранить': "Перепустка на волю. Збережіть картку до потрібної миті",
    'Вернитесь на 3 клетки назад': 'Зробіть три кроки назад',
    'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200': "Вас затримали! До в'язниці — без проходу СТАРТУ і без ₩200",
    'Ремонт недвижимости: заплатите ₩25 за каждый дом и ₩100 за каждый отель': 'Плановий ремонт: ₩25 за кожен будинок і ₩100 за кожен готель',
    'Штраф за превышение скорости ₩15': 'Штраф за перевищення швидкості — ₩15',
    'Отправляйтесь на Северный вокзал. Если пройдёте GO — получите ₩200': 'Потяг до Північного вокзалу. За прохід СТАРТУ — ₩200',
    'Вас избрали председателем правления. Заплатите каждому игроку ₩50': 'Ви очолили раду директорів. Виплатіть кожному гравцю ₩50',
    'Ваш кредит на строительство погашен. Получите ₩150': 'Інвестиції окупились — отримайте ₩150',
    'Банковская ошибка в вашу пользу. Получите ₩200': 'Перерахунок на вашу користь — отримайте ₩200',
    'Оплата врача. Заплатите ₩50': 'Візит до лікаря — сплатіть ₩50',
    'Продажа акций принесла вам ₩50': 'Ви вдало продали акції — прибуток ₩50',
    'Каждый игрок платит вам ₩50 за праздник': 'Ви влаштували прийом — кожен гравець платить вам ₩50',
    'Возврат налога. Получите ₩20': 'Податкове вирахування — отримайте ₩20',
    'Ваш день рождения! Каждый игрок дарит вам ₩10': 'У вас день народження! Кожен гравець дарує вам ₩10',
    'Страховка жизни приносит ₩100': 'Страхування життя приносить ₩100',
    'Оплата больницы ₩100': 'Оплата лікарні ₩100',
    'Оплата школы ₩50': 'Оплата школи ₩50',
    'Гонорар консультанта ₩25': 'Гонорар консультанта ₩25',
    'Уличный ремонт: ₩40 за каждый дом, ₩115 за каждый отель': 'Вуличний ремонт: ₩40 за кожен будинок, ₩115 за кожен готель',
    'Вы заняли 2 место в конкурсе красоты. Получите ₩10': 'Ви посіли 2 місце в конкурсі краси. Отримайте ₩10',
    'Вы получили наследство ₩100': 'Ви отримали спадщину ₩100',
  },
  en: {
    'Отправляйтесь в США': 'Business trip to the USA — move there',
    'Отправляйтесь на GO. Получите ₩200': 'Head back to START and collect ₩200',
    'Отправляйтесь в Нидерланды. Если пройдёте GO — получите ₩200': 'Relocate to the Netherlands. Passing START pays ₩200',
    'Отправляйтесь в Польшу. Если пройдёте GO — получите ₩200': 'Relocate to Poland. Passing START pays ₩200',
    'Отправляйтесь на ближайший вокзал и заплатите двойную аренду, если он занят': 'Ride to the nearest station. If it is owned, pay double',
    'Отправляйтесь на ближайшее коммунальное предприятие. Если оно занято — заплатите 10× бросок кубиков': 'Move to the nearest utility. If owned, pay 10× your roll',
    'Банк выплачивает вам дивиденды ₩50': 'Dividend on your deposit — the bank pays you ₩50',
    'Освобождение из тюрьмы. Карту можно сохранить': 'A pass to freedom. Keep this card until you need it',
    'Вернитесь на 3 клетки назад': 'Take three steps back',
    'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200': 'You are detained! Off to jail — no START, no ₩200',
    'Ремонт недвижимости: заплатите ₩25 за каждый дом и ₩100 за каждый отель': 'Scheduled repairs: pay ₩25 per house and ₩100 per hotel',
    'Штраф за превышение скорости ₩15': 'Speeding fine — ₩15',
    'Отправляйтесь на Северный вокзал. Если пройдёте GO — получите ₩200': 'Train to North Station. Passing START pays ₩200',
    'Вас избрали председателем правления. Заплатите каждому игроку ₩50': 'You now chair the board. Pay each player ₩50',
    'Ваш кредит на строительство погашен. Получите ₩150': 'Your investment paid off — collect ₩150',
    'Банковская ошибка в вашу пользу. Получите ₩200': 'A recalculation in your favor — collect ₩200',
    'Оплата врача. Заплатите ₩50': 'Doctor visit — pay ₩50',
    'Продажа акций принесла вам ₩50': 'You sold shares at a profit — gain ₩50',
    'Каждый игрок платит вам ₩50 за праздник': 'You host a reception — each player pays you ₩50',
    'Возврат налога. Получите ₩20': 'Tax deduction — collect ₩20',
    'Ваш день рождения! Каждый игрок дарит вам ₩10': "It's your birthday! Each player gives you ₩10",
    'Страховка жизни приносит ₩100': 'Insurance payout — ₩100',
    'Оплата больницы ₩100': 'Clinic bill — ₩100',
    'Оплата школы ₩50': 'Tuition fee — ₩50',
    'Гонорар консультанта ₩25': 'You are paid a consultancy fee — ₩25',
    'Уличный ремонт: ₩40 за каждый дом, ₩115 за каждый отель': 'City upkeep: ₩40 per house and ₩115 per hotel',
    'Вы заняли 2 место в конкурсе красоты. Получите ₩10': 'Second place at the city contest — prize ₩10',
    'Вы получили наследство ₩100': 'You receive an inheritance — ₩100',
  },
  de: {
    'Отправляйтесь в США': 'Geschäftsreise in die USA — ziehe dorthin',
    'Отправляйтесь на GO. Получите ₩200': 'Kehre zurück zum START und ziehe ₩200 ein',
    'Отправляйтесь в Нидерланды. Если пройдёте GO — получите ₩200': 'Umzug in die Niederlande. Über START: ziehe ₩200 ein',
    'Отправляйтесь в Польшу. Если пройдёте GO — получите ₩200': 'Umzug nach Polen. Über START: ziehe ₩200 ein',
    'Отправляйтесь на ближайший вокзал и заплатите двойную аренду, если он занят': 'Fahre zum nächsten Bahnhof. Falls fremd, zahle doppelt',
    'Отправляйтесь на ближайшее коммунальное предприятие. Если оно занято — заплатите 10× бросок кубиков': 'Fahre zum nächsten Werk. Falls fremd: zahle das 10-fache deines Wurfs',
    'Банк выплачивает вам дивиденды ₩50': 'Dividende auf deine Einlage — die Bank zahlt dir ₩50',
    'Освобождение из тюрьмы. Карту можно сохранить': 'Ein Freibrief. Behalte die Karte für den richtigen Moment',
    'Вернитесь на 3 клетки назад': 'Gehe drei Schritte zurück',
    'Отправляйтесь в тюрьму. Не проходите GO, не получаете ₩200': 'Du wurdest festgenommen! Ins Gefängnis — ohne START, ohne ₩200',
    'Ремонт недвижимости: заплатите ₩25 за каждый дом и ₩100 за каждый отель': 'Planmäßige Reparaturen: ₩25 je Haus und ₩100 je Hotel',
    'Штраф за превышение скорости ₩15': 'Bußgeld für zu schnelles Fahren — ₩15',
    'Отправляйтесь на Северный вокзал. Если пройдёте GO — получите ₩200': 'Zug zum Nordbahnhof. Über START: ziehe ₩200 ein',
    'Вас избрали председателем правления. Заплатите каждому игроку ₩50': 'Du führst nun den Vorstand. Zahle jedem Spieler ₩50',
    'Ваш кредит на строительство погашен. Получите ₩150': 'Deine Investition zahlt sich aus — ziehe ₩150 ein',
    'Банковская ошибка в вашу пользу. Получите ₩200': 'Eine Neuberechnung zu deinen Gunsten — ziehe ₩200 ein',
    'Оплата врача. Заплатите ₩50': 'Arztbesuch — zahle ₩50',
    'Продажа акций принесла вам ₩50': 'Du hast Aktien mit Gewinn verkauft — +₩50',
    'Каждый игрок платит вам ₩50 за праздник': 'Du gibst einen Empfang — jeder Spieler zahlt dir ₩50',
    'Возврат налога. Получите ₩20': 'Steuerabzug — ziehe ₩20 ein',
    'Ваш день рождения! Каждый игрок дарит вам ₩10': 'Du hast Geburtstag! Jeder Spieler schenkt dir ₩10',
    'Страховка жизни приносит ₩100': 'Versicherungsauszahlung — ₩100',
    'Оплата больницы ₩100': 'Klinikrechnung — ₩100',
    'Оплата школы ₩50': 'Studiengebühr — ₩50',
    'Гонорар консультанта ₩25': 'Du erhältst ein Beraterhonorar — ₩25',
    'Уличный ремонт: ₩40 за каждый дом, ₩115 за каждый отель': 'Stadtpflege: ₩40 je Haus und ₩115 je Hotel',
    'Вы заняли 2 место в конкурсе красоты. Получите ₩10': 'Zweiter Platz beim Stadtwettbewerb — Preis ₩10',
    'Вы получили наследство ₩100': 'Du erhältst eine Erbschaft — ₩100',
  },
};

function cardText(text) {
  const m = CARD_I18N[LANG];
  return (m && m[text]) || text;
}

// Localize a card deck banner ('ШАНС' / 'ОБЩЕСТВЕННАЯ КАЗНА') for display.
function deckName(name) {
  return name === 'ШАНС' ? t('deckChance') : t('deckChest');
}
