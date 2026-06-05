import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const ROL_LABEL = { admin: 'Administrador', cocina: 'Cocina', cajero: 'Cajero', repartidor: 'Repartidor', empleado: 'Empleado' };
const FORM_VACIO = { nombre: '', apellido: '', email: '', password: '', rol: 'empleado', local_id: 1, activo: true };
const MODULOS = [
  { key: 'comandas', label: '📋 Comandas' },
  { key: 'delivery', label: '🚚 Delivery' },
  { key: 'caja',     label: '💼 Caja' },
  { key: 'fichaje',  label: '🕐 Fichaje' },
];
const LOCAL_FORM_VACIO = { nombre: '', direccion: '', email: '', password: '', permisos: ['comandas', 'delivery', 'caja', 'fichaje'] };

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalLocal, setModalLocal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [formLocal, setFormLocal] = useState(LOCAL_FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorLocal, setErrorLocal] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0]);

  const cargar = async (fecha = null) => {
    try {
      const fechaParam = fecha || fechaSeleccionada;
      const [emps, hors, locs] = await Promise.all([
        api.get('/usuarios'),
        api.get(`/horarios?fecha=${fechaParam}`),
        api.get('/locales'),
      ]);
      setEmpleados(emps);
      setHorarios(hors);
      setLocales(locs);
      if (fecha) setFechaSeleccionada(fecha);
    } catch (err) {
      console.error('Error al cargar empleados:', err);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarLocal = async (e) => {
    e.preventDefault();
    setErrorLocal('');
    setGuardando(true);
    try {
      await api.post('/locales', formLocal);
      await cargar();
      setModalLocal(false);
      setFormLocal(LOCAL_FORM_VACIO);
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const togglePermiso = (key) => {
    setFormLocal(f => ({
      ...f,
      permisos: f.permisos.includes(key)
        ? f.permisos.filter(p => p !== key)
        : [...f.permisos, key],
    }));
  };

  useEffect(() => { cargar(); }, []);

  const abrirModal = (emp = null) => {
    if (emp) {
      setForm({ nombre: emp.nombre, apellido: emp.apellido, email: emp.email, password: '', rol: emp.rol, local_id: emp.local_id || 1, activo: emp.activo });
      setEditId(emp.id);
    } else {
      setForm(FORM_VACIO);
      setEditId(null);
    }
    setError('');
    setModal(true);
  };

  const cerrarModal = () => { setModal(false); setError(''); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;

      if (editId) {
        await api.patch(`/usuarios/${editId}`, payload);
      } else {
        if (!payload.password) { setError('La contraseña es requerida'); setGuardando(false); return; }
        await api.post('/usuarios', payload);
      }

      await cargar();
      cerrarModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar definitivamente a ${nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/usuarios/${id}`);
      await cargar();
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const horarioDeHoy = (userId) => horarios.find((h) => h.usuario_id === userId);

  if (cargando) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>👥 Empleados</h2>
        <button className="btn btn-primary" onClick={() => abrirModal()}>+ Nuevo empleado</button>
        <button className="btn btn-secondary" onClick={() => { setFormLocal(LOCAL_FORM_VACIO); setErrorLocal(''); setModalLocal(true); }}>🏠 Agregar local</button>
        <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginLeft: 'auto' }}>↺ Actualizar</button>
      </div>

      {/* Horarios del día */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Asistencia ({horarios.length} registrados)</div>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={(e) => cargar(e.target.value)}
          className="form-control"
          style={{ width: 150, marginBottom: 0 }}
        />
      </div>
      <div className="tabla-wrapper" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr><th>Empleado</th><th>Rol</th><th>Local</th><th>Entrada</th><th>Salida</th></tr>
          </thead>
          <tbody>
            {horarios.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Sin registros hoy</td></tr>
            ) : horarios.map((h) => (
              <tr key={h.id}>
                <td><strong>{h.nombre} {h.apellido}</strong></td>
                <td>{ROL_LABEL[h.rol] || h.rol}</td>
                <td>{h.local_nombre || '—'}</td>
                <td>{h.hora_entrada ? new Date(h.hora_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td>{h.hora_salida ? new Date(h.hora_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--green)' }}>Activo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista de empleados */}
      <div className="section-title" style={{ marginBottom: 12 }}>Lista de empleados ({empleados.length})</div>
      <div className="tabla-wrapper">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Local</th><th>Estado</th><th>Hoy</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {empleados.map((emp) => {
              const hoy = horarioDeHoy(emp.id);
              return (
                <tr key={emp.id}>
                  <td><strong>{emp.nombre} {emp.apellido}</strong></td>
                  <td style={{ color: 'var(--text-2)' }}>{emp.email}</td>
                  <td>{ROL_LABEL[emp.rol] || emp.rol}</td>
                  <td>{emp.local_nombre || '—'}</td>
                  <td>
                    <span style={{ color: emp.activo ? 'var(--green)' : 'var(--text-3)' }}>
                      {emp.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {hoy ? (hoy.hora_salida ? 'Salió' : '✅ Presente') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirModal(emp)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(emp.id, `${emp.nombre} ${emp.apellido}`)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && cerrarModal()}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Editar empleado' : 'Nuevo empleado'}</div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleGuardar}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre</label>
                  <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Apellido</label>
                  <input className="form-control" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                <input className="form-control" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? '••••••••' : ''} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Rol</label>
                  <select className="form-control" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                    {Object.entries(ROL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Local asignado</label>
                  <select className="form-control" value={form.local_id} onChange={(e) => setForm({ ...form, local_id: Number(e.target.value) })}>
                    {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Local */}
      {modalLocal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalLocal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-title">🏠 Agregar local</div>
            {errorLocal && <div className="login-error">{errorLocal}</div>}
            <form onSubmit={handleGuardarLocal}>
              <div className="form-group">
                <label>Nombre del local</label>
                <input className="form-control" value={formLocal.nombre} onChange={e => setFormLocal({...formLocal, nombre: e.target.value})} placeholder="Ej: Av. Colón" required />
              </div>
              <div className="form-group">
                <label>Dirección (opcional)</label>
                <input className="form-control" value={formLocal.direccion} onChange={e => setFormLocal({...formLocal, direccion: e.target.value})} placeholder="Ej: Av. Colón 1234" />
              </div>
              <div className="form-group">
                <label>Email de acceso</label>
                <input className="form-control" type="email" value={formLocal.email} onChange={e => setFormLocal({...formLocal, email: e.target.value})} placeholder="colon@theboxburger.com" required />
              </div>
              <div className="form-group">
                <label>Contraseña de acceso</label>
                <input className="form-control" type="password" value={formLocal.password} onChange={e => setFormLocal({...formLocal, password: e.target.value})} placeholder="••••••••" required />
              </div>
              <div className="form-group">
                <label>Módulos que puede ver</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  {MODULOS.map(m => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: `1px solid ${formLocal.permisos.includes(m.key) ? 'var(--primary)' : 'var(--border)'}`, background: formLocal.permisos.includes(m.key) ? 'rgba(255,214,10,0.1)' : 'transparent' }}>
                      <input
                        type="checkbox"
                        checked={formLocal.permisos.includes(m.key)}
                        onChange={() => togglePermiso(m.key)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: 14 }}>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalLocal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Creando...' : 'Crear local'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
