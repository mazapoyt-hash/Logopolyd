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
    metroT: 'Внутренний круг (метро)', metroHint: 'С вокзала можно перепрыгнуть на противоположную сторону доски.',
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
    metro: 'Метро', metroQ: 'Отправиться на противоположную сторону', metroGo: 'Поехать', metroStayB: 'Остаться',
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
    metroT: 'Внутрішнє коло (метро)', metroHint: 'З вокзалу можна перестрибнути на протилежний бік дошки.',
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
    metro: 'Метро', metroQ: 'Вирушити на протилежний бік', metroGo: 'Поїхати', metroStayB: 'Залишитись',
    choosingRoute: 'обирає маршрут…',
    buyQ: 'Купити', buyB: 'Купити', declineB: 'Відмовитись', decides: 'вирішує…',
    parkingPot: 'Банк стоянки', enterName: "Введи ім'я", connErr: "Помилка з'єднання",
    hostBack: 'Творець кімнати перепідключається…',
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
    metroT: 'Inner circle (metro)', metroHint: 'Jump from a station to the opposite side of the board.',
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
    metro: 'Metro', metroQ: 'Travel to the opposite side', metroGo: 'Go', metroStayB: 'Stay',
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
    metroT: 'Innerer Kreis (Metro)', metroHint: 'Vom Bahnhof auf die gegenüberliegende Seite des Bretts springen.',
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
    metro: 'Metro', metroQ: 'Auf die gegenüberliegende Seite fahren', metroGo: 'Fahren', metroStayB: 'Bleiben',
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
