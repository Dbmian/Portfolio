(function () {
  'use strict';

  // ---------- Utilidades ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var uid = function () { return Math.random().toString(16).slice(2, 10); };
  function move(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  function toast(msg, isError) {
    var box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    var t = h('div', { class: 'toast' + (isError ? ' error' : '') }, msg);
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, isError ? 5000 : 2400);
  }

  function api(method, url, body, isForm) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'portfolio-admin' } };
    if (isForm) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api/admin' + url, opts).then(function (r) {
      if (r.status === 401) { location.href = '/admin/login'; throw new Error('Sesión vencida'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Ocurrió un error');
        return j;
      });
    });
  }

  // ---------- Estado ----------
  var state = { user: '', site: null, tutorials: [] };
  var editing = null;       // copia de trabajo del tutorial abierto
  var isNew = false;
  var dirty = false;
  var openParts = {};       // id de parte -> abierta
  var app = document.getElementById('app');

  var STATUS = { published: 'Publicado', soon: 'Próximamente', draft: 'Borrador' };
  var BLOCKS = [
    ['text', 'Texto'], ['list', 'Lista de pasos'], ['code', 'Código'], ['images', 'Imágenes'], ['note', 'Nota destacada']
  ];

  function markDirty() {
    if (dirty) return;
    dirty = true;
    var d = document.getElementById('dirty');
    var s = document.getElementById('save');
    if (d) { d.textContent = 'Cambios sin guardar'; d.classList.add('on'); }
    if (s) s.disabled = false;
  }

  function confirmLeave() {
    return !dirty || confirm('Tenés cambios sin guardar. ¿Salir igual?');
  }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Router ----------
  var lastHash = location.hash;
  var reverting = false;
  window.addEventListener('hashchange', function () {
    if (reverting) { reverting = false; return; }
    if (location.hash !== lastHash && !confirmLeave()) { reverting = true; location.hash = lastHash; return; }
    dirty = false;
    lastHash = location.hash;
    route();
  });

  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'tutorial' && parts[1]) return viewEditor(parts[1]);
    if (parts[0] === 'nuevo') return viewEditor(null);
    if (parts[0] === 'sitio') return shell('sitio', viewSite());
    if (parts[0] === 'cuenta') return shell('cuenta', viewAccount());
    shell('tutoriales', viewList());
  }

  function shell(active, content) {
    var link = function (href, key, label) { return h('a', { href: href, class: active === key ? 'active' : '' }, label); };
    app.replaceChildren(
      h('div', { class: 'shell' },
        h('aside', { class: 'side' },
          h('div', { class: 'side-brand' }, 'Panel', h('small', null, state.site.name)),
          h('nav', null,
            link('#/', 'tutoriales', 'Tutoriales'),
            link('#/sitio', 'sitio', 'Sitio y perfil'),
            link('#/cuenta', 'cuenta', 'Cuenta')),
          h('div', { class: 'side-foot' },
            h('span', { class: 'who' }, 'Sesión: ' + state.user),
            h('a', { class: 'btn btn-sm', href: '/', target: '_blank', rel: 'noopener' }, 'Ver sitio ↗'),
            h('button', { class: 'btn btn-sm', type: 'button', onclick: logout }, 'Salir'))),
        h('main', { class: 'content' }, content)));
  }

  function logout() {
    if (!confirmLeave()) return;
    dirty = false;
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.href = '/admin/login'; });
  }

  // ---------- Vista: lista de tutoriales ----------
  function viewList() {
    var list = state.tutorials;
    var fmt = function (iso) { try { return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
    var rows = list.map(function (t, i) {
      return h('div', { class: 't-row' },
        h('div', null,
          h('h3', null, t.title),
          h('div', { class: 't-meta' },
            h('span', { class: 'badge ' + t.status }, STATUS[t.status]),
            h('span', null, t.parts.length + (t.parts.length === 1 ? ' parte' : ' partes')),
            h('span', null, 'Actualizado ' + fmt(t.updatedAt)),
            h('span', null, '/tutoriales/' + t.slug))),
        h('div', { class: 't-actions' },
          h('button', { class: 'btn btn-icon', type: 'button', title: 'Subir', disabled: i === 0, onclick: function () { reorder(i, -1); } }, '↑'),
          h('button', { class: 'btn btn-icon', type: 'button', title: 'Bajar', disabled: i === list.length - 1, onclick: function () { reorder(i, 1); } }, '↓'),
          h('a', { class: 'btn btn-sm', href: '/tutoriales/' + t.slug, target: '_blank', rel: 'noopener' }, 'Ver'),
          h('a', { class: 'btn btn-sm btn-primary', href: '#/tutorial/' + t.id }, 'Editar'),
          h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: function () { removeTutorial(t); } }, 'Eliminar')));
    });
    return [
      h('div', { class: 'page-title' },
        h('h1', null, 'Tutoriales'),
        h('a', { class: 'btn btn-primary', href: '#/nuevo' }, '+ Nuevo tutorial')),
      rows.length ? rows : h('div', { class: 'empty' }, h('p', null, 'Todavía no creaste ningún tutorial.'), h('a', { class: 'btn btn-primary', href: '#/nuevo' }, 'Crear el primero'))
    ];
  }

  function reorder(i, d) {
    move(state.tutorials, i, d);
    api('POST', '/tutorials-order', { ids: state.tutorials.map(function (t) { return t.id; }) })
      .then(function (r) { state.tutorials = r; route(); })
      .catch(function (e) { toast(e.message, true); });
  }

  function removeTutorial(t) {
    if (!confirm('¿Eliminar "' + t.title + '" con todas sus partes e imágenes? No se puede deshacer.')) return;
    api('DELETE', '/tutorials/' + t.id).then(function () {
      state.tutorials = state.tutorials.filter(function (x) { return x.id !== t.id; });
      toast('Tutorial eliminado');
      route();
    }).catch(function (e) { toast(e.message, true); });
  }

  // ---------- Vista: editor de tutorial ----------
  function viewEditor(id) {
    if (id) {
      var found = state.tutorials.filter(function (t) { return t.id === id; })[0];
      if (!found) { location.hash = '#/'; return; }
      editing = clone(found); isNew = false;
    } else {
      editing = { title: '', slug: '', subtitle: '', summary: '', status: 'draft', parts: [] };
      isNew = true;
      dirty = true;
    }
    openParts = {};
    if (editing.parts.length === 1) openParts[editing.parts[0].id] = true;
    renderEditor();
  }

  function renderEditor() {
    var y = window.scrollY;
    var t = editing;
    var field = function (label, key, opts) {
      opts = opts || {};
      var input = opts.area
        ? h('textarea', { value: t[key] || '', maxlength: opts.max, oninput: function (e) { t[key] = e.target.value; markDirty(); } })
        : h('input', { type: 'text', value: t[key] || '', maxlength: opts.max, placeholder: opts.ph || '', oninput: function (e) { t[key] = e.target.value; markDirty(); } });
      return h('label', null, label, input, opts.hint ? h('span', { class: 'hint' }, opts.hint) : null);
    };

    var statusSel = h('select', { onchange: function (e) { t.status = e.target.value; markDirty(); } },
      Object.keys(STATUS).map(function (k) { return h('option', { value: k, selected: t.status === k }, STATUS[k]); }));

    var bar = h('div', { class: 'editbar' },
      h('div', { class: 'left' },
        h('a', { class: 'btn btn-sm', href: '#/' }, '← Tutoriales'),
        h('strong', null, isNew ? 'Nuevo tutorial' : 'Editando'),
        h('span', { id: 'dirty', class: 'dirty' + (dirty ? ' on' : '') }, dirty ? 'Cambios sin guardar' : 'Todo guardado')),
      h('div', { class: 'right' },
        isNew ? null : h('a', { class: 'btn', href: '/tutoriales/' + t.slug, target: '_blank', rel: 'noopener' }, 'Vista previa ↗'),
        h('button', { id: 'save', class: 'btn btn-primary', type: 'button', disabled: !dirty, onclick: saveTutorial }, 'Guardar')));

    var info = h('section', { class: 'panel' },
      h('h2', null, 'Datos del tutorial'),
      h('div', { class: 'fields' },
        field('Título', 'title', { max: 120, ph: 'Ej: Tutorial de Linux' }),
        h('div', { class: 'fields two' },
          field('Subtítulo (opcional)', 'subtitle', { max: 160, ph: 'Ej: Bash · Permisos · Procesos' }),
          h('label', null, 'Estado', statusSel, h('span', { class: 'hint' }, 'Borrador: solo lo ves vos · Próximamente: aparece sin abrirse · Publicado: visible para todos'))),
        field('Resumen (se muestra en la tarjeta)', 'summary', { area: true, max: 500 }),
        field('Dirección (URL)', 'slug', { max: 60, ph: 'se genera sola desde el título', hint: 'Queda como /tutoriales/<dirección>. Dejala vacía para generarla automáticamente.' })));

    var partsPanel = h('section', null,
      h('div', { class: 'page-title' },
        h('h2', { class: 'sub' }, 'Partes (' + t.parts.length + ')'),
        h('button', { class: 'btn', type: 'button', onclick: addPart }, '+ Nueva parte')),
      t.parts.length ? t.parts.map(partCard) : h('div', { class: 'empty' }, 'Este tutorial todavía no tiene partes. Agregá la primera.'));

    shell('tutoriales', [bar, info, partsPanel]);
    window.scrollTo(0, y);
  }

  function addPart() {
    var p = { id: uid(), title: 'Parte ' + (editing.parts.length + 1), meta: [], blocks: [{ id: uid(), type: 'text', text: '' }] };
    editing.parts.push(p);
    openParts[p.id] = true;
    markDirty();
    renderEditor();
    window.scrollTo(0, document.body.scrollHeight);
  }

  function partCard(p, i) {
    var isOpen = !!openParts[p.id];
    var top = h('div', { class: 'part-top' },
      h('span', { class: 'part-num' }, String(i + 1)),
      h('input', { type: 'text', value: p.title, maxlength: 160, 'aria-label': 'Título de la parte', oninput: function (e) { p.title = e.target.value; markDirty(); } }),
      h('button', { class: 'btn btn-icon', type: 'button', title: 'Subir parte', disabled: i === 0, onclick: function () { move(editing.parts, i, -1); markDirty(); renderEditor(); } }, '↑'),
      h('button', { class: 'btn btn-icon', type: 'button', title: 'Bajar parte', disabled: i === editing.parts.length - 1, onclick: function () { move(editing.parts, i, 1); markDirty(); renderEditor(); } }, '↓'),
      h('button', { class: 'btn btn-sm toggle', type: 'button', onclick: function () { openParts[p.id] = !isOpen; renderEditor(); } }, isOpen ? 'Cerrar' : 'Editar'),
      h('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Eliminar parte', onclick: function () {
        if (!confirm('¿Eliminar la parte "' + p.title + '"?')) return;
        editing.parts.splice(i, 1); markDirty(); renderEditor();
      } }, '✕'));
    if (!isOpen) return h('div', { class: 'part-card' }, top);

    var metaRows = p.meta.map(function (m, mi) {
      return h('div', { class: 'meta-row' },
        h('input', { type: 'text', value: m.label, placeholder: 'Ej: Motor', maxlength: 40, oninput: function (e) { m.label = e.target.value; markDirty(); } }),
        h('input', { type: 'text', value: m.value, placeholder: 'Ej: PostgreSQL', maxlength: 80, oninput: function (e) { m.value = e.target.value; markDirty(); } }),
        h('button', { class: 'btn btn-icon', type: 'button', title: 'Quitar', onclick: function () { p.meta.splice(mi, 1); markDirty(); renderEditor(); } }, '✕'));
    });

    var addBtns = h('div', { class: 'add-block' }, h('span', null, 'Agregar bloque:'),
      BLOCKS.map(function (b) {
        return h('button', { class: 'btn btn-sm', type: 'button', onclick: function () { p.blocks.push(newBlock(b[0])); markDirty(); renderEditor(); } }, '+ ' + b[1]);
      }));

    return h('div', { class: 'part-card' }, top,
      h('div', { class: 'part-body' },
        h('div', { class: 'sub' }, 'Datos rápidos (Motor, Herramienta…)'),
        metaRows,
        h('button', { class: 'btn btn-sm', type: 'button', onclick: function () { p.meta.push({ label: '', value: '' }); markDirty(); renderEditor(); } }, '+ Agregar dato'),
        h('div', { class: 'sub' }, 'Contenido'),
        p.blocks.map(function (b, bi) { return blockCard(p, b, bi); }),
        addBtns));
  }

  function newBlock(type) {
    var b = { id: uid(), type: type };
    if (type === 'text' || type === 'note') b.text = '';
    if (type === 'list') { b.ordered = true; b.items = ['']; }
    if (type === 'code') { b.lang = 'sql'; b.code = ''; }
    if (type === 'images') b.images = [];
    return b;
  }

  function blockCard(p, b, bi) {
    var label = (BLOCKS.filter(function (x) { return x[0] === b.type; })[0] || [0, b.type])[1];
    var ctrls = h('div', { class: 'ctrls' },
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', title: 'Subir', disabled: bi === 0, onclick: function () { move(p.blocks, bi, -1); markDirty(); renderEditor(); } }, '↑'),
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', title: 'Bajar', disabled: bi === p.blocks.length - 1, onclick: function () { move(p.blocks, bi, 1); markDirty(); renderEditor(); } }, '↓'),
      h('button', { class: 'btn btn-icon btn-sm btn-danger', type: 'button', title: 'Eliminar bloque', onclick: function () { p.blocks.splice(bi, 1); markDirty(); renderEditor(); } }, '✕'));

    var body;
    if (b.type === 'text' || b.type === 'note') {
      body = h('label', null, h('span', { class: 'hint' }, 'Línea en blanco = nuevo párrafo · **negrita** · `código` · [texto](https://enlace)'),
        h('textarea', { value: b.text || '', oninput: function (e) { b.text = e.target.value; markDirty(); } }));
    } else if (b.type === 'list') {
      body = [
        h('label', null, h('span', { class: 'hint' }, 'Un paso por línea. Podés usar `código` y **negrita**.'),
          h('textarea', { value: (b.items || []).join('\n'), oninput: function (e) { b.items = e.target.value.split('\n'); markDirty(); } })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: b.ordered !== false, onchange: function (e) { b.ordered = e.target.checked; markDirty(); } }), 'Lista numerada')
      ];
    } else if (b.type === 'code') {
      body = [
        h('label', null, 'Lenguaje', h('input', { type: 'text', value: b.lang || '', maxlength: 20, placeholder: 'sql, bash, js…', oninput: function (e) { b.lang = e.target.value; markDirty(); } })),
        h('textarea', { class: 'mono', spellcheck: 'false', value: b.code || '', 'aria-label': 'Código', oninput: function (e) { b.code = e.target.value; markDirty(); } })
      ];
    } else if (b.type === 'images') {
      body = imagesEditor(b);
    }
    return h('div', { class: 'block' }, h('div', { class: 'block-head' }, h('span', null, label), ctrls), h('div', { class: 'block-body' }, body));
  }

  function imagesEditor(b) {
    var input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
    var drop = h('div', { class: 'drop', tabindex: '0', role: 'button' },
      h('strong', null, 'Arrastrá imágenes acá o hacé clic para elegirlas'),
      h('span', null, 'JPG, PNG, WebP o GIF · hasta 10 MB cada una'));

    function upload(files) {
      if (!files || !files.length) return;
      var fd = new FormData();
      Array.prototype.forEach.call(files, function (f) { fd.append('files', f); });
      drop.firstChild.textContent = 'Subiendo ' + files.length + (files.length === 1 ? ' imagen…' : ' imágenes…');
      api('POST', '/upload', fd, true).then(function (r) {
        r.saved.forEach(function (s) { b.images.push({ src: s.src, caption: '' }); });
        if (r.rejected.length) toast('No se aceptaron: ' + r.rejected.join(', '), true);
        if (r.saved.length) markDirty();
        renderEditor();
      }).catch(function (e) { toast(e.message, true); renderEditor(); });
    }

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { upload(input.files); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { upload(e.dataTransfer.files); });

    var thumbs = b.images.map(function (im, i) {
      return h('div', { class: 'thumb' },
        h('img', { src: im.src, alt: '', loading: 'lazy' }),
        h('div', { class: 'tb' },
          h('input', { type: 'text', value: im.caption || '', placeholder: 'Descripción (opcional)', maxlength: 200, 'aria-label': 'Descripción de la imagen', oninput: function (e) { im.caption = e.target.value; markDirty(); } })),
        h('div', { class: 'tb' },
          h('button', { class: 'btn btn-icon', type: 'button', title: 'Mover antes', disabled: i === 0, onclick: function () { move(b.images, i, -1); markDirty(); renderEditor(); } }, '←'),
          h('button', { class: 'btn btn-icon', type: 'button', title: 'Mover después', disabled: i === b.images.length - 1, onclick: function () { move(b.images, i, 1); markDirty(); renderEditor(); } }, '→'),
          h('button', { class: 'btn btn-icon btn-danger', type: 'button', title: 'Quitar', onclick: function () { b.images.splice(i, 1); markDirty(); renderEditor(); } }, '✕')));
    });
    return [drop, input, thumbs.length ? h('div', { class: 'thumbs' }, thumbs) : null];
  }

  function saveTutorial() {
    var btn = document.getElementById('save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    var req = isNew ? api('POST', '/tutorials', editing) : api('PUT', '/tutorials/' + editing.id, editing);
    req.then(function (saved) {
      var i = state.tutorials.map(function (t) { return t.id; }).indexOf(saved.id);
      if (i >= 0) state.tutorials[i] = saved; else state.tutorials.push(saved);
      dirty = false;
      toast('Guardado');
      if (isNew) { lastHash = '#/tutorial/' + saved.id; location.hash = lastHash; }
      else { editing = clone(saved); renderEditor(); }
    }).catch(function (e) {
      toast(e.message, true);
      btn.disabled = false;
      btn.textContent = 'Guardar';
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      var s = document.getElementById('save');
      if (s) { e.preventDefault(); if (!s.disabled) s.click(); }
    }
  });

  // ---------- Vista: sitio y perfil ----------
  function viewSite() {
    var s = clone(state.site);
    var txt = function (label, key, opts) {
      opts = opts || {};
      return h('label', null, label,
        h(opts.area ? 'textarea' : 'input', { type: opts.area ? null : 'text', value: opts.get ? opts.get() : s[key] || '', maxlength: opts.max,
          oninput: function (e) { if (opts.set) opts.set(e.target.value); else s[key] = e.target.value; markDirty(); } }),
        opts.hint ? h('span', { class: 'hint' }, opts.hint) : null);
    };
    var btn = h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
      btn.disabled = true;
      api('PUT', '/site', s).then(function (saved) {
        state.site = saved; dirty = false; toast('Perfil guardado'); route();
      }).catch(function (e) { toast(e.message, true); btn.disabled = false; });
    } }, 'Guardar cambios');
    return [
      h('div', { class: 'page-title' }, h('h1', null, 'Sitio y perfil'), btn),
      h('section', { class: 'panel' }, h('h2', null, 'Presentación (portada)'),
        h('div', { class: 'fields' },
          h('div', { class: 'fields two' }, txt('Nombre', 'name', { max: 80 }), txt('Rol / título', 'role', { max: 120 })),
          txt('Frase principal', 'tagline', { max: 240, area: true }),
          txt('Tecnologías', 'skills', { hint: 'Separadas por coma. Ej: HTML, CSS, SQL', get: function () { return (s.skills || []).join(', '); }, set: function (v) { s.skills = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean); } }))),
      h('section', { class: 'panel' }, h('h2', null, 'Sobre mí'),
        txt('Texto', 'about', { area: true, hint: 'Separá los párrafos con una línea en blanco.', get: function () { return (s.about || []).join('\n\n'); }, set: function (v) { s.about = v.split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean); } })),
      h('section', { class: 'panel' }, h('h2', null, 'Contacto'),
        h('div', { class: 'fields' },
          txt('Email', 'email', { max: 120 }),
          h('div', { class: 'fields two' }, txt('LinkedIn (URL)', 'linkedin', { max: 300 }), txt('GitHub (URL)', 'github', { max: 300 }))))
    ];
  }

  // ---------- Vista: cuenta ----------
  function viewAccount() {
    var f = { currentPassword: '', newUsername: state.user, newPassword: '', repeat: '' };
    var bind = function (key) { return function (e) { f[key] = e.target.value; }; };
    var err = h('p', { class: 'form-error', role: 'alert' });
    var btn = h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
      err.textContent = '';
      if (f.newPassword !== f.repeat) { err.textContent = 'Las contraseñas nuevas no coinciden.'; return; }
      btn.disabled = true;
      api('POST', '/account', { currentPassword: f.currentPassword, newPassword: f.newPassword, newUsername: f.newUsername })
        .then(function (r) { state.user = r.username; toast('Cuenta actualizada'); route(); })
        .catch(function (e) { err.textContent = e.message; btn.disabled = false; });
    } }, 'Actualizar cuenta');
    return [
      h('div', { class: 'page-title' }, h('h1', null, 'Cuenta')),
      h('section', { class: 'panel' }, h('h2', null, 'Usuario y contraseña'),
        h('div', { class: 'fields' },
          h('label', null, 'Usuario', h('input', { type: 'text', value: f.newUsername, autocomplete: 'username', oninput: bind('newUsername') })),
          h('label', null, 'Contraseña actual', h('input', { type: 'password', autocomplete: 'current-password', oninput: bind('currentPassword') })),
          h('div', { class: 'fields two' },
            h('label', null, 'Contraseña nueva', h('input', { type: 'password', autocomplete: 'new-password', oninput: bind('newPassword') }), h('span', { class: 'hint' }, 'Mínimo 10 caracteres.')),
            h('label', null, 'Repetir contraseña nueva', h('input', { type: 'password', autocomplete: 'new-password', oninput: bind('repeat') }))),
          err, h('div', null, btn)))
    ];
  }

  // ---------- Inicio ----------
  api('GET', '/data').then(function (d) {
    state.user = d.username; state.site = d.site; state.tutorials = d.tutorials;
    route();
  }).catch(function (e) { app.textContent = e.message; });
})();
