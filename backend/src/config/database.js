const { Pool } = require('pg');

// Inyectar timezone en la connection string para evitar race conditions
const base = process.env.DATABASE_URL || '';
const sep  = base.includes('?') ? '&' : '?';
const connectionString = base + sep + 'options=-c%20timezone%3DAmerica%2FArgentina%2FBuenos_Aires';

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = pool;
