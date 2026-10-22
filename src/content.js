'use strict';
// Modelo de contenido: lectura, validación y saneamiento de lo que llega desde el panel.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { uid, UPLOADS_DIR } = store;

const DEFAULT_SITE = {
  name: 'Tu nombre',
  role: 'Estudiante de Sistemas',
  tagline: 'Creo proyectos simples, claros y funcionales.',
  skills: [],
  about: ['Escribí acá algo sobre vos desde el panel de administración.'],
  email: '',
  linkedin: '',
  github: ''
};

const BLOCK_TYPES = ['text', 'list', 'code', 'images', 'note'];
const STATUSES = ['published', 'soon', 'draft'];

const str = (v, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strRaw = (v, max = 20000) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').slice(0, max) : '');

function slugify(text) {
  return (
    String(text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'tutorial'
  );
}

// Solo se aceptan imágenes que viven en nuestra carpeta de uploads.
function cleanImageSrc(src) {
  if (typeof src !== 'string') return '';
  const m = /^\/uploads\/([a-zA-Z0-9._-]+)$/.exec(src);
  return m ? src : '';
}

function cleanUrl(u) {
  const s = str(u, 300);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : '';
}

function getSite() {
  return { ...DEFAULT_SITE, ...store.read('site.json', {}) };
}

function saveSite(input) {
  const site = {
    name: str(input.name, 80) || DEFAULT_SITE.name,
    role: str(input.role, 120),
    tagline: str(input.tagline, 240),
    skills: (Array.isArray(input.skills) ? input.skills : [])
      .map((s) => str(s, 30))
      .filter(Boolean)
      .slice(0, 20),
    about: (Array.isArray(input.about) ? input.about : [])
      .map((s) => str(s, 1500))
      .filter(Boolean)
      .slice(0, 8),
    email: str(input.email, 120),
    linkedin: cleanUrl(input.linkedin),
    github: cleanUrl(input.github)
  };
  store.write('site.json', site);
  return site;
}

function getTutorials() {
  return store.read('tutorials.json', []);
}

function cleanBlock(b) {
  if (!b || !BLOCK_TYPES.includes(b.type)) return null;
  const base = { id: str(b.id, 20) || uid(4), type: b.type };
  switch (b.type) {
    case 'text':
    case 'note':
      return { ...base, text: strRaw(b.text, 8000) };
    case 'list':
      return {
        ...base,
        ordered: b.ordered !== false,
        items: (Array.isArray(b.items) ? b.items : []).map((i) => str(i, 400)).filter(Boolean).slice(0, 50)
      };
    case 'code':
      return { ...base, lang: str(b.lang, 20), code: strRaw(b.code, 20000) };
    case 'images':
      return {
        ...base,
        images: (Array.isArray(b.images) ? b.images : [])
          .map((im) => ({ src: cleanImageSrc(im && im.src), caption: str(im && im.caption, 200) }))
          .filter((im) => im.src)
          .slice(0, 40)
      };
  }
  return null;
}

function cleanPart(p) {
  return {
    id: str(p && p.id, 20) || uid(4),
    title: str(p && p.title, 160) || 'Parte sin título',
    meta: (Array.isArray(p && p.meta) ? p.meta : [])
      .map((m) => ({ label: str(m && m.label, 40), value: str(m && m.value, 80) }))
      .filter((m) => m.label && m.value)
      .slice(0, 8),
    blocks: (Array.isArray(p && p.blocks) ? p.blocks : []).map(cleanBlock).filter(Boolean).slice(0, 60)
  };
}

function cleanTutorial(input, existing, all) {
  const title = str(input.title, 120) || 'Tutorial sin título';
  let slug = slugify(input.slug || title);
  const taken = new Set(all.filter((t) => t.id !== (existing && existing.id)).map((t) => t.slug));
  if (taken.has(slug)) {
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  return {
    id: (existing && existing.id) || uid(5),
    slug,
    title,
    subtitle: str(input.subtitle, 160),
    summary: str(input.summary, 500),
    status: STATUSES.includes(input.status) ? input.status : 'draft',
    parts: (Array.isArray(input.parts) ? input.parts : []).map(cleanPart).slice(0, 80),
    updatedAt: new Date().toISOString()
  };
}

function imagesOf(tutorials) {
  const set = new Set();
  for (const t of tutorials)
    for (const p of t.parts) for (const b of p.blocks) if (b.type === 'images') for (const im of b.images) set.add(im.src);
  return set;
}

// Borra del disco las imágenes que dejaron de usarse (solo las que estaban en `before`).
function sweepImages(before, after) {
  const used = imagesOf(after);
  for (const src of imagesOf(before)) {
    if (used.has(src)) continue;
    const f = path.join(UPLOADS_DIR, path.basename(src));
    fs.rm(f, { force: true }, () => {});
  }
}

function createTutorial(input) {
  const all = getTutorials();
  const t = cleanTutorial(input, null, all);
  all.push(t);
  store.write('tutorials.json', all);
  return t;
}

function updateTutorial(id, input) {
  const all = getTutorials();
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const before = [all[i]];
  const t = cleanTutorial(input, all[i], all);
  all[i] = t;
  store.write('tutorials.json', all);
  sweepImages(before, [t]);
  return t;
}

function deleteTutorial(id) {
  const all = getTutorials();
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) return false;
  const [removed] = all.splice(i, 1);
  store.write('tutorials.json', all);
  sweepImages([removed], all);
  return true;
}

function reorderTutorials(ids) {
  const all = getTutorials();
  const map = new Map(all.map((t) => [t.id, t]));
  const ordered = ids.filter((id) => map.has(id)).map((id) => map.get(id));
  for (const t of all) if (!ordered.includes(t)) ordered.push(t);
  store.write('tutorials.json', ordered);
  return ordered;
}

module.exports = {
  getSite,
  saveSite,
  getTutorials,
  createTutorial,
  updateTutorial,
  deleteTutorial,
  reorderTutorials,
  slugify
};
