/* Joz Gallery: storefront behaviour (vanilla, no dependencies) */
(function () {
  'use strict';

  var PREVIEW = !!document.querySelector('[data-preview]');
  var CART_KEY = 'joz_cart';
  var LANG_KEY = 'joz_preview_lang';

  /* ---------- Safe storage ---------- */
  var memory = {};
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return key in memory ? memory[key] : fallback; }
  }
  function save(key, value) {
    memory[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* ---------- Cart (shared across both language views) ---------- */
  var cart = load(CART_KEY, []);
  if (!Array.isArray(cart)) cart = [];
  var listeners = [];
  function setCart(next) {
    cart = next.filter(function (l) { return l.qty > 0; });
    save(CART_KEY, cart);
    listeners.forEach(function (fn) { fn(); });
  }
  function addToCart(slug) {
    var next = cart.map(function (l) { return { slug: l.slug, qty: l.qty }; });
    var line = next.find(function (l) { return l.slug === slug; });
    if (line) line.qty += 1; else next.push({ slug: slug, qty: 1 });
    setCart(next);
  }
  function changeQty(slug, delta) {
    setCart(cart.map(function (l) { return { slug: l.slug, qty: l.slug === slug ? l.qty + delta : l.qty }; }));
  }

  function fmt(n, currency) { return n.toLocaleString('en-US') + ' ' + currency; }

  // Arabic-friendly normalisation for search
  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Per-language site root ---------- */
  function initSite(root) {
    var i18n = JSON.parse(root.querySelector('[data-i18n]').textContent);
    var toastEl = root.querySelector('[data-toast]');
    var toastTimer;

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
    }
    root.toast = toast;

    // The welcome page has no header, cart or search.
    var catalogEl = root.querySelector('[data-catalog]');
    if (!catalogEl) return;
    var catalog = JSON.parse(catalogEl.textContent);

    /* Dialogs */
    function dialog(name) { return root.querySelector('[data-dialog="' + name + '"]'); }
    root.addEventListener('click', function (ev) {
      var opener = ev.target.closest('[data-open]');
      if (opener) {
        var d = dialog(opener.getAttribute('data-open'));
        if (d && !d.open) {
          d.showModal();
          if (d.matches('[data-dialog="search"]')) d.querySelector('input').focus();
        }
        return;
      }
      var closer = ev.target.closest('[data-close]');
      if (closer) { closer.closest('dialog').close(); return; }
      if (ev.target.tagName === 'DIALOG') { ev.target.close(); return; }
      var link = ev.target.closest('dialog a[href^="#"]');
      if (link) link.closest('dialog').close();
    });

    /* Cart UI */
    var linesEl = root.querySelector('[data-cart-lines]');
    var emptyEl = root.querySelector('[data-cart-empty]');
    var footEl = root.querySelector('[data-cart-foot]');
    var subtotalEl = root.querySelector('[data-cart-subtotal]');
    var countTextEl = root.querySelector('[data-cart-count-text]');
    var waEl = root.querySelector('[data-cart-whatsapp]');
    var waBase = waEl.getAttribute('href');

    function renderCart() {
      var lines = cart.filter(function (l) { return catalog[l.slug]; });
      var count = lines.reduce(function (n, l) { return n + l.qty; }, 0);
      var total = lines.reduce(function (n, l) { return n + l.qty * catalog[l.slug].price; }, 0);

      root.querySelectorAll('[data-cart-count]').forEach(function (b) {
        b.textContent = count; b.hidden = count === 0;
      });
      countTextEl.textContent = count ? '(' + count + ')' : '';
      emptyEl.hidden = count > 0;
      footEl.hidden = count === 0;
      linesEl.hidden = count === 0;
      subtotalEl.textContent = fmt(total, i18n.currency);

      linesEl.innerHTML = lines.map(function (l) {
        var p = catalog[l.slug];
        return '<li class="cart-line">' +
          '<img src="' + esc(p.img) + '" alt="" width="76" height="92">' +
          '<div class="cart-line__info"><span class="cart-line__name">' + esc(p.name) + '</span>' +
          '<span class="cart-line__price">' + fmt(p.price * l.qty, i18n.currency) + '</span>' +
          '<div class="qty"><button type="button" data-qty="-1" data-slug="' + esc(l.slug) + '" aria-label="' + esc(i18n.minus) + '"><svg class="ico"><use href="#i-minus"></use></svg></button>' +
          '<output>' + l.qty + '</output>' +
          '<button type="button" data-qty="1" data-slug="' + esc(l.slug) + '" aria-label="' + esc(i18n.plus) + '"><svg class="ico"><use href="#i-plus"></use></svg></button></div></div>' +
          '<button class="icon-btn cart-line__remove" type="button" data-remove="' + esc(l.slug) + '" aria-label="' + esc(i18n.remove) + '"><svg class="ico"><use href="#i-trash"></use></svg></button>' +
          '</li>';
      }).join('');

      var msg = i18n.waIntro + '\n' + lines.map(function (l) {
        return '• ' + catalog[l.slug].name + ' × ' + l.qty + ' = ' + fmt(catalog[l.slug].price * l.qty, i18n.currency);
      }).join('\n') + '\n' + i18n.subtotal + ': ' + fmt(total, i18n.currency);
      waEl.setAttribute('href', waBase + '?text=' + encodeURIComponent(msg));
    }
    listeners.push(renderCart);
    renderCart();

    linesEl.addEventListener('click', function (ev) {
      var q = ev.target.closest('[data-qty]');
      if (q) { changeQty(q.getAttribute('data-slug'), +q.getAttribute('data-qty')); return; }
      var r = ev.target.closest('[data-remove]');
      if (r) changeQty(r.getAttribute('data-remove'), -Infinity);
    });

    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-add]');
      if (!btn) return;
      addToCart(btn.getAttribute('data-add'));
      btn.classList.add('is-added');
      setTimeout(function () { btn.classList.remove('is-added'); }, 1200);
      toast(i18n.added + ': ' + catalog[btn.getAttribute('data-add')].name);
    });

    /* Instant search */
    var input = root.querySelector('[data-search-input]');
    var results = root.querySelector('[data-search-results]');
    var empty = root.querySelector('[data-search-empty]');
    var popular = root.querySelector('[data-search-popular]');
    function runSearch() {
      var q = norm(input.value.trim());
      popular.hidden = q.length > 0;
      if (!q) { results.innerHTML = ''; empty.hidden = true; return; }
      var hits = Object.keys(catalog).filter(function (slug) {
        var p = catalog[slug];
        return norm(p.name + ' ' + p.alt + ' ' + p.sec).indexOf(q) !== -1;
      }).slice(0, 6);
      empty.hidden = hits.length > 0;
      results.innerHTML = hits.map(function (slug) {
        var p = catalog[slug];
        return '<li><a href="' + esc(p.url) + '"><img src="' + esc(p.img) + '" alt="" width="56" height="66">' +
          '<span><small>' + esc(p.sec) + '</small>' + esc(p.name) + '<b>' + fmt(p.price, i18n.currency) + '</b></span></a></li>';
      }).join('');
    }
    input.addEventListener('input', runSearch);
    root.querySelectorAll('[data-search-term]').forEach(function (chip) {
      chip.addEventListener('click', function () { input.value = chip.getAttribute('data-search-term'); runSearch(); input.focus(); });
    });
    root.querySelector('[data-search-form]').addEventListener('submit', function (ev) {
      if (PREVIEW || !input.value.trim()) ev.preventDefault();
    });

    /* Hero slider */
    var slider = root.querySelector('[data-slider]');
    if (slider) initSlider(slider, root);

    /* Section pages: tabs + swipe to the next/previous section */
    var sectionPage = root.querySelector('[data-section-page]');
    if (sectionPage) initSectionSwipe(sectionPage, root);
  }

  var VT_KEY = 'joz_vt';
  function rememberDirection(dir) {
    try { sessionStorage.setItem(VT_KEY, dir); } catch (e) { /* ignore */ }
  }

  function initSectionSwipe(page, root) {
    var rtl = root.getAttribute('dir') === 'rtl';
    var tabs = Array.prototype.slice.call(page.querySelectorAll('.sec-tab'));
    var currentIndex = tabs.findIndex(function (t) { return t.getAttribute('aria-current') === 'page'; });
    var current = tabs[currentIndex];

    // Bring the current tab into view without moving the page.
    function centreTab() {
      if (!current || root.hidden) return;
      var list = current.closest('[data-tabs]');
      var r = current.getBoundingClientRect(), lr = list.getBoundingClientRect();
      list.scrollLeft += (r.left + r.width / 2) - (lr.left + lr.width / 2);
    }
    centreTab();
    root.centreTab = centreTab;

    // Direction for the slide animation on the next page.
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { rememberDirection(i > currentIndex ? 'forward' : 'backward'); });
    });
    page.querySelectorAll('[data-nav-dir]').forEach(function (a) {
      a.addEventListener('click', function () { rememberDirection(a.getAttribute('data-nav-dir') === 'next' ? 'forward' : 'backward'); });
    });

    var area = page.querySelector('[data-swipe-area]');
    var startX = 0, startY = 0, startT = 0, tracking = false;
    area.addEventListener('touchstart', function (ev) {
      if (ev.touches.length !== 1 || ev.target.closest('.offers__rail, input, select, textarea, dialog')) { tracking = false; return; }
      tracking = true;
      startX = ev.touches[0].clientX; startY = ev.touches[0].clientY; startT = Date.now();
    }, { passive: true });
    area.addEventListener('touchend', function (ev) {
      if (!tracking) return;
      tracking = false;
      var t = ev.changedTouches[0];
      var dx = t.clientX - startX, dy = t.clientY - startY;
      // A clear sideways flick: far enough, mostly horizontal, reasonably quick.
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - startT > 800) return;
      var forward = rtl ? dx > 0 : dx < 0;
      rememberDirection(forward ? 'forward' : 'backward');
      window.location.href = page.getAttribute(forward ? 'data-next' : 'data-prev');
    }, { passive: true });
  }

  /* ---------- Welcome background video ---------- */
  function syncVideos() {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    document.querySelectorAll('[data-welcome-video]').forEach(function (v) {
      var root = v.closest('[data-site]');
      if (reduce || saveData || (root && root.hidden)) { v.pause(); return; }
      if (!v.getAttribute('src')) {
        var portrait = window.matchMedia('(orientation: portrait)').matches;
        v.src = v.getAttribute(portrait ? 'data-portrait' : 'data-wide');
        v.addEventListener('playing', function () { v.classList.add('is-playing'); });
      }
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
    });
  }

  function initSlider(slider, root) {
    var track = slider.querySelector('[data-track]');
    var slides = Array.prototype.slice.call(slider.querySelectorAll('[data-slide]'));
    var dots = Array.prototype.slice.call(slider.querySelectorAll('[data-dot]'));
    var current = 0, timer = null, paused = false;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    }
    function setActive(i) {
      current = i;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    setActive(0);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio > 0.6) setActive(slides.indexOf(en.target));
        });
      }, { root: track, threshold: [0.6] });
      slides.forEach(function (s) { io.observe(s); });
    }

    slider.querySelector('[data-prev]').addEventListener('click', function () { go(current - 1); });
    slider.querySelector('[data-next]').addEventListener('click', function () { go(current + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });

    function tick() {
      if (!paused && !root.hidden && document.visibilityState === 'visible') go(current + 1);
    }
    if (!reduce) timer = setInterval(tick, 6000);
    ['mouseenter', 'focusin', 'touchstart'].forEach(function (t) {
      slider.addEventListener(t, function () { paused = true; }, { passive: true });
    });
    ['mouseleave', 'focusout'].forEach(function (t) {
      slider.addEventListener(t, function () { paused = false; });
    });
  }

  /* ---------- Countdowns ---------- */
  function initCountdowns() {
    var els = document.querySelectorAll('[data-countdown]');
    if (!els.length) return;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function update() {
      els.forEach(function (el) {
        var left = Math.max(0, Math.floor((new Date(el.getAttribute('data-countdown')) - Date.now()) / 1000));
        var v = { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600), m: Math.floor(left % 3600 / 60), s: left % 60 };
        el.querySelectorAll('[data-unit]').forEach(function (b) { b.textContent = pad(v[b.getAttribute('data-unit')]); });
      });
    }
    update();
    setInterval(update, 1000);
  }

  /* ---------- Design preview helpers ---------- */
  function initPreview(sites) {
    function show(lang) {
      sites.forEach(function (s) {
        var on = s.getAttribute('data-site') === lang;
        s.hidden = !on;
        if (!on) s.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); });
      });
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      save(LANG_KEY, lang);
      sites.forEach(function (s) { if (!s.hidden && s.centreTab) s.centreTab(); });
      syncVideos();
    }
    var saved = load(LANG_KEY, 'ar');
    if (saved !== 'ar' && saved !== 'en') saved = 'ar';
    show(saved);

    document.addEventListener('click', function (ev) {
      var sw = ev.target.closest('[data-lang-switch]');
      if (sw) {
        ev.preventDefault();
        var next = sw.closest('[data-site]').getAttribute('data-site') === 'ar' ? 'en' : 'ar';
        show(next);
        window.scrollTo({ top: 0 });
        return;
      }
      var a = ev.target.closest('a[href^="#/"]');
      if (a) {
        ev.preventDefault();
        var root = a.closest('[data-site]');
        root.toast(JSON.parse(root.querySelector('[data-i18n]').textContent).preview);
      }
    });
  }

  /* ---------- Boot ---------- */
  var sites = Array.prototype.slice.call(document.querySelectorAll('[data-site]'));
  sites.forEach(initSite);
  initCountdowns();
  if (PREVIEW) initPreview(sites); else syncVideos();
})();
