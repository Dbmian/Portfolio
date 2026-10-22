'use strict';
// Regenera docs/ manualmente:  npm run build
const { build } = require('../src/staticsite');
const r = build();
console.log(`Sitio estático generado en docs/ (base ${r.base}) con ${r.count} tutoriales.`);
