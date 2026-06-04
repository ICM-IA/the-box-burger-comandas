import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

export default function Caja({ localId }) {
  const [datos, setDatos] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const params = localId ? `?local_id=${localId}` : '';
      const [d, h] = await Promise.all([
        api.get(`/caja${params}`),
        api.get(`/caja/historial${params}`),
      ]);
      setDatos(d);
      setHistorial(h);
    } catch (err) {
      console.error('Error al cargar caja:', err);
    } finally {
      setCargando(false);
    }
  }, [localId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Refrescar cada 30 segundos
  useEffect(() => {
    const id = setInterval(cargar, 30000);
    return () => clearInterval(id);
  }, [cargar]);

  const handleCerrarCaja = async () => {
    if (!localId) { alert('Seleccioná un local para cerrar la caja'); return; }
    if (!confirm('¿Confirmar el cierre de caja de hoy?')) return;
    setCerrando(true);
    try {
      await api.post('/caja/cerrar', { local_id: localId });
      await cargar();
      alert('Caja cerrada correctamente');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setCerrando(false);
    }
  };

  if (cargando) return <div className="loading-center"><div className="spinner" /></div>;
  if (!datos) return <div className="empty"><div className="empty-text">Error al cargar datos</div></div>;

  const { resumen, pedidos, caja_cerrada } = datos;

  const tarjetas = [
    { label: 'Total pedidos',  value: resumen.total_pedidos,   cls: '' },
    { label: 'Total ventas',   value: fmt(resumen.total_ventas), cls: 'green' },
    { label: 'Efectivo',       value: fmt(resumen.total_efectivo), cls: '' },
    { label: 'MercadoPago',    value: fmt(resumen.total_mp), cls: '' },
    { label: 'Transferencia',  value: fmt(resumen.total_transferencia), cls: '' },
    { label: 'Tarjeta',        value: fmt(resumen.total_tarjeta), cls: '' },
    { label: 'QR',             value: fmt(resumen.total_qr), cls: '' },
    { label: 'WhatsApp',       value: `${resumen.pedidos_whatsapp} pedidos`, cls: '' },
    { label: 'Delivery',       value: `${resumen.pedidos_delivery} pedidos`, cls: '' },
    { label: 'Retiro',         value: `${resumen.pedidos_retiro} pedidos`, cls: '' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>
          💰 Caja del día
          {caja_cerrada && <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 10 }}>— Cerrada</span>}
        </h2>
        <button onClick={cargar} className="btn btn-secondary btn-sm">↺ Actualizar</button>
        <div style={{ marginLeft: 'auto' }}>
          {!caja_cerrada ? (
            <button className="btn btn-primary" onClick={handleCerrarCaja} disabled={cerrando}>
              {cerrando ? 'Cerrando...' : '🔒 Cerrar Caja'}
            </button>
          ) : (
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>✅ Caja cerrada</span>
          )}
        </div>
      </div>

      <div className="resumen-grid">
        {tarjetas.map((t) => (
          <div key={t.label} className="resumen-card">
            <div className="resumen-card-label">{t.label}</div>
            <div className={`resumen-card-value${t.cls ? ` ${t.cls}` : ''}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Pedidos del día ({pedidos.length})</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setVerHistorial(!verHistorial)}>
          {verHistorial ? 'Ver hoy' : '📋 Ver historial'}
        </button>
      </div>

      {!verHistorial ? (
        <div className="tabla-wrapper">
          <table>
            <thead>
              <tr>
                <th>Número</th><th>Cliente</th><th>Tipo</th><th>Canal</th>
                <th>Pago</th><th>Total</th><th>Estado</th><th>Hora</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Sin pedidos hoy</td></tr>
              ) : pedidos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.numero_pedido}</strong></td>
                  <td>{p.cliente_nombre || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.tipo}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.canal}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.metodo_pago || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(p.total)}</td>
                  <td><span className={`estado-badge estado-${p.estado}`}>{p.estado.replace('_', ' ')}</span></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    {new Date(p.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tabla-wrapper">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Local</th><th>Pedidos</th><th>Ventas</th><th>Efectivo</th><th>MP</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Sin historial</td></tr>
              ) : historial.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.fecha).toLocaleDateString('es-AR')}</td>
                  <td>{c.local_nombre}</td>
                  <td>{c.total_pedidos}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(c.total_ventas)}</td>
                  <td>{fmt(c.total_efectivo)}</td>
                  <td>{fmt(c.total_mp)}</td>
                  <td>{c.cerrada ? '✅ Cerrada' : '🔓 Abierta'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
