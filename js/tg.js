// ===== Telegram Mini App integration =====
// Thin wrapper around window.Telegram.WebApp. Everything degrades gracefully
// when the game is opened in a normal browser (TG.inside === false).

const TG = (() => {
  const wa = (window.Telegram && window.Telegram.WebApp) || null;
  const inside = !!(wa && wa.initData !== undefined && wa.platform && wa.platform !== 'unknown');
  const user = (wa && wa.initDataUnsafe && wa.initDataUnsafe.user) || null;

  // --- CONFIGURE THESE once you create the bot + mini app in @BotFather ---
  // Example: bot = 'monopoly_play_bot', app = 'game'  =>  t.me/monopoly_play_bot/game
  const BOT_USERNAME = 'Monopolyd_bot';   // t.me/Monopolyd_bot/game
  const APP_SHORTNAME = 'game';           // short name мини-аппа из BotFather

  function displayName() {
    if (!user) return '';
    const n = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return (n || user.username || '').slice(0, 14);
  }

  function haptic(kind = 'light') {
    if (!wa || !wa.HapticFeedback) return;
    try {
      if (kind === 'success' || kind === 'error' || kind === 'warning') {
        wa.HapticFeedback.notificationOccurred(kind);
      } else if (kind === 'select') {
        wa.HapticFeedback.selectionChanged();
      } else {
        wa.HapticFeedback.impactOccurred(kind); // light | medium | heavy | rigid | soft
      }
    } catch (e) {}
  }

  // Deep link that opens the mini app and passes the room code as start_param.
  function inviteLink(code) {
    const configured = BOT_USERNAME && BOT_USERNAME !== 'YOUR_BOT';
    if (configured) return `https://t.me/${BOT_USERNAME}/${APP_SHORTNAME}?startapp=${code}`;
    return null; // not configured yet
  }

  // Open Telegram's native "share to chat" sheet with the invite.
  function shareInvite(code) {
    const link = inviteLink(code);
    const text = `Играем в Монополию! Заходи в комнату ${code}`;
    if (wa && link) {
      const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
      wa.openTelegramLink(url);
      return true;
    }
    return false; // caller should fall back to copying the code
  }

  function init() {
    if (!wa) return;
    try {
      wa.ready();
      wa.expand();
      if (wa.disableVerticalSwipes) wa.disableVerticalSwipes(); // don't close on swipe-down mid-game
      if (wa.setHeaderColor) wa.setHeaderColor('#14110c');
      if (wa.setBackgroundColor) wa.setBackgroundColor('#14110c');
      // expose safe-area insets as CSS vars (Telegram covers the status bar)
      applyInsets();
      if (wa.onEvent) {
        wa.onEvent('viewportChanged', applyInsets);
        wa.onEvent('safeAreaChanged', applyInsets);
      }
    } catch (e) {}
  }

  function applyInsets() {
    const s = (wa && (wa.safeAreaInset || wa.contentSafeAreaInset)) || null;
    const root = document.documentElement;
    if (s) {
      root.style.setProperty('--tg-top', (s.top || 0) + 'px');
      root.style.setProperty('--tg-bottom', (s.bottom || 0) + 'px');
    }
  }

  // Open a Telegram Stars invoice (returned as a link from our backend).
  // Resolves with the status string Telegram reports ('paid' | 'cancelled' | ...).
  function openInvoice(link) {
    return new Promise((resolve) => {
      if (!wa || !wa.openInvoice) { resolve('unsupported'); return; }
      try { wa.openInvoice(link, status => resolve(status)); }
      catch (e) { resolve('failed'); }
    });
  }

  return {
    inside, user,
    id: () => (user && user.id) || null,
    initData: () => (wa && wa.initData) || '',   // signed payload; verified server-side
    name: displayName,
    photo: () => (user && user.photo_url) || '',
    startParam: () => (wa && wa.initDataUnsafe && wa.initDataUnsafe.start_param) || '',
    inviteConfigured: () => !!inviteLink('X'),
    haptic, shareInvite, init, openInvoice,
  };
})();
