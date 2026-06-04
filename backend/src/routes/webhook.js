const router = require('express').Router();
const pool = require('../config/database');

// Extrae la sección "Pedido:" del mensaje de WhatsApp
function extraerDetallePedido(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const marcas = ['🍽️ Pedido:', 'Pedido:', 'pedido:'];
  let inicio = -1;
  for (const marca of marcas) {
    const idx = texto.indexOf(marca);
    if (idx !== -1) { inicio = idx; break; }
  }
  if (inicio === -1) return texto.trim();
  const finMarcas = ['Subtotal:', '💰', '----', 'Total:'];
  let fin = texto.length;
  for (const m of finMarcas) {
    const idx = texto.indexOf(m, inicio + 10);
    if (idx !== -1 && idx < fin) fin = idx;
  }
  return texto.substring(inicio, fin).trim();
}

// Parsea el total del mensaje (ej: "Total: $29.000" o "Total: $29000")
function parsearTotal(texto) {
  if (!texto) return 0;
  const match = texto.match(/Total[^$\d]*\$?\s*([\d.,]+)/i);
  if (!match) return 0;
  const limpio = match[1].replace(/\./g, '').replace(',', '.');
  return parseFloat(limpio) || 0;
}

// Normaliza el local desde GHL (acepta "Entre Ríos", "entre_rios", "Edison", etc.)
function normalizarLocal(valor) {
  if (!valor) return null;
  const v = valor.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v.includes('entre') || v.includes('er')) return 'entre_rios';
  if (v.includes('edison') || v.includes('ed')) return 'edison';
  return valor.toLowerCase().replace(/\s+/g, '_');
}

// Normaliza el tipo desde GHL (acepta "Delivery", "Retiro", "retiro", etc.)
function normalizarTipo(valor) {
  if (!valor) return 'retiro';
  const v = valor.toLowerCase();
  if (v.includes('delivery') || v.includes('domicilio') || v.includes('envio')) return 'delivery';
  return 'retiro';
}

const webhookAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// POST /api/webhook/nuevo-pedido
router.post('/nuevo-pedido', webhookAuth, async (req, res) => {
  const {
    local, canal = 'whatsapp', tipo,
    ghl_contact_id, ghl_conversation_id,
    Nombre_cliente, nombre_cliente,        // desde GHL
    cliente, items = [],
    distancia_km, costo_envio, subtotal, total,
    metodo_pago, mp_link, notas, tiempo_estimado,
  } = req.body;

  const localNorm = normalizarLocal(local);
  const tipoNorm  = normalizarTipo(tipo);
  const notasLimpias = extraerDetallePedido(notas);

  // Calcular total: primero el campo directo, luego parseando el mensaje
  const totalFinal    = parseFloat(total)    || parsearTotal(notas) || 0;
  const subtotalFinal = parseFloat(subtotal) || totalFinal;

  // Nombre del cliente: desde campo GHL o desde objeto cliente
  const nombreCliente = Nombre_cliente || nombre_cliente || cliente?.nombre || null;

  if (!localNorm) {
    return res.status(400).json({ error: 'Falta el campo "local" (entre_rios o edison)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener local usando el valor normalizado
    const localNombre = localNorm === 'entre_rios' ? '%Entre Ríos%' : '%Edison%';
    const localRes = await client.query(
      'SELECT id FROM locales WHERE nombre ILIKE $1 AND activo = true',
      [localNombre]
    );
    if (!localRes.rows[0]) throw new Error(`Local '${localNorm}' no encontrado`);

    const local_id = localRes.rows[0].id;
    const prefijo = localNorm === 'entre_rios' ? 'ER' : 'ED';

    // Número de pedido correlativo diario
    const contadorRes = await client.query(`
      SELECT COUNT(*) + 1 AS siguiente
      FROM pedidos
      WHERE local_id = $1
        AND DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
    `, [local_id]);
    const numero_pedido = `${prefijo}-${String(contadorRes.rows[0].siguiente).padStart(4, '0')}`;

    // Crear / actualizar cliente (acepta nombre desde GHL o desde objeto cliente)
    let cliente_id = null;
    const cliNombre   = nombreCliente || cliente?.nombre || null;
    const cliTelefono = cliente?.telefono || null;
    const cliDir      = cliente?.direccion || null;

    if (cliNombre || ghl_contact_id) {
      if (ghl_contact_id) {
        const cliRes = await client.query(`
          INSERT INTO clientes (ghl_contact_id, nombre, telefono, direccion_habitual, local_asignado, total_pedidos)
          VALUES ($1, $2, $3, $4, $5, 1)
          ON CONFLICT (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL
          DO UPDATE SET
            nombre            = COALESCE(EXCLUDED.nombre, clientes.nombre),
            telefono          = COALESCE(EXCLUDED.telefono, clientes.telefono),
            total_pedidos     = clientes.total_pedidos + 1
          RETURNING id
        `, [ghl_contact_id, cliNombre, cliTelefono, cliDir, local_id]);
        cliente_id = cliRes.rows[0].id;
      } else if (cliNombre) {
        const cliRes = await client.query(`
          INSERT INTO clientes (nombre, telefono, direccion_habitual, local_asignado, total_pedidos)
          VALUES ($1, $2, $3, $4, 1) RETURNING id
        `, [cliNombre, cliTelefono, cliDir, local_id]);
        cliente_id = cliRes.rows[0].id;
      }
    }

    // Crear pedido
    const pedidoRes = await client.query(`
      INSERT INTO pedidos (
        numero_pedido, local_id, cliente_id, canal, tipo, estado,
        direccion_entrega, distancia_km, costo_envio, subtotal, total,
        metodo_pago, mp_link, notas, tiempo_estimado,
        ghl_conversation_id, ghl_contact_id
      ) VALUES ($1,$2,$3,$4,$5,'nuevo',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      numero_pedido, local_id, cliente_id, canal, tipoNorm,
      cliente?.direccion || null,
      distancia_km || null,
      costo_envio || 0,
      subtotalFinal, totalFinal,
      metodo_pago || null,
      mp_link || null,
      notasLimpias || null,
      tiempo_estimado || null,
      ghl_conversation_id || null,
      ghl_contact_id || null,
    ]);

    const pedido = pedidoRes.rows[0];

    // Insertar items
    for (const item of items) {
      await client.query(`
        INSERT INTO pedido_items (pedido_id, nombre_producto, cantidad, precio_unitario, subtotal, personalizaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        pedido.id,
        item.nombre,
        item.cantidad,
        item.precio_unitario,
        item.cantidad * item.precio_unitario,
        item.personalizaciones || null,
      ]);
    }

    await client.query('COMMIT');

    // Obtener pedido completo con items para el socket
    const completo = await pool.query(`
      SELECT p.*,
             c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
             l.nombre AS local_nombre,
             COALESCE(
               json_agg(json_build_object(
                 'id', pi.id, 'nombre_producto', pi.nombre_producto,
                 'cantidad', pi.cantidad, 'precio_unitario', pi.precio_unitario,
                 'subtotal', pi.subtotal, 'personalizaciones', pi.personalizaciones
               ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'
             ) AS items
      FROM pedidos p
      LEFT JOIN clientes c     ON p.cliente_id = c.id
      LEFT JOIN locales l      ON p.local_id   = l.id
      LEFT JOIN pedido_items pi ON p.id        = pi.pedido_id
      WHERE p.id = $1
      GROUP BY p.id, c.nombre, c.telefono, l.nombre
    `, [pedido.id]);

    req.app.get('io').emit('nuevo_pedido', completo.rows[0]);

    // Notificar al workflow N8N de NUEVOS
    notificarN8N(process.env.N8N_WEBHOOK_NUEVOS, completo.rows[0]).catch(console.error);

    res.json({ success: true, pedido_id: pedido.id, numero_pedido });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en webhook:', error);
    res.status(500).json({ error: 'Error al procesar el pedido', detalle: error.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/webhook/estado/:estado — GHL cambia el estado de un pedido
// Acepta: { pedido_id } o { numero_pedido }
// Estados válidos: en_cocina | listo | en_camino | entregado | cancelado
// ─────────────────────────────────────────────────────────────
router.post('/estado/:estado', webhookAuth, async (req, res) => {
  const { estado } = req.params;
  const { pedido_id, numero_pedido, ghl_contact_id, Nombre_cliente, nombre_cliente } = req.body;

  const estadosValidos = ['en_cocina', 'listo', 'en_camino', 'entregado', 'cancelado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${estadosValidos.join(', ')}` });
  }

  try {
    let rows;

    if (pedido_id) {
      // Buscar por ID directo
      ({ rows } = await pool.query(
        `UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [estado, pedido_id]
      ));
    } else if (numero_pedido) {
      // Buscar por número de pedido (ej: ER-0142)
      ({ rows } = await pool.query(
        `UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE numero_pedido = $2 RETURNING *`,
        [estado, numero_pedido]
      ));
    } else if (ghl_contact_id) {
      // Buscar el pedido activo más reciente de este contacto de GHL
      ({ rows } = await pool.query(
        `UPDATE pedidos SET estado = $1, updated_at = NOW()
         WHERE id = (
           SELECT id FROM pedidos
           WHERE ghl_contact_id = $2
             AND estado NOT IN ('entregado', 'cancelado')
           ORDER BY created_at DESC
           LIMIT 1
         ) RETURNING *`,
        [estado, ghl_contact_id]
      ));
    } else {
      return res.status(400).json({
        error: 'Se requiere al menos uno de: pedido_id, numero_pedido o ghl_contact_id'
      });
    }

    if (!rows || !rows[0]) {
      return res.status(404).json({ error: 'Pedido activo no encontrado para ese contacto' });
    }

    req.app.get('io').emit('pedido_actualizado', rows[0]);

    res.json({
      success:       true,
      pedido_id:     rows[0].id,
      numero_pedido: rows[0].numero_pedido,
      estado,
      cliente:       Nombre_cliente || nombre_cliente || null,
    });
  } catch (error) {
    console.error('Error al cambiar estado desde GHL:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

async function notificarN8N(url, pedido) {
  if (!url) return;
  const axios = require('axios');
  await axios.post(url, {
    pedido_id:           pedido.id,
    numero_pedido:       pedido.numero_pedido,
    estado:              pedido.estado,
    tipo:                pedido.tipo,
    canal:               pedido.canal,
    cliente_nombre:      pedido.cliente_nombre,
    cliente_telefono:    pedido.cliente_telefono,
    direccion_entrega:   pedido.direccion_entrega,
    total:               pedido.total,
    metodo_pago:         pedido.metodo_pago,
    mp_link:             pedido.mp_link,
    tiempo_estimado:     pedido.tiempo_estimado,
    ghl_contact_id:      pedido.ghl_contact_id,
    ghl_conversation_id: pedido.ghl_conversation_id,
    items:               pedido.items || [],
  }, { timeout: 8000 });
}

module.exports = router;
