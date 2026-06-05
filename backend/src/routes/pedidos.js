const router = require('express').Router();
const axios = require('axios');
const pool = require('../config/database');

const SELECT_PEDIDO = `
  SELECT p.*,
         c.nombre  AS cliente_nombre,
         c.telefono AS cliente_telefono,
         l.nombre  AS local_nombre,
         u.nombre  AS repartidor_nombre,
         u.apellido AS repartidor_apellido,
         COALESCE(
           json_agg(
             json_build_object(
               'id',               pi.id,
               'nombre_producto',  pi.nombre_producto,
               'cantidad',         pi.cantidad,
               'precio_unitario',  pi.precio_unitario,
               'subtotal',         pi.subtotal,
               'personalizaciones', pi.personalizaciones
             ) ORDER BY pi.id
           ) FILTER (WHERE pi.id IS NOT NULL),
           '[]'
         ) AS items
  FROM pedidos p
  LEFT JOIN clientes c    ON p.cliente_id   = c.id
  LEFT JOIN locales l     ON p.local_id     = l.id
  LEFT JOIN usuarios u    ON p.repartidor_id = u.id
  LEFT JOIN pedido_items pi ON p.id         = pi.pedido_id
`;

// GET /api/pedidos
router.get('/', async (req, res) => {
  const { local_id, estado, tipo, fecha } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  let n = 1;

  if (local_id) { where += ` AND p.local_id = $${n++}`; params.push(local_id); }
  if (tipo)     { where += ` AND p.tipo = $${n++}`;     params.push(tipo); }

  if (estado) {
    const estados = estado.split(',');
    where += ` AND p.estado = ANY($${n++}::text[])`;
    params.push(estados);
  }

  if (fecha) {
    where += ` AND DATE(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = $${n++}`;
    params.push(fecha);
  } else {
    where += ` AND DATE(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE`;
  }

  try {
    const { rows } = await pool.query(
      `${SELECT_PEDIDO} ${where} GROUP BY p.id, c.nombre, c.telefono, l.nombre, u.nombre, u.apellido ORDER BY p.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/pedidos/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_PEDIDO} WHERE p.id = $1 GROUP BY p.id, c.nombre, c.telefono, l.nombre, u.nombre, u.apellido`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// POST /api/pedidos — crear pedido manualmente (mostrador)
router.post('/', async (req, res) => {
  const {
    local_id, cliente_nombre, cliente_telefono, cliente_direccion,
    tipo, direccion_entrega, distancia_km = 0, costo_envio = 0,
    subtotal = 0, total = 0, metodo_pago = 'efectivo',
    items = [], notas = ''
  } = req.body;

  if (!local_id || !cliente_nombre || !total) {
    return res.status(400).json({ error: 'Faltan campos requeridos: local_id, cliente_nombre, total' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generar número de pedido correlativo
    const contadorRes = await client.query(`
      SELECT COUNT(*) + 1 AS siguiente
      FROM pedidos
      WHERE local_id = $1
        AND DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
    `, [local_id]);

    const prefijo = local_id === 2 ? 'ED' : 'ER';
    const numero_pedido = `${prefijo}-${String(contadorRes.rows[0].siguiente).padStart(4, '0')}`;

    // Crear cliente
    let cliente_id = null;
    if (cliente_nombre) {
      const cliRes = await client.query(`
        INSERT INTO clientes (nombre, telefono, direccion_habitual, local_asignado, total_pedidos)
        VALUES ($1, $2, $3, $4, 1) RETURNING id
      `, [cliente_nombre, cliente_telefono || null, cliente_direccion || null, local_id]);
      cliente_id = cliRes.rows[0].id;
    }

    // Crear pedido
    const pedidoRes = await client.query(`
      INSERT INTO pedidos (
        numero_pedido, local_id, cliente_id, canal, tipo, estado,
        direccion_entrega, distancia_km, costo_envio, subtotal, total,
        metodo_pago, notas
      ) VALUES ($1, $2, $3, 'mostrador', $4, 'nuevo', $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      numero_pedido, local_id, cliente_id, tipo || 'retiro',
      direccion_entrega || null, distancia_km, costo_envio,
      subtotal || total, total, metodo_pago, notas || null
    ]);

    const pedido = pedidoRes.rows[0];

    // Insertar items
    for (const item of items) {
      await client.query(`
        INSERT INTO pedido_items (pedido_id, nombre_producto, cantidad, precio_unitario, subtotal, personalizaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        pedido.id,
        item.nombre_producto,
        item.cantidad || 1,
        item.precio_unitario || 0,
        (item.cantidad || 1) * (item.precio_unitario || 0),
        item.personalizaciones || null
      ]);
    }

    // Registrar monto en caja
    if (total > 0) {
      const columna = {
        'efectivo': 'total_efectivo',
        'mercadopago': 'total_mp',
        'transferencia': 'total_transferencia',
        'tarjeta': 'total_mp',
        'qr': 'total_mp'
      }[metodo_pago] || 'total_efectivo';

      await client.query(`
        INSERT INTO caja (local_id, fecha, total_efectivo, total_mp, total_transferencia)
        VALUES ($1, CURRENT_DATE,
          CASE WHEN $2 = 'total_efectivo' THEN $3 ELSE 0 END,
          CASE WHEN $2 = 'total_mp' THEN $3 ELSE 0 END,
          CASE WHEN $2 = 'total_transferencia' THEN $3 ELSE 0 END
        )
        ON CONFLICT (local_id, fecha) DO UPDATE SET
          total_efectivo = total_efectivo + CASE WHEN $2 = 'total_efectivo' THEN $3 ELSE 0 END,
          total_mp = total_mp + CASE WHEN $2 = 'total_mp' THEN $3 ELSE 0 END,
          total_transferencia = total_transferencia + CASE WHEN $2 = 'total_transferencia' THEN $3 ELSE 0 END
      `, [local_id, columna, total]);
    }

    await client.query('COMMIT');

    // Obtener pedido completo
    const completo = await pool.query(`
      ${SELECT_PEDIDO} WHERE p.id = $1 GROUP BY p.id, c.nombre, c.telefono, l.nombre, u.nombre, u.apellido
    `, [pedido.id]);

    req.app.get('io').emit('nuevo_pedido', completo.rows[0]);

    res.status(201).json({ success: true, pedido: completo.rows[0], numero_pedido });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido', detalle: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/estado
router.patch('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  const validos = ['nuevo', 'en_cocina', 'listo', 'en_camino', 'entregado', 'cancelado'];

  if (!validos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [estado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

    const pedido = rows[0];
    req.app.get('io').emit('pedido_actualizado', pedido);

    // Disparar el webhook N8N correspondiente a cada etapa
    const urlPorEstado = {
      en_cocina: process.env.N8N_WEBHOOK_EN_COCINA,
      listo:     process.env.N8N_WEBHOOK_LISTOS,
      en_camino: process.env.N8N_WEBHOOK_EN_COCINA, // reutiliza o usa uno propio
      entregado: process.env.N8N_WEBHOOK_LISTOS,
    };
    const urlN8N = urlPorEstado[estado];
    if (urlN8N) notificarN8N(pedido, urlN8N).catch(console.error);

    res.json(pedido);
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// PATCH /api/pedidos/:id/repartidor
router.patch('/:id/repartidor', async (req, res) => {
  const { repartidor_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE pedidos SET repartidor_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [repartidor_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    req.app.get('io').emit('pedido_actualizado', rows[0]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al asignar repartidor:', error);
    res.status(500).json({ error: 'Error al asignar repartidor' });
  }
});

// DELETE /api/pedidos/:id — eliminar pedido (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM pedidos WHERE id = $1 RETURNING id, numero_pedido',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

    req.app.get('io').emit('pedido_eliminado', { id: rows[0].id });
    res.json({ success: true, numero_pedido: rows[0].numero_pedido });
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
});

async function notificarN8N(pedido, url) {
  if (!url) return;
  await axios.post(url, {
    pedido_id:           pedido.id,
    numero_pedido:       pedido.numero_pedido,
    estado:              pedido.estado,
    tipo:                pedido.tipo,
    cliente_nombre:      pedido.cliente_nombre,
    cliente_telefono:    pedido.cliente_telefono,
    direccion_entrega:   pedido.direccion_entrega,
    total:               pedido.total,
    metodo_pago:         pedido.metodo_pago,
    tiempo_estimado:     pedido.tiempo_estimado,
    ghl_contact_id:      pedido.ghl_contact_id,
    ghl_conversation_id: pedido.ghl_conversation_id,
  }, { timeout: 8000 });
}

module.exports = router;
