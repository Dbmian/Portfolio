'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const store = require('./src/store');
const content = require('./src/content');
const auth = require('./src/auth');
const render = require('./src/render');
const staticsite = require('./src/staticsite');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
app.disable('x-powered-by');

auth.ensureAdmin();

// ---------- Seguridad básica ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  next();
});
app.use(auth.attach);

// ---------- Archivos estáticos ----------
app.use('/uploads', express.static(store.UPLOADS_DIR, { maxAge: '7d', fallthrough: false, index: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// ---------- Sitio público ----------
app.get('/', (req, res) => {
  res.send(render.homePage({ site: content.getSite(), tutorials: content.getTutorials(), req }));
});

app.get('/tutoriales', (req, res) => {
  res.send(render.tutorialsPage({ site: content.getSite(), tutorials: content.getTutorials(), req }));
});

app.get('/tutoriales/:slug', (req, res, next) => {
  const t = content.getTutorials().find((x) => x.slug === req.params.slug);
  // Los borradores y "próximamente" solo se pueden abrir con sesión (vista previa).
  if (!t || (t.status !== 'published' && !req.admin)) return next();
  res.send(render.tutorialPage({ site: content.getSite(), tutorial: t, req }));
});

// Compatibilidad con el enlace anterior del portfolio.
app.get('/paginas/TutorialSQL.html', (_req, res) => res.redirect(301, '/tutoriales/sql'));

// ---------- Panel de administración ----------
app.get('/admin/login', (req, res) => {
  if (req.admin) return res.redirect('/admin');
  res.send(render.loginPage());
});
app.get('/admin', auth.requireAdminPage, (_req, res) => res.send(render.adminPage()));

app.use('/api', express.json({ limit: '2mb' }));

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (!auth.loginAllowed(ip)) return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
  const { username, password } = req.body || {};
  const admin = auth.getAdmin();
  const ok =
    admin &&
    typeof username === 'string' &&
    typeof password === 'string' &&
    username === admin.username &&
    auth.verifyPassword(password, admin);
  if (!ok) {
    auth.loginFailed(ip);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  auth.loginOk(ip);
  auth.setSession(res, admin);
  res.json({ ok: true });
});

app.post('/api/logout', (_req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

const api = express.Router();
api.use(auth.requireAdminApi);
// Tras cualquier cambio exitoso de contenido se regenera docs/ (para GitHub Pages).
api.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', () => res.statusCode < 400 && staticsite.schedule());
  next();
});

api.get('/data', (req, res) => {
  res.json({ username: req.admin.username, site: content.getSite(), tutorials: content.getTutorials() });
});

api.put('/site', (req, res) => res.json(content.saveSite(req.body || {})));

api.post('/tutorials', (req, res) => res.status(201).json(content.createTutorial(req.body || {})));
api.put('/tutorials/:id', (req, res) => {
  const t = content.updateTutorial(req.params.id, req.body || {});
  if (!t) return res.status(404).json({ error: 'Tutorial no encontrado' });
  res.json(t);
});
api.delete('/tutorials/:id', (req, res) => {
  if (!content.deleteTutorial(req.params.id)) return res.status(404).json({ error: 'Tutorial no encontrado' });
  res.json({ ok: true });
});
api.post('/tutorials-order', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(String) : [];
  res.json(content.reorderTutorials(ids));
});

// Subida de imágenes: se valida por contenido real (firma del archivo), no por extensión.
const SIGNATURES = [
  { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.gif', test: (b) => b.slice(0, 4).toString('latin1') === 'GIF8' },
  { ext: '.webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' }
];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } });

api.post('/upload', upload.array('files', 20), (req, res) => {
  const saved = [];
  const rejected = [];
  for (const f of req.files || []) {
    const sig = SIGNATURES.find((s) => s.test(f.buffer));
    if (!sig) {
      rejected.push(f.originalname);
      continue;
    }
    const name = `${Date.now().toString(36)}-${store.uid(4)}${sig.ext}`;
    fs.writeFileSync(path.join(store.UPLOADS_DIR, name), f.buffer);
    saved.push({ src: `/uploads/${name}`, name: f.originalname });
  }
  res.json({ saved, rejected });
});

api.post('/account', (req, res) => {
  const { currentPassword, newPassword, newUsername } = req.body || {};
  const admin = auth.getAdmin();
  if (typeof currentPassword !== 'string' || !auth.verifyPassword(currentPassword, admin))
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  if (typeof newPassword !== 'string' || newPassword.length < 10)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 10 caracteres.' });
  const user = typeof newUsername === 'string' && newUsername.trim() ? newUsername.trim().slice(0, 40) : admin.username;
  const updated = auth.changePassword(admin, newPassword, user);
  auth.setSession(res, updated); // la sesión anterior queda invalidada; esta es la nueva
  res.json({ ok: true, username: updated.username });
});

app.use('/api/admin', api);

// ---------- Errores ----------
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((req, res) => {
  res.status(404).send(render.notFoundPage({ site: content.getSite(), req }));
});
app.use((err, req, res, _next) => {
  if (req.path.startsWith('/api')) {
    const status = err instanceof multer.MulterError ? 400 : err.status || 500;
    const msg = err instanceof multer.MulterError ? 'Archivo demasiado grande o inválido (máx. 10 MB).' : 'Error del servidor';
    if (status === 500) console.error(err);
    return res.status(status).json({ error: msg });
  }
  if (err.status === 404 || err.code === 'ENOENT') return res.status(404).send(render.notFoundPage({ site: content.getSite(), req }));
  console.error(err);
  res.status(500).send('Error del servidor');
});

staticsite.schedule(); // sincroniza docs/ al arrancar

app.listen(PORT, () => console.log(`Portfolio en http://localhost:${PORT}  ·  Panel en http://localhost:${PORT}/admin`));
