import { useState, useEffect } from 'react';
import { api } from '../lib/api';

function formatHora(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

const LOCALES = [
  { id: 1, nombre: 'Entre Ríos' },
  { id: 2, nombre: 'Edison' },
];

export default function Fichaje() {
  const [empleados, setEmpleados] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [localId, setLocalId] = useState(1);
  const [modal, setModal] = useState(null); // { empleado, accion }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargar = async () => {
    try {
      const [emps, hors] = await Promise.all([
        api.get('/usuarios'),
        api.get(`/horarios?fecha=${new Date().toISOString().split('T')[0]}`),
      ]);
      // Filtrar solo roles empleado, cocina, cajero, repartidor (no admin)
      setEmpleados(emps.filter(e => e.rol !== 'admin'));
      setHorarios(hors);
    } catch (err) {
      console.error('Error al cargar:', err);
    }
  };

  useEffect(() => { cargar(); }, []);

  const empleadosFiltrados = localId
    ? empleados.filter(e => e.local_id === localId)
    : empleados;

  const abrirModal = (empleado, accion) => {
    setModal({ empleado, accion });
    setEmail(empleado.email);
    setPassword('');
    setMensaje(null);
  };

  const cerrarModal = () => {
    setModal(null);
    setEmail('');
    setPassword('');
    setMensaje(null);
  };

  const handleFichar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const res = await api.post('/horarios/fichar-empleado', {
        email,
        password,
        accion: modal.accion,
      });
      setMensaje({ tipo: 'ok', texto: `✅ ${modal.accion === 'entrada' ? 'Entrada' : 'Salida'} registrada para ${res.nombre}` });
      await cargar();
      setTimeout(() => cerrarModal(), 1500);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  };

  const horarioDeHoy = (userId) => horarios.find(h => h.usuario_id === userId);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>🕐 Fichaje</h2>
        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
          {LOCALES.map(l => (
            <button
              key={l.id}
              onClick={() => setLocalId(l.id)}
              className={localId === l.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {l.nombre}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginLeft: 'auto' }}>↺ Actualizar</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {empleadosFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>No hay empleados en este local</div>
        )}
        {empleadosFiltrados.map(emp => {
          const hoy = horarioDeHoy(emp.id);
          const entro = hoy?.hora_entrada != null;
          const salio = hoy?.hora_salida != null;

          return (
            <div key={emp.id} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--primary)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>
                {emp.nombre[0]}{emp.apellido[0]}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.nombre} {emp.apellido}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {emp.local_nombre || 'Sin local'} ·{' '}
                  {entro ? (
                    <span style={{ color: 'var(--green)' }}>
                      Entró {formatHora(hoy.hora_entrada)}
                      {salio ? ` · Salió ${formatHora(hoy.hora_salida)}` : ' · Trabajando'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-3)' }}>Sin fichar hoy</span>
                  )}
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!entro && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => abrirModal(emp, 'entrada')}
                  >
                    🟢 Fichar entrada
                  </button>
                )}
                {entro && !salio && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => abrirModal(emp, 'salida')}
                  >
                    🔴 Fichar salida
                  </button>
                )}
                {salio && (
                  <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ Turno completo</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && cerrarModal()}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">
              {modal.accion === 'entrada' ? '🟢 Fichar entrada' : '🔴 Fichar salida'}
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
              {modal.empleado.nombre} {modal.empleado.apellido} — ingresá tu contraseña para confirmar
            </p>

            {mensaje && (
              <div style={{
                padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
                background: mensaje.tipo === 'ok' ? 'rgba(45,198,83,0.15)' : 'rgba(255,59,48,0.15)',
                color: mensaje.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${mensaje.tipo === 'ok' ? 'rgba(45,198,83,0.3)' : 'rgba(255,59,48,0.3)'}`,
              }}>
                {mensaje.texto}
              </div>
            )}

            <form onSubmit={handleFichar}>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
                <button
                  type="submit"
                  className={`btn ${modal.accion === 'entrada' ? 'btn-primary' : 'btn-danger'}`}
                  disabled={cargando}
                >
                  {cargando ? 'Registrando...' : 'Cargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
