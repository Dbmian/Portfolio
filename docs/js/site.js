(function () {
  'use strict';

  // ---- Tema claro/oscuro ----
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // ---- Botón "Copiar" en bloques de código ----
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var code = btn.closest('.code').querySelector('code').textContent;
    var label = btn.querySelector('span');
    var done = function () {
      label.textContent = 'Copiado';
      setTimeout(function () { label.textContent = 'Copiar'; }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () {});
  });

  // ---- Índice con sección activa ----
  var links = document.querySelectorAll('.toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.remove('is-active'); });
          var a = map[en.target.id];
          if (a) a.classList.add('is-active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.part').forEach(function (p) { io.observe(p); });
  }

  // ---- Lightbox (un <dialog> reutilizable) ----
  var galleries = document.querySelectorAll('[data-gallery]');
  if (!galleries.length) return;

  var dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Visor de imágenes');
  dlg.innerHTML =
    '<div class="lb-inner">' +
    '<button class="lb-btn lb-close" type="button" aria-label="Cerrar">✕</button>' +
    '<button class="lb-btn lb-prev" type="button" aria-label="Anterior">❮</button>' +
    '<img alt="">' +
    '<button class="lb-btn lb-next" type="button" aria-label="Siguiente">❯</button>' +
    '<div class="lb-caption"></div></div>';
  document.body.appendChild(dlg);

  var img = dlg.querySelector('img');
  var cap = dlg.querySelector('.lb-caption');
  var items = [];
  var idx = 0;

  function show(i) {
    idx = (i + items.length) % items.length;
    var a = items[idx];
    img.src = a.getAttribute('href');
    img.alt = a.querySelector('img').alt;
    var c = a.getAttribute('data-caption');
    cap.textContent = (c ? c + ' · ' : '') + (idx + 1) + ' / ' + items.length;
  }

  galleries.forEach(function (g) {
    g.addEventListener('click', function (e) {
      var a = e.target.closest('.shot');
      if (!a) return;
      e.preventDefault();
      items = Array.prototype.slice.call(g.querySelectorAll('.shot'));
      show(items.indexOf(a));
      dlg.showModal();
    });
  });

  dlg.addEventListener('click', function (e) {
    if (e.target.closest('.lb-close') || e.target === dlg || e.target.classList.contains('lb-inner')) dlg.close();
    else if (e.target.closest('.lb-prev')) show(idx - 1);
    else if (e.target.closest('.lb-next')) show(idx + 1);
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  // Deslizar en celulares
  var x0 = null;
  dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
