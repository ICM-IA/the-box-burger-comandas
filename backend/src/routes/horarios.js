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
  const { usuario_id, fecha_desde, fecha_hasta } = req.query;
  let query = `SELECT h.*, u.nombre, u.apellido, u.rol FROM horarios h JOIN usuarios u ON h.usuario_id = u.id WHERE 1=1`;
  const params = [];
  let n = 1;
  if (usuario_id)  { query += ` AND h.usuario_id = $${n++}`; params.push(usuario_id); }
  if (fecha_desde) { query += ` AND h.fecha >= $${n++}`;      params.push(fecha_desde); }
  if (fecha_hasta) { query += ` AND h.fecha <= $${n++}`;      params.push(fecha_hasta); }
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
