import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function formatHora(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

const LOCALES = [
  { id: 1, nombre: 'Entre Ríos' },
  { id: 2, nombre: 'Edison' },
];

export default function Fichaje() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [localId, setLocalId] = useState(1);
  const [empleados, setEmpleados] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [modal, setModal] = useState(null);
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Setear localId según el usuario logueado
  useEffect(() => {
    if (!esAdmin && usuario?.local_id) {
      setLocalId(usuario.local_id);
    }
  }, [usuario?.local_id]);

  // Cargar empleados y horarios cada vez que cambia localId
  useEffect(() => {
    fetchData();
  }, [localId]);

  async function fetchData() {
    try {
      const fecha = new Date().toISOString().split('T')[0];
      const [emps, hors] = await Promise.all([
        api.get(`/usuarios?local_id=${localId}`),
        api.get(`/horarios?fecha=${fecha}&local_id=${localId}`),
      ]);
      setEmpleados(emps.filter(e => e.rol === 'empleado'));
      setHorarios(hors);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  function horarioDeHoy(userId) {
    return horarios.find(h => h.usuario_id === userId);
  }

  function abrirModal(emp, accion) {
    setModal({ emp, accion });
    setPassword('');
    setVerPass(false);
    setMensaje(null);
  }

  function cerrarModal() {
    setModal(null);
    setPassword('');
    setVerPass(false);
    setMensaje(null);
  }

  async function handleFichar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const res = await api.post('/horarios/fichar-empleado', {
        email: modal.emp.email,
        password,
        accion: modal.accion,
      });
      setMensaje({ tipo: 'ok', texto: `✅ ${modal.accion === 'entrada' ? 'Entrada' : 'Salida'} registrada para ${res.nombre}` });
      await fetchData();
      setTimeout(() => cerrarModal(), 1500);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>🕐 Fichaje</h2>

        {esAdmin ? (
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
        ) : (
          <span style={{ marginLeft: 8, fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
            {LOCALES.find(l => l.id === localId)?.nombre}
          </span>
        )}

        <button className="btn btn-secondary btn-sm" onClick={fetchData} style={{ marginLeft: 'auto' }}>
          ↺ Actualizar
        </button>
      </div>

      {/* Lista de empleados */}
      <div style={{ display: 'grid', gap: 12 }}>
        {empleados.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
            No hay empleados en este local
          </div>
        )}
        {empleados.map(emp => {
          const hoy = horarioDeHoy(emp.id);
          const entro = hoy?.hora_entrada != null;
          const salio = hoy?.hora_salida != null;

          return (
            <div key={emp.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--primary)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>
                {emp.nombre[0]}{emp.apellido?.[0] || ''}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.nombre} {emp.apellido}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {entro ? (
                    <span style={{ color: 'var(--green)' }}>
                      Entró {formatHora(hoy.hora_entrada)}
                      {salio ? ` · Salió ${formatHora(hoy.hora_salida)}` : ' · Trabajando'}
                    </span>
                  ) : (
                    <span>Sin fichar hoy</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!entro && (
                  <button className="btn btn-primary btn-sm" onClick={() => abrirModal(emp, 'entrada')}>
                    🟢 Fichar entrada
                  </button>
                )}
                {entro && !salio && (
                  <button className="btn btn-danger btn-sm" onClick={() => abrirModal(emp, 'salida')}>
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
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && cerrarModal()}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">
              {modal.accion === 'entrada' ? '🟢 Fichar entrada' : '🔴 Fichar salida'}
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
              {modal.emp.nombre} {modal.emp.apellido} — ingresá tu contraseña para confirmar
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
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    type={verPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass(!verPass)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-3)', fontSize: 18, padding: 0, lineHeight: 1,
                    }}
                  >
                    {verPass ? '🙈' : '👁️'}
                  </button>
                </div>
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
