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
