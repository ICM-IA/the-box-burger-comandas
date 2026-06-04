import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';

const COLUMNAS = [
  { estado: 'nuevo',    label: '🔴 Nuevos',    color: '#E63946' },
  { estado: 'en_cocina', label: '🟡 En Cocina', color: '#f4a261' },
  { estado: 'listo',    label: '🟢 Listos',    color: '#2dc653' },
];

function reproducirAlerta() {
  try {
    const ctx = new AudioContext();
    [0, 0.15, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    });
  } catch { /* ignorar si el navegador bloquea */ }
}

function calcularMinutos(fecha) {
  return (Date.now() - new Date(fecha).getTime()) / 60000;
}

function TiempoTranscurrido({ fecha, estado }) {
  const [texto, setTexto] = useState('');
  const [clase, setClase] = useState('');

  useEffect(() => {
    const actualizar = () => {
      const ms  = Date.now() - new Date(fecha).getTime();
      const min = Math.floor(ms / 60000);
      const seg = Math.floor((ms % 60000) / 1000);
      setTexto(`${min}:${String(seg).padStart(2, '0')}`);
      if (estado === 'en_cocina') {
        setClase(min >= 25 ? 'urgente' : min >= 15 ? 'advertencia' : '');
      } else {
        setClase('');
      }
    };
    actualizar();
    const id = setInterval(actualizar, 1000);
    return () => clearInterval(id);
  }, [fecha, estado]);

  return <span className={`pedido-timer${clase ? ` ${clase}` : ''}`}>⏱ {texto}</span>;
}

