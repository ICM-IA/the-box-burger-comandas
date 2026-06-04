const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function sembrarDatos() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM locales');
    if (parseInt(rows[0].count) > 0) return;

    await client.query(`
      INSERT INTO locales (nombre, direccion, telefono) VALUES
      ('Entre Ríos', 'Entre Ríos 2233, Mar del Plata', '2236774365'),
      ('Edison', 'Av. Edison 2876, Mar del Plata', '2235950092')
    `);

    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, local_id)
      VALUES ('Santiago', 'Admin', 'admin@theboxburger.com', $1, 'admin', 1)
    `, [hash]);

    console.log('✅ Datos iniciales cargados — admin@theboxburger.com / admin123');
  } finally {
    client.release();
  }
}

module.exports = sembrarDatos;
