/* Mission Church at Fort Wayne: site script (shared by every page).
   Every feature checks that its elements exist first, so a page without them is unaffected.
   Motion respects prefers-reduced-motion. The saved theme is applied earlier, by an inline script in <head>. */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduce = mm('(prefers-reduced-motion: reduce)').matches;
  var THEME_KEY = 'mc-theme';

  /* ---- Theme toggle ---- */
  var tb = $('theme-btn'), dark = mm('(prefers-color-scheme: dark)');
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : dark.matches; }
  function syncTheme() {
    if (!tb) return;
    var d = isDark();
    tb.setAttribute('aria-pressed', String(d));
    tb.querySelector('.tl').textContent = d ? 'Light mode' : 'Dark mode';
    tb.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (tb) {
    syncTheme();
    tb.addEventListener('click', function () {
      var n = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', n);
      try { localStorage.setItem(THEME_KEY, n); } catch (e) {}
      syncTheme();
    });
    if (dark.addEventListener) dark.addEventListener('change', syncTheme);
  }

  /* ---- Next service line (home) ---- */
  var ns = $('next-service');
  if (ns) {
    var now = new Date(), d = new Date(now), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    var add = (7 - day) % 7; if (day === 0 && mins >= 630) add = 7;
    d.setDate(now.getDate() + add);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    ns.textContent = 'Next service: ' + (add === 0 ? 'today' : 'Sunday, ' + months[d.getMonth()] + ' ' + d.getDate()) + ' at 9:30 a.m.';
  }

  /* ---- Mobile menu ---- */
  var mnav = $('mnav'), mbtn = $('menu-btn');
  function openMenu() { mnav.hidden = false; mbtn.setAttribute('aria-expanded', 'true'); mbtn.textContent = 'Close'; var a = mnav.querySelector('a'); if (a) a.focus(); }
  function closeMenu(ret) { if (!mnav || mnav.hidden) return; mnav.hidden = true; mbtn.setAttribute('aria-expanded', 'false'); mbtn.textContent = 'Menu'; if (ret) mbtn.focus(); }
  if (mnav && mbtn) {
    mbtn.addEventListener('click', function () { mnav.hidden ? openMenu() : closeMenu(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) closeMenu(false); });
  }

  /* ---- Same-page jumps (skip link, "on this page" lists, ministry jump buttons) ----
     Smooth-scroll (unless reduced motion), keep the URL fragment, and move keyboard focus to the target. */
  function jumpTo(t, id) {
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|DETAILS)$/.test(t.tagName)) t.setAttribute('tabindex', '-1');
    if (t.tagName === 'DETAILS') { t.open = true; t = t.querySelector('summary') || t; }
    t.focus({ preventScroll: true });
    if (id && history.replaceState) history.replaceState(null, '', '#' + id);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"],[data-scroll],[data-jump]');
    if (!a) return;
    var id = a.getAttribute('data-scroll') || a.getAttribute('data-jump') || (a.getAttribute('href') || '').slice(1);
    var t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    closeMenu(false);
    jumpTo(t, id === 'main' ? null : id);
  });

  /* ---- FAQ: open the linked question (/faq/#faq-3) ---- */
  function openFaqFromHash() {
    var m = /^#(faq-\d+)$/.exec(location.hash), el = m && document.getElementById(m[1]);
    if (!el) return;
    el.open = true;
    requestAnimationFrame(function () { el.scrollIntoView({ block: 'start' }); var s = el.querySelector('summary'); if (s) s.focus({ preventScroll: true }); });
  }
  openFaqFromHash();
  window.addEventListener('hashchange', openFaqFromHash);

  /* ---- Copy buttons (phone, email, Venmo, FAQ links) ---- */
  function selectEl(el) { try { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }
  function flash(btn, txt) { var o = btn.getAttribute('data-label') || btn.textContent; btn.setAttribute('data-label', o); btn.textContent = txt; setTimeout(function () { btn.textContent = o; }, 2200); }
  function copy(text, btn, fallbackEl) {
    var fail = function () { if (fallbackEl) selectEl(fallbackEl); flash(btn, 'Selected, press Ctrl+C'); };
    try { navigator.clipboard.writeText(text).then(function () { flash(btn, 'Copied'); }, fail); } catch (e) { fail(); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (b) { copy(b.getAttribute('data-copy'), b, $(b.getAttribute('data-target'))); return; }
    var f = e.target.closest('[data-faqlink]');
    if (f) {
      var url = location.origin + '/mission-church-preview/faq/#faq-' + f.getAttribute('data-faqlink'), live = f.nextElementSibling;
      var tmp = document.createElement('span'); tmp.textContent = url; tmp.className = 'sr-only'; f.parentNode.appendChild(tmp);
      copy(url, f, tmp); setTimeout(function () { tmp.remove(); }, 4000);
      if (live) live.textContent = 'Link copied';
    }
  });

  /* ---- Give: card note ---- */
  var cb = $('card-btn'), cn = $('card-note');
  if (cb && cn) cb.addEventListener('click', function () { cn.hidden = false; cb.setAttribute('aria-expanded', 'true'); });

  /* ---- Contact form: validation, spam trap, sending ----
     Bots tick the hidden "botcheck" box and submit instantly; people do neither. A trapped submission
     looks successful to the bot but is dropped. Web3Forms also rejects botcheck server-side.
     Messages go to the church's email through Web3Forms once the build sets data-key (WEB3FORMS_KEY). */
  var form = $('contact-form'), note = $('form-note'), started = Date.now();
  if (form && note) {
    var sending = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      var fn = $('f-first'), em = $('f-email'), hp = $('f-botcheck');
      var trapped = (hp && hp.checked) || Date.now() - started < 3000;
      var miss = [];
      if (!fn.value.trim()) miss.push('your first name');
      if (!em.value.trim() || !em.checkValidity()) miss.push('an email address we can reply to');
      fn.setAttribute('aria-invalid', String(!fn.value.trim()));
      em.setAttribute('aria-invalid', String(!em.value.trim() || !em.checkValidity()));
      note.hidden = false;
      if (miss.length) { note.textContent = 'Please add ' + miss.join(' and ') + '.'; (miss[0].indexOf('first') > -1 ? fn : em).focus(); return; }
      var thanks = 'Thank you. Your message was sent, and someone from the church will reply by email.';
      if (trapped) { note.textContent = thanks; form.reset(); return; }
      var key = form.getAttribute('data-key');
      if (!key) { note.textContent = 'Preview only. This form isn\u2019t connected yet.'; return; }
      var v = function (id) { var x = $(id); return x ? x.value.trim() : ''; };
      var btn = form.querySelector('button[type="submit"]');
      sending = true; if (btn) btn.disabled = true; note.textContent = 'Sending\u2026';
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: key, subject: 'Website message from ' + v('f-first') + ' ' + v('f-last'), from_name: 'Mission Church website',
          name: (v('f-first') + ' ' + v('f-last')).trim(), email: v('f-email'), phone: v('f-phone'), message: v('f-msg'), botcheck: false
        })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.success) throw new Error('not sent');
        note.textContent = thanks; form.reset();
      }).catch(function () {
        note.textContent = 'Sorry, your message didn\u2019t send. Please email MissionChurchFW@gmail.com or leave a message at (260) 222-7135.';
      }).then(function () { sending = false; if (btn) btn.disabled = false; });
    });
  }

  /* ---- Serving rail (home) ---- */
  var rail = $('rail'), prev = $('rail-prev'), next = $('rail-next');
  if (rail && prev && next) {
    var step = function () { var it = rail.querySelector('.rail-item'); return it ? it.getBoundingClientRect().width + 56 : 400; };
    var st = function () { prev.disabled = rail.scrollLeft < 8; next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8; };
    prev.addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    next.addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    rail.addEventListener('scroll', st, { passive: true }); window.addEventListener('resize', st); st();
  }

  /* ---- Watch: sermon clips play in the player dialog. A tile with a video is a link to the MP4 (so it still
     opens without script); a tile without one yet shows the placeholder player. ---- */
  var dlg = $('clip-dialog');
  if (dlg) {
    var reel = $('dlg-reel'), emptyReel = reel.innerHTML, opener = null;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clip]'); if (!b) return;
      e.preventDefault(); opener = b;
      var t = b.getAttribute('data-title') || 'Best of Mission Church', src = b.tagName === 'A' ? b.getAttribute('href') : '';
      $('dlg-title').textContent = t;
      if (src) {
        var v = document.createElement('video'), poster = b.querySelector('img');
        v.src = src; v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
        if (poster) v.poster = poster.currentSrc || poster.src;
        v.setAttribute('aria-label', t);
        reel.className = 'reel has-video'; reel.innerHTML = ''; reel.appendChild(v);
      } else {
        reel.className = 'reel'; reel.innerHTML = emptyReel; $('dlg-label').textContent = t;
      }
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      var vid = reel.querySelector('video');
      if (vid) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
      $('dlg-close').focus();
    });
    // stop and clear the video on every way out (button, backdrop, Esc), not only on the close event,
    // which some browsers don't fire reliably
    var tidy = function () {
      var vid = reel.querySelector('video'); if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
      reel.className = 'reel'; reel.innerHTML = emptyReel;
      if (opener) { opener.focus(); opener = null; }
    };
    var shut = function () { if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } tidy(); };
    $('dlg-close').addEventListener('click', shut);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) shut(); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
    dlg.addEventListener('close', tidy);
  }

  /* ---- Depth reveal: offset sheets slide out from behind photos (content is always visible) ---- */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove('pre'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.depth').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) { el.classList.add('pre'); io.observe(el); }
    });
  }

  /* ---- Scroll reveals (CSS scroll-driven; this only tags the targets) ---- */
  var main = document.querySelector('main');
  if (main) {
    var SKIP = '.hero,.phero,.page-head,.v17_page-head,nav,header,dialog,footer,.rv,[class*="rail"],.v17 .hero';
    main.querySelectorAll('h2,h3,p,figure,li,blockquote,details,dl,form,.btn,.v17_btn,.v18_btn,.sun-time,.depth,[class*="stack"]').forEach(function (el) {
      if (el.closest(SKIP) || (el.parentElement && el.parentElement.closest('.p22r'))) return;
      el.classList.add('p22r');
    });
  }

  /* ---- Header shadow once scrolled ---- */
  var head = document.querySelector('.head');
  if (head) {
    var onScroll = function () { head.classList.toggle('scrolled', window.scrollY > 4); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---- Print: expand collapsed sections (directions, FAQ answers) so they print ---- */
  var closedForPrint = [];
  window.addEventListener('beforeprint', function () {
    closedForPrint = [].slice.call(document.querySelectorAll('details:not([open])'));
    closedForPrint.forEach(function (x) { x.open = true; });
  });
  window.addEventListener('afterprint', function () { closedForPrint.forEach(function (x) { x.open = false; }); closedForPrint = []; });

  /* ---- Cursor glow (fine pointers, motion allowed) ---- */
  if (main && !reduce && mm('(pointer:fine)').matches) {
    var g = document.createElement('div'); g.className = 'cursor-glow'; g.setAttribute('aria-hidden', 'true'); main.prepend(g);
    var tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;
    var tick = function () { x += (tx - x) * 0.12; y += (ty - y) * 0.12; g.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) ? requestAnimationFrame(tick) : 0; };
    document.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; g.classList.add('on'); if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
    root.addEventListener('pointerleave', function () { g.classList.remove('on'); });
  }
})();
