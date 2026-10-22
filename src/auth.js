'use strict';
// Autenticación sin dependencias extra: scrypt para la contraseña y cookie firmada con HMAC.
const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'pf_session';
const SESSION_MS = 1000 * 60 * 60 * 12; // 12 horas
const IS_PROD = process.env.NODE_ENV === 'production';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, admin) {
  const { hash } = hashPassword(password, admin.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(admin.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  let s = store.read('secret.json', null);
  if (!s) {
    s = { secret: crypto.randomBytes(32).toString('hex') };
    store.write('secret.json', s);
  }
  return s.secret;
}

const SECRET = getSecret();

function getAdmin() {
  return store.read('admin.json', null);
}

// Primera ejecución: crea el usuario administrador.
function ensureAdmin() {
  if (getAdmin()) return;
  const username = process.env.ADMIN_USER || 'admin';
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  const { salt, hash } = hashPassword(password);
  store.write('admin.json', { username, salt, hash, version: 1 });
  console.log('\n  ┌─ Usuario administrador creado ─────────────────────');
  console.log(`  │  Usuario:    ${username}`);
  if (generated) {
    console.log(`  │  Contraseña: ${password}`);
    console.log('  │  (cambiala desde Panel → Cuenta apenas ingreses)');
  } else {
    console.log('  │  Contraseña: la definida en ADMIN_PASSWORD');
  }
  console.log('  └────────────────────────────────────────────────────\n');
}

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function createToken(admin) {
  const payload = Buffer.from(JSON.stringify({ u: admin.username, v: admin.version, exp: Date.now() + SESSION_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
  const admin = getAdmin();
  if (!admin || data.exp < Date.now() || data.u !== admin.username || data.v !== admin.version) return null;
  return admin;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSession(res, admin) {
  res.cookie(COOKIE, createToken(admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_MS,
    path: '/'
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Middleware: carga req.admin si hay sesión válida (no bloquea).
function attach(req, _res, next) {
  req.admin = readToken(parseCookies(req.headers.cookie)[COOKIE]);
  next();
}

function requireAdminPage(req, res, next) {
  if (req.admin) return next();
  res.redirect('/admin/login');
}

// Para la API: exige sesión y el header X-Requested-With (defensa extra contra CSRF).
function requireAdminApi(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: 'No autorizado' });
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'portfolio-admin')
    return res.status(403).json({ error: 'Solicitud no permitida' });
  next();
}

function changePassword(admin, newPassword, newUsername) {
  const { salt, hash } = hashPassword(newPassword);
  const updated = { username: newUsername || admin.username, salt, hash, version: admin.version + 1 };
  store.write('admin.json', updated);
  return updated;
}

// Límite simple de intentos de login por IP.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function loginAllowed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) return true;
  return rec.count < MAX_ATTEMPTS;
}
function loginFailed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
  else rec.count++;
}
function loginOk(ip) {
  attempts.delete(ip);
}

module.exports = {
  ensureAdmin, getAdmin, verifyPassword, attach, requireAdminPage, requireAdminApi,
  setSession, clearSession, changePassword, loginAllowed, loginFailed, loginOk
};
