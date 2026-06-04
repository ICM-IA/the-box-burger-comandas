const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { soloAdmin } = require('../middleware/auth');

// GET /api/usuarios
router.get('/', async (req, res) => {
  const { rol, local_id } = req.query;
  let query = `
    SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.local_id, u.activo, u.created_at,
           l.nombre AS local_nombre
    FROM usuarios u LEFT JOIN locales l ON u.local_id = l.id WHERE 1=1
  `;
  const params = [];
  let n = 1;
  if (rol)      { query += ` AND u.rol = $${n++}`;      params.push(rol); }
  if (local_id) { query += ` AND u.local_id = $${n++}`; params.push(local_id); }
  query += ' ORDER BY u.nombre, u.apellido';

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios
router.post('/', soloAdmin, async (req, res) => {
  const { nombre, apellido, email, password, rol, local_id } = req.body;

  if (!nombre || !apellido || !email || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, local_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, apellido, email, rol, local_id, activo, created_at
    `, [nombre, apellido, email.toLowerCase().trim(), hash, rol, local_id || null]);

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/usuarios/:id
router.patch('/:id', soloAdmin, async (req, res) => {
  const { nombre, apellido, email, password, rol, local_id, activo } = req.body;

  try {
    let query = `UPDATE usuarios SET updated_at = NOW()`;
    const params = [];
    let n = 1;

    if (nombre   !== undefined) { query += `, nombre = $${n++}`;   params.push(nombre); }
    if (apellido !== undefined) { query += `, apellido = $${n++}`; params.push(apellido); }
    if (email    !== undefined) { query += `, email = $${n++}`;    params.push(email.toLowerCase().trim()); }
    if (rol      !== undefined) { query += `, rol = $${n++}`;      params.push(rol); }
    if (local_id !== undefined) { query += `, local_id = $${n++}`; params.push(local_id); }
    if (activo   !== undefined) { query += `, activo = $${n++}`;   params.push(activo); }

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash = $${n++}`;
      params.push(hash);
    }

    params.push(req.params.id);
    query += ` WHERE id = $${n} RETURNING id, nombre, apellido, email, rol, local_id, activo`;

    const { rows } = await pool.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id (soft delete)
router.delete('/:id', soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

module.exports = router;
