// ===== Skin shop + inventory =====
// Client module. The backend (/api/*) is the AUTHORITY for ownership and
// purchases. When it's unreachable (plain browser / v0 preview / opened outside
// Telegram) we fall back to a small local cache so free skins can still be
// equipped and the game keeps working. Paid skins are only ever granted by the
// backend after a verified Telegram Stars payment — the local cache can't
// fabricate ownership of a paid skin.

(function () {
  // ---- i18n strings (merged into the existing i18n tables) ----
  const STR = {
    ru: { shopTitle: 'Магазин фишек', shopBtn: 'Магазин фишек', equip: 'Выбрать', equipped: 'Выбрано',
      free: 'Бесплатно', needTg: 'Покупки доступны в приложении Telegram', purchased: 'Куплено!',
      purchaseFail: 'Не удалось оформить покупку', close: 'Закрыть',
      identityNote: 'Твой цвет всегда виден на кольце у основания фишки', buying: 'Оплата…' },
    uk: { shopTitle: 'Магазин фішок', shopBtn: 'Магазин фішок', equip: 'Обрати', equipped: 'Обрано',
      free: 'Безкоштовно', needTg: 'Покупки доступні в застосунку Telegram', purchased: 'Придбано!',
      purchaseFail: 'Не вдалося оформити покупку', close: 'Закрити',
      identityNote: 'Твій колір завжди видно на кільці біля основи фішки', buying: 'Оплата…' },
    en: { shopTitle: 'Token Shop', shopBtn: 'Token shop', equip: 'Equip', equipped: 'Equipped',
      free: 'Free', needTg: 'Purchases are available in the Telegram app', purchased: 'Purchased!',
      purchaseFail: 'Purchase failed', close: 'Close',
      identityNote: 'Your color always shows on the ring at the token base', buying: 'Paying…' },
    de: { shopTitle: 'Figuren-Shop', shopBtn: 'Figuren-Shop', equip: 'Wählen', equipped: 'Gewählt',
      free: 'Gratis', needTg: 'Käufe sind in der Telegram-App verfügbar', purchased: 'Gekauft!',
      purchaseFail: 'Kauf fehlgeschlagen', close: 'Schließen',
      identityNote: 'Deine Farbe ist immer am Ring am Figurenfuß sichtbar', buying: 'Zahlung…' },
  };
  Object.keys(STR).forEach(l => { if (typeof I18N !== 'undefined' && I18N[l]) Object.assign(I18N[l], STR[l]); });
  const ts = k => (typeof I18N !== 'undefined' && I18N[LANG] && I18N[LANG][k]) || STR.en[k] || k;

  // ---- inventory state ----
  let owned = FREE_SKINS.slice();
  let equipped = DEFAULT_SKIN;
  const LS_OWNED = 'mono_owned', LS_SKIN = 'mono_skin';

  function loadLocal() {
    try {
      const o = JSON.parse(localStorage.getItem(LS_OWNED) || '[]');
      owned = Array.from(new Set(FREE_SKINS.concat(Array.isArray(o) ? o : [])));
      equipped = validSkin(localStorage.getItem(LS_SKIN) || DEFAULT_SKIN, owned);
    } catch (e) { owned = FREE_SKINS.slice(); equipped = DEFAULT_SKIN; }
  }
  function saveLocal() {
    try {
      // Only cache PAID ids the backend already granted; free skins are implicit.
      localStorage.setItem(LS_OWNED, JSON.stringify(owned.filter(id => !FREE_SKINS.includes(id))));
      localStorage.setItem(LS_SKIN, equipped);
    } catch (e) {}
  }
  function syncNet() {
    if (typeof NET !== 'undefined') { NET.mySkin = equipped; NET.myOwned = owned.slice(); }
  }

  // ---- backend ----
  const hasBackend = () => typeof TG !== 'undefined' && TG.inside && !!TG.initData();
  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign(
        { 'X-Telegram-Init-Data': TG.initData() },
        body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error('api ' + res.status);
    return res.json();
  }

  async function load() {
    loadLocal(); syncNet();          // instant baseline from local cache
    if (hasBackend()) {
      try {
        const me = await api('/api/me');
        if (me && Array.isArray(me.owned)) {
          owned = Array.from(new Set(FREE_SKINS.concat(me.owned)));
          equipped = validSkin(me.equipped || equipped, owned);
          saveLocal(); syncNet();
        }
      } catch (e) { /* offline — keep the local baseline */ }
    }
    render();
  }

  async function equip(id) {
    if (!owned.includes(id) || id === equipped) return;
    equipped = id; saveLocal(); syncNet(); render();
    if (typeof TG !== 'undefined') TG.haptic('select');
    if (hasBackend()) { try { await api('/api/equip', { skin: id }); } catch (e) {} }
  }

  const busy = new Set();
  async function buy(id) {
    const s = skinById(id);
    if (!s || s.price === 0 || owned.includes(id) || busy.has(id)) return;
    if (!hasBackend()) { toast(ts('needTg')); if (typeof TG !== 'undefined') TG.haptic('error'); return; }
    busy.add(id); render();
    try {
      const out = await api('/api/purchase/create', { skin: id });
      const status = await TG.openInvoice(out.invoiceLink);
      if (status === 'paid') {
        // The webhook grants the item server-side; re-read to confirm.
        try {
          const me = await api('/api/me');
          if (me && me.owned) owned = Array.from(new Set(FREE_SKINS.concat(me.owned)));
        } catch (e) { owned = Array.from(new Set(owned.concat(id))); }
        saveLocal(); syncNet();
        toast(ts('purchased')); TG.haptic('success');
        busy.delete(id);
        equip(id);
        return;
      } else if (status !== 'cancelled') {
        toast(ts('purchaseFail'));
      }
    } catch (e) {
      toast(ts('purchaseFail')); TG.haptic('error');
    }
    busy.delete(id); render();
  }

  // ---- DOM ----
  let overlay, grid, toastEl, toastTimer;
  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'shop-overlay';
    overlay.innerHTML =
      '<div class="shop-panel" role="dialog" aria-modal="true" aria-label="' + esc(ts('shopTitle')) + '">' +
        '<div class="shop-head">' +
          '<div class="shop-title">' + esc(ts('shopTitle')) + '</div>' +
          '<button class="shop-close" aria-label="' + esc(ts('close')) + '">&#10005;</button>' +
        '</div>' +
        '<div class="shop-note">' + esc(ts('identityNote')) + '</div>' +
        '<div class="shop-grid"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    grid = overlay.querySelector('.shop-grid');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.shop-close').addEventListener('click', close);
    grid.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'equip') equip(id);
      else if (btn.dataset.act === 'buy') buy(id);
    });
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function cardHtml(s) {
    const isOwned = owned.includes(s.id);
    const isEq = equipped === s.id;
    const grad = 'linear-gradient(140deg,' + s.swatch[0] + ',' + s.swatch[1] + ')';
    let cta;
    if (isEq) cta = '<button class="shop-btn is-eq" disabled>' + esc(ts('equipped')) + '</button>';
    else if (isOwned) cta = '<button class="shop-btn" data-act="equip" data-id="' + s.id + '">' + esc(ts('equip')) + '</button>';
    else if (busy.has(s.id)) cta = '<button class="shop-btn buy" disabled>' + esc(ts('buying')) + '</button>';
    else if (s.price === 0) cta = '<button class="shop-btn" data-act="equip" data-id="' + s.id + '">' + esc(ts('equip')) + '</button>';
    else cta = '<button class="shop-btn buy" data-act="buy" data-id="' + s.id + '"><span class="star">&#9733;</span> ' + s.price + '</button>';
    return '<div class="skin-card' + (isEq ? ' is-equipped' : '') + '">' +
        '<div class="skin-prev" style="background:' + grad + '"><span class="skin-ico">' + s.icon + '</span></div>' +
        '<div class="skin-name">' + esc(skinName(s.id)) + '</div>' +
        cta +
      '</div>';
  }

  function render() {
    if (!grid) return;
    grid.innerHTML = SKINS.map(cardHtml).join('');
    overlay.querySelector('.shop-title').textContent = ts('shopTitle');
    overlay.querySelector('.shop-note').textContent = ts('identityNote');
  }

  function open() { ensureDom(); render(); requestAnimationFrame(() => overlay.classList.add('is-open')); }
  function close() { if (overlay) overlay.classList.remove('is-open'); }

  function toast(msg) {
    ensureDom();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'shop-toast'; overlay.querySelector('.shop-panel').appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  }

  window.SHOP = {
    load, open, close, equip, buy,
    owned: () => owned.slice(),
    equipped: () => equipped,
  };
})();
