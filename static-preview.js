/* Joz Gallery: static preview helper (GitHub Pages copy only, not part of the store).
   The real store prices the cart, the delivery fee and search on the server. This
   copy has no server, so this script answers those requests in the browser from the
   catalog below, and sends orders to WhatsApp instead. It runs before app.js. */
(function () {
  'use strict';

  var DATA = window.JOZ_STATIC; // { products, governorates, coupons, whatsapp, text }
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  var T = DATA.text[lang];

  function fmt(n) { return Number(n).toLocaleString('en-US') + ' ' + T.currency; }

  function lines(items) {
    return (items || []).filter(function (i) { return DATA.products[i.product_id] && i.qty > 0; }).map(function (i) {
      var p = DATA.products[i.product_id];
      var qty = Math.min(i.qty, Math.max(p.stock, 0));
      return {
        product_id: +i.product_id, variant_id: null, name: p.name[lang], variant: null, image: p.image,
        url: p.url[lang], qty: qty, stock: p.stock, line_total: p.price * qty, line_total_formatted: fmt(p.price * qty)
      };
    }).filter(function (l) { return l.qty > 0; });
  }

  function cart(items) {
    var ls = lines(items);
    var subtotal = ls.reduce(function (n, l) { return n + l.line_total; }, 0);
    return { lines: ls, count: ls.reduce(function (n, l) { return n + l.qty; }, 0), subtotal: subtotal, subtotal_formatted: fmt(subtotal) };
  }

  function quote(body) {
    var c = cart(body.items);
    var gov = body.governorate_id ? DATA.governorates[body.governorate_id] : null;
    var code = (body.coupon || '').trim().toUpperCase();
    var coupon = null, message = null;
    if (code) {
      coupon = DATA.coupons.filter(function (k) { return k.code === code; })[0] || null;
      if (!coupon) message = T.couponInvalid;
      else if (c.subtotal < coupon.min) { message = T.couponMin.replace(':amount', fmt(coupon.min)); coupon = null; }
      else message = T.couponApplied;
    }
    var discount = !coupon ? 0 : coupon.type === 'percent'
      ? Math.floor((c.subtotal * Math.min(coupon.value, 100) + 50) / 100)
      : Math.min(coupon.value, c.subtotal);
    var fee = gov ? gov.fee : 0;
    return {
      lines: c.lines, count: c.count, subtotal_formatted: c.subtotal_formatted,
      discount: discount, discount_formatted: fmt(discount),
      delivery_fee_formatted: gov ? fmt(fee) : null,
      total_formatted: fmt(c.subtotal - discount + fee),
      coupon_applied: !!coupon, coupon_message: message
    };
  }

  function norm(s) {
    return (s || '').toLowerCase().replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  }

  function search(q) {
    q = norm(q.trim());
    var ids = Object.keys(DATA.products).filter(function (id) {
      var p = DATA.products[id];
      return q && norm(p.name.ar + ' ' + p.name.en + ' ' + p.section.ar + ' ' + p.section.en).indexOf(q) !== -1;
    }).slice(0, 6);
    return { results: ids.map(function (id) {
      var p = DATA.products[id];
      return { name: p.name[lang], section: p.section[lang], price: fmt(p.price), image: p.image, url: p.url[lang] };
    }) };
  }

  function json(data) {
    return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, options) {
    var path = String(url);
    var body = options && options.body ? JSON.parse(options.body) : {};
    if (/\/cart\/preview$/.test(path)) return json(cart(body.items));
    if (/\/checkout\/quote$/.test(path)) return json(quote(body));
    if (/\/search\/suggest\?/.test(path)) return json(search(decodeURIComponent(path.split('q=')[1] || '').replace(/\+/g, ' ')));
    return realFetch(url, options);
  };

  function storedCart() {
    try { return JSON.parse(localStorage.getItem('joz_cart')) || []; } catch (e) { return []; }
  }

  function openWhatsApp(text) {
    window.open('https://wa.me/' + DATA.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // Forms that would post to the server: the order goes to WhatsApp instead.
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    var action = form.getAttribute('action') || '';

    if (form.matches('[data-checkout]')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (el) { return !el.value.trim(); });
      if (missing.length) { missing[0].focus(); missing[0].reportValidity && missing[0].reportValidity(); return; }
      var q = quote({ items: storedCart(), governorate_id: form.elements.governorate_id.value, coupon: form.elements.coupon ? form.elements.coupon.value : '' });
      var gov = form.elements.governorate_id;
      var text = T.orderIntro + '\n' + q.lines.map(function (l) { return '• ' + l.name + ' × ' + l.qty + ' = ' + l.line_total_formatted; }).join('\n') +
        '\n' + T.total + ': ' + q.total_formatted +
        '\n' + T.name + ': ' + form.elements.name.value.trim() + ' (' + form.elements.phone.value.trim() + ')' +
        '\n' + T.address + ': ' + [gov.options[gov.selectedIndex].text.trim(), form.elements.area.value.trim(), form.elements.landmark.value.trim()].filter(Boolean).join('، ');
      openWhatsApp(text);
      return;
    }

    if (/\/track$/.test(action)) {
      ev.preventDefault();
      openWhatsApp(T.trackIntro + ' ' + (form.elements.number ? form.elements.number.value.trim() : ''));
      return;
    }

    if (form.matches('[data-search-form]')) {
      ev.preventDefault();
      var hit = search(form.elements.q.value).results[0];
      if (hit) window.location.href = hit.url;
    }
  }, true);

  // Filters and sorting need the server: hide them rather than offer controls that do nothing,
  // and give the products the column the filters used to take.
  var style = document.createElement('style');
  style.textContent = '.filters, .sorter { display: none !important; }' +
    '.listing__layout { grid-template-columns: minmax(0, 1fr) !important; }' +
    '@media (min-width: 1024px) { .listing__results .pgrid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }';
  document.head.appendChild(style);
})();
