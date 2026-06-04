import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';

function TiempoSalida({ fecha }) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    const actualizar = () => {
      const ms  = Date.now() - new Date(fecha).getTime();
      const min = Math.floor(ms / 60000);
      setTexto(`${min} min`);
    };
    actualizar();
    const id = setInterval(actualizar, 30000);
    return () => clearInterval(id);
  }, [fecha]);
  return <span style={{ color: 'var(--text-2)', fontSize: 12 }}>En camino hace {texto}</span>;
}

function DeliveryCard({ pedido, repartidores, onAccion, onRepartidor }) {
  return (
    <div className="delivery-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>{pedido.numero_pedido}</span>
        <span className={`estado-badge estado-${pedido.estado}`}>{pedido.estado.replace('_', ' ')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
          {pedido.local_nombre}
        </span>
      </div>

      <div className="delivery-info">
        <div className="delivery-info-item">
          <div className="delivery-info-label">Cliente</div>
          <div className="delivery-info-value">{pedido.cliente_nombre || '—'}</div>
        </div>
        <div className="delivery-info-item">
          <div className="delivery-info-label">Teléfono</div>
          <div className="delivery-info-value">{pedido.cliente_telefono || '—'}</div>
        </div>
        <div className="delivery-info-item" style={{ gridColumn: '1 / -1' }}>
          <div className="delivery-info-label">Dirección</div>
          <div className="delivery-info-value">{pedido.direccion_entrega || '—'}</div>
        </div>
        <div className="delivery-info-item">
          <div className="delivery-info-label">Distancia</div>
          <div className="delivery-info-value">{pedido.distancia_km ? `${pedido.distancia_km} km` : '—'}</div>
        </div>
        <div className="delivery-info-item">
          <div className="delivery-info-label">Costo envío</div>
          <div className="delivery-info-value">${Number(pedido.costo_envio || 0).toLocaleString('es-AR')}</div>
        </div>
        <div className="delivery-info-item">
          <div className="delivery-info-label">Total</div>
          <div className="delivery-info-value" style={{ color: 'var(--green)' }}>
            ${Number(pedido.total).toLocaleString('es-AR')}
          </div>
        </div>
        <div className="delivery-info-item">
          <div className="delivery-info-label">Pago</div>
          <div className="delivery-info-value" style={{ textTransform: 'capitalize' }}>
            {pedido.metodo_pago || '—'}
            {pedido.mp_pagado && ' ✅'}
          </div>
        </div>
      </div>

      {pedido.notas && (
        <div className="pedido-notas">📝 {pedido.notas}</div>
      )}

      {pedido.estado === 'listo' && (
        <>
          <select
            className="select-repartidor"
            value={pedido.repartidor_id || ''}
            onChange={(e) => onRepartidor(pedido.id, e.target.value || null)}
          >
            <option value="">— Asignar repartidor —</option>
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre} {r.apellido}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onAccion(pedido.id, 'en_camino')}>
              🛵 Salió
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onAccion(pedido.id, 'cancelado')}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {pedido.estado === 'en_camino' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TiempoSalida fecha={pedido.updated_at} />
          <button className="btn btn-success" style={{ flex: 1 }} onClick={() => onAccion(pedido.id, 'entregado')}>
            ✅ Entregado
          </button>
        </div>
      )}
    </div>
  );
}

export default function Delivery({ localId }) {
  const [pedidos, setPedidos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { socket } = useSocket();

  const cargar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tipo: 'delivery', estado: 'listo,en_camino' });
      if (localId) params.append('local_id', localId);
      const [pedidosData, repsData] = await Promise.all([
        api.get(`/pedidos?${params}`),
        api.get(`/usuarios?rol=repartidor`),
      ]);
      setPedidos(pedidosData);
      setRepartidores(repsData);
    } catch (err) {
      console.error('Error al cargar delivery:', err);
    } finally {
      setCargando(false);
    }
  }, [localId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!socket) return;
    const onActualizado = (pedido) => {
      setPedidos((prev) => {
        const activos = ['listo', 'en_camino'];
        if (!activos.includes(pedido.estado)) return prev.filter((p) => p.id !== pedido.id);
        const existe = prev.find((p) => p.id === pedido.id);
        if (existe) return prev.map((p) => p.id === pedido.id ? { ...p, ...pedido } : p);
        if (pedido.tipo === 'delivery') return [pedido, ...prev];
        return prev;
      });
    };
    socket.on('pedido_actualizado', onActualizado);
    return () => socket.off('pedido_actualizado', onActualizado);
  }, [socket]);

  const handleAccion = async (id, estado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado });
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const handleRepartidor = async (id, repartidor_id) => {
    try {
      await api.patch(`/pedidos/${id}/repartidor`, { repartidor_id });
      setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, repartidor_id } : p));
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  if (cargando) return <div className="loading-center"><div className="spinner" /></div>;

  const listos   = pedidos.filter((p) => p.estado === 'listo');
  const enCamino = pedidos.filter((p) => p.estado === 'en_camino');

  return (
    <div>
      <div className="delivery-grid">
        <div>
          <div className="section-title">🛵 Para salir ({listos.length})</div>
          {listos.length === 0 ? (
            <div className="empty"><div className="empty-icon">📦</div><div className="empty-text">Sin pedidos listos</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {listos.map((p) => (
                <DeliveryCard key={p.id} pedido={p} repartidores={repartidores} onAccion={handleAccion} onRepartidor={handleRepartidor} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="section-title">🔵 En camino ({enCamino.length})</div>
          {enCamino.length === 0 ? (
            <div className="empty"><div className="empty-icon">🛣️</div><div className="empty-text">Ningún pedido en camino</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {enCamino.map((p) => (
                <DeliveryCard key={p.id} pedido={p} repartidores={repartidores} onAccion={handleAccion} onRepartidor={handleRepartidor} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
