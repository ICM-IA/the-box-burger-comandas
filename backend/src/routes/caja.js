const router = require('express').Router();
const pool = require('../config/database');
const { soloAdmin } = require('../middleware/auth');

// GET /api/caja?local_id=&fecha=
router.get('/', async (req, res) => {
  const { local_id, fecha } = req.query;
  const fechaConsulta = fecha || 'CURRENT_DATE';

  const params = [];
  let n = 1;
  let whereLocal = '';
  let whereLocalPedidos = '';

  if (local_id) {
    whereLocal = `AND local_id = $${n}`;
    whereLocalPedidos = `AND p.local_id = $${n}`;
    params.push(local_id);
    n++;
  }

  const fechaParam = fecha ? `$${n++}` : 'CURRENT_DATE';
  if (fecha) params.push(fecha);

  try {
    const resumen = await pool.query(`
      SELECT
        COUNT(*)::integer                                                              AS total_pedidos,
        COALESCE(SUM(total), 0)                                                       AS total_ventas,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo'      THEN total ELSE 0 END), 0) AS total_efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'mercadopago'   THEN total ELSE 0 END), 0) AS total_mp,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta'       THEN total ELSE 0 END), 0) AS total_tarjeta,
        COALESCE(SUM(CASE WHEN metodo_pago = 'qr'            THEN total ELSE 0 END), 0) AS total_qr,
        COUNT(CASE WHEN canal = 'whatsapp'  THEN 1 END)::integer AS pedidos_whatsapp,
        COUNT(CASE WHEN canal = 'web'       THEN 1 END)::integer AS pedidos_web,
        COUNT(CASE WHEN canal = 'mostrador' THEN 1 END)::integer AS pedidos_mostrador,
        COUNT(CASE WHEN tipo = 'delivery'   THEN 1 END)::integer AS pedidos_delivery,
        COUNT(CASE WHEN tipo = 'retiro'     THEN 1 END)::integer AS pedidos_retiro
      FROM pedidos
      WHERE DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = ${fechaParam}
        AND estado != 'cancelado'
        ${whereLocal}
    `, params);

    const pedidos = await pool.query(`
      SELECT p.id, p.numero_pedido, p.tipo, p.canal, p.estado,
             p.total, p.metodo_pago, p.created_at,
             c.nombre AS cliente_nombre
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE DATE(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = ${fechaParam}
        ${whereLocalPedidos}
      ORDER BY p.created_at DESC
    `, params);

    const cajaRes = await pool.query(`
      SELECT * FROM caja
      WHERE fecha = ${fechaParam}
        ${whereLocal}
    `, params);

    res.json({
      resumen: resumen.rows[0],
      pedidos: pedidos.rows,
      caja_cerrada: cajaRes.rows[0]?.cerrada || false,
      caja: cajaRes.rows[0] || null,
    });
  } catch (error) {
    console.error('Error al obtener caja:', error);
    res.status(500).json({ error: 'Error al obtener caja' });
  }
});

// POST /api/caja/cerrar
router.post('/cerrar', async (req, res) => {
  const { local_id, notas } = req.body;

  if (!local_id) return res.status(400).json({ error: 'local_id es requerido' });

  try {
    const resumen = await pool.query(`
      SELECT
        COUNT(*)::integer                                                              AS total_pedidos,
        COALESCE(SUM(total), 0)                                                       AS total_ventas,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo'      THEN total ELSE 0 END), 0) AS total_efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'mercadopago'   THEN total ELSE 0 END), 0) AS total_mp,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta'       THEN total ELSE 0 END), 0) AS total_tarjeta,
        COALESCE(SUM(CASE WHEN metodo_pago = 'qr'            THEN total ELSE 0 END), 0) AS total_qr
      FROM pedidos
      WHERE DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
        AND local_id = $1
        AND estado != 'cancelado'
    `, [local_id]);

    const r = resumen.rows[0];

    const { rows } = await pool.query(`
      INSERT INTO caja (local_id, fecha, usuario_id, total_efectivo, total_mp, total_transferencia,
                        total_tarjeta, total_qr, total_pedidos, total_ventas, cerrada, hora_cierre, notas)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), $10)
      ON CONFLICT (local_id, fecha) DO UPDATE SET
        total_efectivo     = EXCLUDED.total_efectivo,
        total_mp           = EXCLUDED.total_mp,
        total_transferencia = EXCLUDED.total_transferencia,
        total_tarjeta      = EXCLUDED.total_tarjeta,
        total_qr           = EXCLUDED.total_qr,
        total_pedidos      = EXCLUDED.total_pedidos,
        total_ventas       = EXCLUDED.total_ventas,
        cerrada            = true,
        hora_cierre        = NOW(),
        notas              = EXCLUDED.notas
      RETURNING *
    `, [
      local_id, req.usuario.id,
      r.total_efectivo, r.total_mp, r.total_transferencia, r.total_tarjeta, r.total_qr,
      r.total_pedidos, r.total_ventas, notas || null,
    ]);

    res.json({ success: true, caja: rows[0] });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
});

// GET /api/caja/historial
router.get('/historial', async (req, res) => {
  const { local_id } = req.query;
  try {
    let query = `
      SELECT c.*, l.nombre AS local_nombre, u.nombre AS cajero_nombre, u.apellido AS cajero_apellido
      FROM caja c
      LEFT JOIN locales l   ON c.local_id  = l.id
      LEFT JOIN usuarios u  ON c.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (local_id) { query += ` AND c.local_id = $1`; params.push(local_id); }
    query += ' ORDER BY c.fecha DESC LIMIT 30';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
