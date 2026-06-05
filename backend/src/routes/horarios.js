const router = require('express').Router();
const pool = require('../config/database');
const { soloAdmin } = require('../middleware/auth');

// GET /api/horarios/hoy — solo admin
router.get('/hoy', soloAdmin, async (req, res) => {
  const { local_id } = req.query;
  try {
    let query = `
      SELECT h.*, u.nombre, u.apellido, u.rol, u.local_id,
             l.nombre AS local_nombre
      FROM horarios h
      JOIN usuarios u ON h.usuario_id = u.id
      LEFT JOIN locales l ON u.local_id = l.id
      WHERE h.fecha = CURRENT_DATE AND u.activo = true
    `;
    const params = [];
    if (local_id) { query += ` AND u.local_id = $1`; params.push(local_id); }
    query += ' ORDER BY h.hora_entrada DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener horarios de hoy:', error);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

// GET /api/horarios — solo admin
router.get('/', soloAdmin, async (req, res) => {
  const { usuario_id, fecha, fecha_desde, fecha_hasta, local_id } = req.query;
  let query = `
    SELECT h.*, u.nombre, u.apellido, u.rol, u.local_id,
           l.nombre AS local_nombre
    FROM horarios h
    JOIN usuarios u ON h.usuario_id = u.id
    LEFT JOIN locales l ON u.local_id = l.id
    WHERE u.activo = true
  `;
  const params = [];
  let n = 1;

  if (usuario_id)  { query += ` AND h.usuario_id = $${n++}`; params.push(usuario_id); }
  if (fecha)       { query += ` AND h.fecha = $${n++}`;      params.push(fecha); }
  if (fecha_desde) { query += ` AND h.fecha >= $${n++}`;      params.push(fecha_desde); }
  if (fecha_hasta) { query += ` AND h.fecha <= $${n++}`;      params.push(fecha_hasta); }
  if (local_id)    { query += ` AND u.local_id = $${n++}`;    params.push(local_id); }

  query += ' ORDER BY h.fecha DESC, h.hora_entrada DESC';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener horarios:', error);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

// GET /api/horarios/mio — el empleado ve solo su propio historial
router.get('/mio', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fecha,
             hora_entrada,
             hora_salida,
             CASE
               WHEN hora_salida IS NOT NULL THEN
                 EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 3600
             END AS horas_trabajadas
      FROM horarios
      WHERE usuario_id = $1
      ORDER BY fecha DESC
      LIMIT 60
    `, [req.usuario.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial propio:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/horarios/estado-hoy — el empleado consulta si ya fichó hoy
router.get('/estado-hoy', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM horarios WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
      [req.usuario.id]
    );
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar estado' });
  }
});

// POST /api/horarios/fichar-empleado — admin ficha a un empleado con su contraseña
router.post('/fichar-empleado', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { email, password, accion } = req.body; // accion: 'entrada' | 'salida'

  if (!email || !password || !accion) {
    return res.status(400).json({ error: 'Faltan campos: email, password, accion' });
  }

  try {
    // Verificar credenciales del empleado
    const userRes = await pool.query(
      `SELECT * FROM usuarios WHERE email = $1 AND activo = true`,
      [email.toLowerCase().trim()]
    );
    const usuario = userRes.rows[0];
    if (!usuario) return res.status(401).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Ver registro de hoy
    const hoyRes = await pool.query(
      `SELECT * FROM horarios WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
      [usuario.id]
    );
    const hoy = hoyRes.rows[0];

    if (accion === 'entrada') {
      if (hoy?.hora_entrada) return res.status(400).json({ error: `${usuario.nombre} ya registró su entrada hoy a las ${new Date(hoy.hora_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` });
      const result = await pool.query(
        `INSERT INTO horarios (usuario_id, fecha, hora_entrada) VALUES ($1, CURRENT_DATE, NOW()) RETURNING *`,
        [usuario.id]
      );
      return res.json({ accion: 'entrada', nombre: `${usuario.nombre} ${usuario.apellido}`, registro: result.rows[0] });
    }

    if (accion === 'salida') {
      if (!hoy?.hora_entrada) return res.status(400).json({ error: `${usuario.nombre} no registró entrada hoy` });
      if (hoy?.hora_salida) return res.status(400).json({ error: `${usuario.nombre} ya registró su salida hoy` });
      const result = await pool.query(
        `UPDATE horarios SET hora_salida = NOW() WHERE usuario_id = $1 AND fecha = CURRENT_DATE RETURNING *`,
        [usuario.id]
      );
      return res.json({ accion: 'salida', nombre: `${usuario.nombre} ${usuario.apellido}`, registro: result.rows[0] });
    }

    return res.status(400).json({ error: 'Accion invalida, debe ser entrada o salida' });
  } catch (error) {
    console.error('Error al fichar empleado:', error);
    res.status(500).json({ error: 'Error al fichar' });
  }
});

// POST /api/horarios/fichar — registrar entrada o salida manualmente
router.post('/fichar', async (req, res) => {
  try {
    // Ver si ya tiene registro hoy
    const { rows } = await pool.query(
      `SELECT * FROM horarios WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
      [req.usuario.id]
    );

    if (!rows[0]) {
      // No fichó entrada → registrar entrada
      const result = await pool.query(`
        INSERT INTO horarios (usuario_id, fecha, hora_entrada)
        VALUES ($1, CURRENT_DATE, NOW())
        RETURNING *
      `, [req.usuario.id]);
      return res.json({ accion: 'entrada', registro: result.rows[0] });
    }

    if (rows[0].hora_salida) {
      return res.status(400).json({ error: 'Ya registraste entrada y salida hoy' });
    }

    // Ya fichó entrada → registrar salida
    const result = await pool.query(`
      UPDATE horarios SET hora_salida = NOW()
      WHERE usuario_id = $1 AND fecha = CURRENT_DATE
      RETURNING *
    `, [req.usuario.id]);

    res.json({ accion: 'salida', registro: result.rows[0] });
  } catch (error) {
    console.error('Error al fichar:', error);
    res.status(500).json({ error: 'Error al fichar' });
  }
});

module.exports = router;
