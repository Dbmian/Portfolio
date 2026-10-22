'use strict';
// Genera el sitio estático (carpeta docs/) para GitHub Pages.
const fs = require('fs');
const path = require('path');
const content = require('./content');
const render = require('./render');
const store = require('./store');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

function getBase() {
  let b = process.env.BASE || '/Portfolio/';
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b;
}

function build() {
  const BASE = getBase();
  const req = { admin: null };
  // Reescribe enlaces absolutos (/css/..., /tutoriales/...) para que funcionen bajo la base.
  const fix = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}`);
  const write = (rel, html) => {
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fix(html));
  };

  const site = content.getSite();
  const tutorials = content.getTutorials().filter((t) => t.status !== 'draft');

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  write('index.html', render.homePage({ site, tutorials, req }));
  write('tutoriales/index.html', render.tutorialsPage({ site, tutorials, req }));
  for (const t of tutorials.filter((x) => x.status === 'published'))
    write(`tutoriales/${t.slug}/index.html`, render.tutorialPage({ site, tutorial: t, req }));
  write('404.html', render.notFoundPage({ site, req }));
  fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
  fs.cpSync(store.UPLOADS_DIR, path.join(OUT, 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  return { base: BASE, count: tutorials.length };
}

// Regenera docs/ poco después del último cambio (agrupa varios guardados seguidos).
let timer = null;
function schedule() {
  if (process.env.STATIC_EXPORT === '0') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const r = build();
      console.log(`[docs] Sitio estático actualizado (${r.count} tutoriales, base ${r.base})`);
    } catch (err) {
      console.error('[docs] No se pudo actualizar el sitio estático:', err.message);
    }
  }, 400);
}

module.exports = { build, schedule };
