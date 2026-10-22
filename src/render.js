'use strict';
// Plantillas HTML del sitio público (renderizadas en el servidor, todo escapado).

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Formato inline permitido: `código`, **negrita**, [texto](https://enlace)
function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

const ICONS = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 21V5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>'
};

function layout({ title, description, body, req, site, active, canonical }) {
  const admin = req && req.admin;
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} · Portfolio`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description || site.tagline)}">
  <meta name="theme-color" content="#0f1115">
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <script src="/js/theme.js"></script>
  <link rel="stylesheet" href="/css/site.css">
</head>
<body>
  <a class="skip" href="#contenido">Saltar al contenido</a>
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="/">${esc(site.name)}</a>
      <nav class="nav" aria-label="Principal">
        <a href="/#sobre-mi"${active === 'about' ? ' aria-current="page"' : ''}>Sobre mí</a>
        <a href="/tutoriales"${active === 'tutorials' ? ' aria-current="page"' : ''}>Tutoriales</a>
        <a href="/#contacto">Contacto</a>
        ${admin ? `<a class="nav-admin" href="/admin">Panel</a>` : ''}
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Cambiar tema">
          <span class="i-moon">${ICONS.moon}</span><span class="i-sun">${ICONS.sun}</span>
        </button>
      </nav>
    </div>
  </header>
  <main id="contenido">
${body}
  </main>
  <footer class="footer">
    <div class="wrap footer-inner">
      <span>© ${new Date().getFullYear()} ${esc(site.name)}</span>
      <span class="muted">En constante desarrollo</span>
    </div>
  </footer>
  <script src="/js/site.js" defer></script>
</body>
</html>`;
}

const statusLabel = { published: 'Disponible', soon: 'Próximamente', draft: 'Borrador' };

function tutorialCard(t) {
  const parts = t.parts.length;
  const inner = `
      <div class="card-icon">${ICONS.book}</div>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.summary || t.subtitle)}</p>
      <div class="card-foot">
        ${
          t.status === 'soon'
            ? '<span class="badge badge-soon">Próximamente</span>'
            : `<span class="badge">${parts} ${parts === 1 ? 'parte' : 'partes'}</span><span class="card-cta">Ver tutorial ${ICONS.arrow}</span>`
        }
      </div>`;
  return t.status === 'soon'
    ? `<article class="card card-static is-soon">${inner}</article>`
    : `<a class="card card-link" href="/tutoriales/${esc(t.slug)}">${inner}</a>`;
}

function homePage({ site, tutorials, req }) {
  const visible = tutorials.filter((t) => t.status !== 'draft');
  const skills = (site.skills || []).map((s) => `<li>${esc(s)}</li>`).join('');
  const about = (site.about || []).map((p) => `<p>${inline(p)}</p>`).join('');
  const contact = [
    site.email && `<a class="contact-item" href="mailto:${esc(site.email)}">${ICONS.mail}<span>${esc(site.email)}</span></a>`,
    site.linkedin && `<a class="contact-item" href="${esc(site.linkedin)}" target="_blank" rel="noopener noreferrer">${ICONS.link}<span>LinkedIn</span></a>`,
    site.github && `<a class="contact-item" href="${esc(site.github)}" target="_blank" rel="noopener noreferrer">${ICONS.link}<span>GitHub</span></a>`
  ]
    .filter(Boolean)
    .join('');

  const body = `
    <section class="hero">
      <div class="wrap">
        <p class="eyebrow">${esc(site.role)}</p>
        <h1>${esc(site.name)}</h1>
        <p class="lead">${esc(site.tagline)}</p>
        ${skills ? `<ul class="chips" aria-label="Tecnologías">${skills}</ul>` : ''}
        <div class="hero-actions">
          <a class="btn btn-primary" href="/tutoriales">Ver tutoriales ${ICONS.arrow}</a>
          <a class="btn btn-ghost" href="#contacto">Contacto</a>
        </div>
      </div>
    </section>

    <section class="section" id="sobre-mi">
      <div class="wrap narrow">
        <h2 class="section-title">Sobre mí</h2>
        <div class="prose">${about}</div>
      </div>
    </section>

    <section class="section section-alt" id="proyectos">
      <div class="wrap">
        <div class="section-head">
          <h2 class="section-title">Proyectos y tutoriales</h2>
          <a class="link-arrow" href="/tutoriales">Ver todos ${ICONS.arrow}</a>
        </div>
        ${
          visible.length
            ? `<div class="grid">${visible.slice(0, 6).map(tutorialCard).join('')}</div>`
            : '<p class="muted">Todavía no hay contenido publicado.</p>'
        }
      </div>
    </section>

    <section class="section" id="contacto">
      <div class="wrap narrow">
        <h2 class="section-title">Contacto</h2>
        <p class="muted">¿Querés charlar sobre un proyecto o tenés alguna consulta? Escribime.</p>
        <div class="contact-list">${contact || '<p class="muted">Sin datos de contacto cargados.</p>'}</div>
      </div>
    </section>`;
  return layout({ body, req, site, active: 'about' });
}

