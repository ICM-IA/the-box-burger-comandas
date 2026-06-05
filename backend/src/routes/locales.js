const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { soloAdmin } = require('../middleware/auth');

// GET /api/locales
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM locales WHERE activo = true ORDER BY id`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener locales' });
  }
});

// POST /api/locales — crear local + usuario de acceso
router.post('/', soloAdmin, async (req, res) => {
  const { nombre, direccion, email, password, permisos = [] } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos: nombre, email, password' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear el local
    const localRes = await client.query(
      `INSERT INTO locales (nombre, direccion) VALUES ($1, $2) RETURNING *`,
      [nombre, direccion || null]
    );
    const local = localRes.rows[0];

    // Crear usuario de acceso para el local
    const hash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, local_id, permisos)
       VALUES ($1, $2, $3, $4, 'cajero', $5, $6) RETURNING id, nombre, apellido, email, rol, local_id, permisos`,
      ['Local', nombre, email.toLowerCase().trim(), hash, local.id, permisos.length > 0 ? permisos : null]
    );

    await client.query('COMMIT');
    res.status(201).json({ local, usuario: userRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    console.error('Error al crear local:', error);
    res.status(500).json({ error: 'Error al crear local' });
  } finally {
    client.release();
  }
});

// PATCH /api/locales/:id
router.patch('/:id', soloAdmin, async (req, res) => {
  const { nombre, direccion, activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE locales SET nombre = COALESCE($1, nombre), direccion = COALESCE($2, direccion),
       activo = COALESCE($3, activo) WHERE id = $4 RETURNING *`,
      [nombre, direccion, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Local no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar local' });
  }
});

module.exports = router;
