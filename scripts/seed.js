'use strict';
// Carga el contenido inicial (el portfolio original). Solo escribe si data/ está vacío,
// salvo que se use:  node scripts/seed.js --force
// Las imágenes originales se leen de scripts/seed-img/.
const fs = require('fs');
const path = require('path');
const store = require('../src/store');

const force = process.argv.includes('--force');
if (!force && fs.existsSync(path.join(store.DATA_DIR, 'tutorials.json'))) {
  console.log('Ya hay contenido en data/. Usá --force para reemplazarlo.');
  process.exit(0);
}

const SRC = path.join(__dirname, 'seed-img');
const dirs = { 1: 'tuto1-parte1', 2: 'tuto2', 3: 'tuto3', 4: 'tuto4', 5: 'tuto5' };

function images(n) {
  const out = [];
  const dir = path.join(SRC, dirs[n]);
  for (const f of fs.readdirSync(dir).sort((a, b) => parseInt(a) - parseInt(b))) {
    const name = `sql-p${n}-${f.replace(/\s+/g, '-').toLowerCase()}`;
    fs.copyFileSync(path.join(dir, f), path.join(store.UPLOADS_DIR, name));
    out.push({ src: `/uploads/${name}`, caption: '' });
  }
  return out;
}

const b = (type, extra) => ({ id: store.uid(4), type, ...extra });

const parts = [
  {
    title: 'Introducción a SQL',
    meta: [{ label: 'Motor', value: 'SQLite' }, { label: 'Herramienta', value: 'SQLiteStudio' }],
    blocks: [
      b('text', { text: 'Esta sección cubre los conceptos básicos de SQL: cómo crear tablas, cargar datos y usar algunas funciones elementales.' }),
      b('list', { ordered: true, items: ['Cómo crear una tabla y cargar datos', '`SELECT` básico', 'Uso de `WHERE`', '`ORDER BY`', 'Funciones de agregación (`AVG`)', '`GROUP BY`'] }),
      b('images', { images: images(1) }),
      b('text', { text: 'Se ven conceptos como tablas, filas, columnas y claves primarias.' })
    ]
  },
  {
    title: 'Relaciones entre tablas y consultas más complejas',
    meta: [{ label: 'Motor', value: 'SQLite' }, { label: 'Herramienta', value: 'SQLiteStudio' }],
    blocks: [
      b('text', { text: 'En esta sección muestro cómo se relacionan las tablas entre sí y cómo usar `JOIN` para responder preguntas más complejas.' }),
      b('list', { ordered: true, items: ['Estructura de la base de datos y tablas relacionadas', 'Uso de `JOIN` para relacionar empleados y proyectos', '`JOIN` + `GROUP BY` para contar empleados por proyecto', 'Funciones de agregación (`AVG`) aplicadas a datos relacionados', '`JOIN` + `WHERE` para filtrar información entre tablas'] }),
      b('images', { images: images(2) }),
      b('text', { text: 'La idea es mostrar cómo SQL permite responder preguntas concretas a partir de datos relacionados.' })
    ]
  },
  {
    title: 'HAVING, WHERE y JOINS',
    meta: [{ label: 'Motor', value: 'SQLite' }, { label: 'Herramienta', value: 'SQLiteStudio' }],
    blocks: [
      b('text', { text: 'Continuando con las partes anteriores, en esta ocasión avanzamos con consultas más complejas.' }),
      b('list', { ordered: true, items: ['Diferencias entre las sentencias `JOIN`', '`HAVING` y su diferencia con `WHERE`', 'Uso de `INNER JOIN`', 'Uso de `LEFT JOIN`', 'Uso de `HAVING`', 'Subconsulta sencilla'] }),
      b('images', { images: images(3) }),
      b('text', { text: 'Seguimos avanzando incorporando consultas un poco más complejas, manteniendo siempre ejemplos simples y reales.' })
    ]
  },
  {
    title: 'Subqueries',
    meta: [{ label: 'Motor', value: 'PostgreSQL' }, { label: 'Herramienta', value: 'pgAdmin' }],
    blocks: [
      b('text', { text: 'En esta parte explico cómo usar **subconsultas**.' }),
      b('list', { ordered: true, items: ['¿Qué es una subconsulta?', 'Subconsultas en la cláusula `WHERE`', 'Subconsultas en la cláusula `FROM`', 'Subconsultas correlacionadas'] }),
      b('images', { images: images(4) }),
      b('text', { text: 'En la próxima parte vamos a comenzar a trabajar con PostgreSQL, viendo cómo conectarnos a una base de datos y cómo resolver consultas más complejas cuando no es posible utilizar `JOIN`.' })
    ]
  },
  {
    title: 'PostgreSQL y consultas avanzadas',
    meta: [{ label: 'Motor', value: 'PostgreSQL' }, { label: 'Herramienta', value: 'pgAdmin' }],
    blocks: [
      b('text', { text: 'En esta parte final muestro cómo trabajar con PostgreSQL y resolver consultas más complejas.' }),
      b('list', { ordered: true, items: ['Conexión a PostgreSQL', 'Estructura y valores', 'Ejemplo 1 sin `JOIN`', 'Ejemplo 2 sin `JOIN`', 'Ejemplo 3 sin `JOIN`'] }),
      b('images', { images: images(5) }),
      b('text', { text: 'Se muestran conexión a PostgreSQL, CTEs, funciones de ventana y consultas avanzadas.' })
    ]
  }
].map((p) => ({ id: store.uid(4), ...p }));

const now = new Date().toISOString();
const tutorials = [
  {
    id: store.uid(5),
    slug: 'sql',
    title: 'Tutorial de SQL básico: SQLite y PostgreSQL',
    subtitle: 'SQLite · PostgreSQL · Consultas básicas',
    summary: 'Conceptos fundamentales de SQL, conexiones y consultas simples, de tablas y JOINs hasta subconsultas.',
    status: 'published',
    parts,
    updatedAt: now
  },
  {
    id: store.uid(5),
    slug: 'linux',
    title: 'Tutorial de Linux',
    subtitle: '',
    summary: 'Comandos esenciales y primeros pasos en la terminal.',
    status: 'soon',
    parts: [],
    updatedAt: now
  }
];

const site = {
  name: 'Damián Briante',
  role: 'Estudiante de Sistemas',
  tagline: 'Creo proyectos simples, claros y funcionales mientras sigo aprendiendo desarrollo web y bases de datos.',
  skills: ['HTML', 'CSS', 'JavaScript', 'SQL', 'NoSQL'],
  about: [
    'Soy Damián Briante, estudiante de sistemas. Me gusta crear proyectos simples, claros y funcionales mientras sigo aprendiendo desarrollo web y bases de datos.'
  ],
  email: 'damian.briante@gmail.com',
  linkedin: 'https://www.linkedin.com/in/damian-briante-4051872aa/',
  github: ''
};

store.write('site.json', site);
store.write('tutorials.json', tutorials);
console.log('Contenido inicial cargado: %d tutoriales, %d partes.', tutorials.length, parts.length);