function PedidoCard({ pedido, onAccion, onEliminar }) {
  const mins = calcularMinutos(pedido.created_at);
  let cardClass = 'pedido-card';
  if (pedido.estado === 'nuevo') cardClass += ' nuevo';
  else if (pedido.estado === 'en_cocina' && mins >= 25) cardClass += ' urgente';
  else if (pedido.estado === 'en_cocina' && mins >= 15) cardClass += ' advertencia';

  const ACCIONES = {
    nuevo:     { label: '👨‍🍳 Tomar Pedido', fn: 'en_cocina', cls: 'btn-warning' },
    en_cocina: { label: '✅ Listo',         fn: 'listo',    cls: 'btn-success' },
    listo:     pedido.tipo === 'delivery'
      ? { label: '🛵 En Camino', fn: 'en_camino', cls: 'btn-primary' }
      : { label: '✅ Entregado', fn: 'entregado', cls: 'btn-success' },
  };

  const accion = ACCIONES[pedido.estado];

  return (
    <div className={cardClass}>
      <div className="pedido-header">
        <span className="pedido-numero">{pedido.numero_pedido}</span>
        <span className="pedido-tipo" title={pedido.tipo === 'delivery' ? 'Delivery' : 'Retiro'}>
          {pedido.tipo === 'delivery' ? '🛵' : '🏃'}
        </span>
        <TiempoTranscurrido fecha={pedido.created_at} estado={pedido.estado} />
        <button
          onClick={() => onEliminar(pedido.id, pedido.numero_pedido)}
          title="Eliminar pedido"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 16, padding: '2px 4px',
            lineHeight: 1, borderRadius: 4, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--red)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-3)'}
        >
          🗑
        </button>
      </div>

      {pedido.cliente_nombre && (
        <div>
          <div className="pedido-cliente">👤 {pedido.cliente_nombre}</div>
          {pedido.tipo === 'delivery' && pedido.direccion_entrega && (
            <div className="pedido-dir">📍 {pedido.direccion_entrega}</div>
          )}
        </div>
      )}

      <div className="pedido-items">
        {(pedido.items || []).map((item, i) => (
          <div key={i} className="pedido-item">
            <span className="pedido-item-qty">{item.cantidad}×</span>
            <div>
              <div className="pedido-item-nombre">{item.nombre_producto}</div>
              {item.personalizaciones && (
                <div className="pedido-item-custom">→ {item.personalizaciones}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pedido.notas && <div className="pedido-notas">📝 {pedido.notas}</div>}

      <div className="pedido-footer">
        <span className={`pedido-tag ${pedido.metodo_pago === 'mercadopago' ? 'mp' : pedido.metodo_pago === 'efectivo' ? 'efectivo' : ''}`}>
          {pedido.metodo_pago || 'Sin método'}
        </span>
        <span className="pedido-tag">{pedido.canal}</span>
        {pedido.mp_link && (
          <a href={pedido.mp_link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue)' }}>
            Link MP ↗
          </a>
        )}
      </div>

      {accion && (
        <button
          className={`btn ${accion.cls} btn-full`}
          onClick={() => onAccion(pedido.id, accion.fn)}
        >
          {accion.label}
        </button>
      )}
    </div>
  );
}

export default function Comandas({ localId }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { socket } = useSocket();
  const primerCarga = useRef(true);

  const cargarPedidos = useCallback(async () => {
    try {
      const params = new URLSearchParams({ estado: 'nuevo,en_cocina,listo' });
      if (localId) params.append('local_id', localId);
      const data = await api.get(`/pedidos?${params}`);
      setPedidos(data);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    } finally {
      setCargando(false);
      primerCarga.current = false;
    }
  }, [localId]);

  useEffect(() => { cargarPedidos(); }, [cargarPedidos]);

  useEffect(() => {
    if (!socket) return;

    const onNuevo = (pedido) => {
      if (localId && pedido.local_id !== localId) return;
      setPedidos((prev) => [pedido, ...prev.filter((p) => p.id !== pedido.id)]);
      if (!primerCarga.current) reproducirAlerta();
    };

    const onActualizado = (pedido) => {
      setPedidos((prev) => {
        const activos = ['nuevo', 'en_cocina', 'listo'];
        if (!activos.includes(pedido.estado)) {
          return prev.filter((p) => p.id !== pedido.id);
        }
        const existe = prev.find((p) => p.id === pedido.id);
        if (existe) return prev.map((p) => p.id === pedido.id ? { ...p, ...pedido } : p);
        return prev;
      });
    };

    const onCancelado  = ({ id }) => setPedidos((prev) => prev.filter((p) => p.id !== id));
    const onEliminado  = ({ id }) => setPedidos((prev) => prev.filter((p) => p.id !== id));

    socket.on('nuevo_pedido',      onNuevo);
    socket.on('pedido_actualizado', onActualizado);
    socket.on('pedido_cancelado',   onCancelado);
    socket.on('pedido_eliminado',   onEliminado);

    return () => {
      socket.off('nuevo_pedido',      onNuevo);
      socket.off('pedido_actualizado', onActualizado);
      socket.off('pedido_cancelado',   onCancelado);
      socket.off('pedido_eliminado',   onEliminado);
    };
  }, [socket, localId]);

  const handleAccion = async (id, estado) => {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado });
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(null); // { id, numero }

  const handleEliminar = (id, numero) => {
    setConfirmDelete({ id, numero });
  };

  const confirmarEliminar = async (id) => {
    try {
      await api.delete(`/pedidos/${id}`);
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (cargando) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="kanban">
      {COLUMNAS.map((col) => {
        const lista = pedidos.filter((p) => p.estado === col.estado);
        return (
          <div key={col.estado} className="kanban-col">
            <div className="kanban-col-header" style={{ borderTop: `3px solid ${col.color}` }}>
              {col.label}
              <span className="badge">{lista.length}</span>
            </div>
            <div className="kanban-col-body">
              {lista.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🍽️</div>
                  <div className="empty-text">Sin pedidos</div>
                </div>
              ) : (
                lista.map((p) => (
                  <PedidoCard key={p.id} pedido={p} onAccion={handleAccion} onEliminar={handleEliminar} />
                ))
              )}
            </div>
          </div>
        );
      })}

      {/* Modal de confirmación para eliminar */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-1)' }}>¿Eliminar pedido?</h3>
            <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.5 }}>
              ¿Estás seguro de que querés eliminar el pedido <strong>{confirmDelete.numero}</strong>?<br />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Esta acción no se puede deshacer.</span>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: 'var(--red)', color: '#fff' }}
                onClick={() => confirmarEliminar(confirmDelete.id)}
              >
                🗑 Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
