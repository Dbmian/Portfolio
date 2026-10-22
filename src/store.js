'use strict';
// Persistencia simple en archivos JSON (sin base de datos que instalar).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, name);
}

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// Escritura atómica: se escribe un temporal y se renombra, así nunca queda un JSON a medias.
function write(name, data) {
  const target = file(name);
  const tmp = target + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, target);
}

const uid = (n = 6) => crypto.randomBytes(n).toString('hex');

module.exports = { DATA_DIR, UPLOADS_DIR, read, write, uid };