function tutorialsPage({ site, tutorials, req }) {
  const visible = tutorials.filter((t) => t.status !== 'draft');
  const body = `
    <section class="page-head">
      <div class="wrap">
        <p class="eyebrow">Biblioteca</p>
        <h1>Tutoriales</h1>
        <p class="lead">Guías paso a paso con capturas, pensadas para aprender practicando.</p>
      </div>
    </section>
    <section class="section">
      <div class="wrap">
        ${
          visible.length
            ? `<div class="grid">${visible.map(tutorialCard).join('')}</div>`
            : '<p class="muted">Todavía no hay tutoriales publicados.</p>'
        }
      </div>
    </section>`;
  return layout({ title: 'Tutoriales', body, req, site, active: 'tutorials' });
}

function renderBlock(b, gid) {
  switch (b.type) {
    case 'text':
      return `<div class="prose">${paragraphs(b.text)}</div>`;
    case 'note':
      return `<aside class="note">${paragraphs(b.text)}</aside>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag} class="steps${b.ordered ? '' : ' steps-bullets'}">${b.items.map((i) => `<li><span>${inline(i)}</span></li>`).join('')}</${tag}>`;
    }
    case 'code':
      return `<figure class="code">
        <figcaption><span>${esc(b.lang || 'código')}</span><button type="button" class="copy-btn" data-copy>${ICONS.copy}<span>Copiar</span></button></figcaption>
        <pre><code>${esc(b.code)}</code></pre>
      </figure>`;
    case 'images': {
      if (!b.images.length) return '';
      return `<div class="gallery" data-gallery="${esc(gid)}">${b.images
        .map(
          (im, i) => `<a class="shot" href="${esc(im.src)}" data-index="${i}" data-caption="${esc(im.caption)}">
          <img src="${esc(im.src)}" alt="${esc(im.caption || 'Captura ' + (i + 1))}" loading="lazy" decoding="async">
          ${im.caption ? `<span class="shot-cap">${esc(im.caption)}</span>` : ''}
        </a>`
        )
        .join('')}</div>`;
    }
  }
  return '';
}

function tutorialPage({ site, tutorial: t, req }) {
  const preview = t.status !== 'published';
  const toc = t.parts
    .map((p, i) => `<li><a href="#parte-${i + 1}"><span class="toc-n">${i + 1}</span><span>${esc(p.title)}</span></a></li>`)
    .join('');
  const parts = t.parts
    .map(
      (p, i) => `
      <article class="part" id="parte-${i + 1}">
        <header class="part-head">
          <p class="eyebrow">Parte ${i + 1}</p>
          <h2>${esc(p.title)}</h2>
          ${p.meta.length ? `<dl class="meta">${p.meta.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : ''}
        </header>
        <div class="part-body">${p.blocks.map((b) => renderBlock(b, `${t.id}-${p.id}-${b.id}`)).join('\n')}</div>
      </article>`
    )
    .join('');

  const body = `
    <section class="page-head">
      <div class="wrap">
        <nav class="crumbs" aria-label="Ruta"><a href="/tutoriales">Tutoriales</a><span>/</span><span>${esc(t.title)}</span></nav>
        <h1>${esc(t.title)}</h1>
        ${t.subtitle ? `<p class="lead">${esc(t.subtitle)}</p>` : ''}
        ${
          preview
            ? `<p class="preview-banner">Vista previa: este tutorial está como <strong>${statusLabel[t.status]}</strong> y no es visible para el público.</p>`
            : ''
        }
        ${req.admin ? `<a class="btn btn-ghost btn-sm" href="/admin#/tutorial/${esc(t.id)}">${ICONS.edit} Editar este tutorial</a>` : ''}
      </div>
    </section>
    <div class="wrap tutorial-layout">
      <aside class="toc" aria-label="Contenido">
        <p class="toc-title">En este tutorial</p>
        <ol>${toc}</ol>
      </aside>
      <div class="parts">${parts || '<p class="muted">Este tutorial todavía no tiene partes.</p>'}</div>
    </div>`;
  return layout({ title: t.title, description: t.summary || t.subtitle, body, req, site, active: 'tutorials' });
}

function notFoundPage({ site, req }) {
  const body = `
    <section class="page-head">
      <div class="wrap">
        <p class="eyebrow">Error 404</p>
        <h1>Página no encontrada</h1>
        <p class="lead">El enlace que seguiste no existe o fue movido.</p>
        <a class="btn btn-primary" href="/">Volver al inicio</a>
      </div>
    </section>`;
  return layout({ title: 'No encontrada', body, req, site });
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Ingresar · Panel</title>
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <script src="/js/theme.js"></script>
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="login-body">
  <main class="login-card">
    <h1>Panel de administración</h1>
    <p class="muted">Ingresá para gestionar tus tutoriales.</p>
    <form id="login-form" autocomplete="on">
      <label>Usuario<input name="username" type="text" autocomplete="username" required autofocus></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="form-error" id="login-error" role="alert">${esc(error || '')}</p>
      <button class="btn btn-primary" type="submit">Ingresar</button>
    </form>
    <a class="back" href="/">← Volver al sitio</a>
  </main>
  <script src="/js/login.js"></script>
</body>
</html>`;
}

function adminPage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Panel · Portfolio</title>
  <link rel="icon" type="image/png" href="/img/favicon.png">
  <script src="/js/theme.js"></script>
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body>
  <div id="app"><p class="loading">Cargando…</p></div>
  <script src="/js/admin.js"></script>
</body>
</html>`;
}

module.exports = { homePage, tutorialsPage, tutorialPage, notFoundPage, loginPage, adminPage };
