import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LogoTheBox from '../components/LogoTheBox';

function Reloj() {
  const [hora, setHora] = useState('');
  const [fecha, setFecha] = useState('');
  useEffect(() => {
    const tick = () => {
      const ahora = new Date();
      setHora(ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const f = ahora.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      setFecha(f.toLowerCase().replace(/^\w/, c => c.toUpperCase()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <div style={{ fontSize: 64, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--primary)', lineHeight: 1 }}>{hora}</div>
      <div style={{ fontSize: 16, color: 'var(--text-2)', marginTop: 8, textTransform: 'capitalize' }}>{fecha}</div>
    </div>
  );
}

function formatHora(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatFecha(f) {
  if (!f) return '—';
  // Puede venir como "2026-06-01" o como ISO completo
  const str = String(f).substring(0, 10);
  const [y, m, d] = str.split('-');
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(fecha.getTime())) return str;
  return fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatHoras(h) {
  if (h == null) return '—';
  const hs = Math.floor(h);
  const min = Math.round((h - hs) * 60);
  return `${hs}h ${String(min).padStart(2, '0')}m`;
}

export default function Fichar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null); // registro de hoy
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fichando, setFichando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok'|'error', texto }

  const cargar = async () => {
    try {
      const [est, hist] = await Promise.all([
        api.get('/horarios/estado-hoy'),
        api.get('/horarios/mio'),
      ]);
      setEstado(est);
      setHistorial(hist);
    } catch (err) {
      console.error('Error al cargar fichar:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleFichar = async () => {
    setFichando(true);
    setMensaje(null);
    try {
      const { accion, registro } = await api.post('/horarios/fichar', {});
      setEstado(registro);
      await cargar();
      setMensaje({
        tipo: 'ok',
        texto: accion === 'entrada'
          ? `✅ Entrada registrada a las ${formatHora(registro.hora_entrada)}`
          : `✅ Salida registrada a las ${formatHora(registro.hora_salida)}`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setFichando(false);
    }
  };

  const handleSalir = async () => {
    await logout();
    navigate('/login');
  };

  const yaEntro  = estado?.hora_entrada != null;
  const yaSalio  = estado?.hora_salida != null;
  const turnoOk  = yaEntro && yaSalio;

  if (cargando) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header mínimo */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <LogoTheBox height={32} showText={false} />
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Sistema de Fichaje</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>👤 {usuario?.nombre} {usuario?.apellido}</span>
        <button className="btn-logout" onClick={handleSalir}>Salir</button>
      </header>

      {/* Contenido */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>

        <Reloj />

        {/* Tarjeta de fichaje */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 480, textAlign: 'center', marginBottom: 40 }}>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Hola, {usuario?.nombre} 👋
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
            {!yaEntro && 'Todavía no registraste tu entrada de hoy.'}
            {yaEntro && !yaSalio && `Entraste a las ${formatHora(estado.hora_entrada)}`}
            {turnoOk && `Turno completado · ${formatHora(estado.hora_entrada)} → ${formatHora(estado.hora_salida)}`}
          </p>

          {/* Estado de hoy */}
          {yaEntro && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Entrada</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatHora(estado.hora_entrada)}</div>
              </div>
              {yaSalio && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Salida</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{formatHora(estado.hora_salida)}</div>
                </div>
              )}
            </div>
          )}

          {/* Mensaje de confirmación */}
          {mensaje && (
            <div style={{
              padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, fontWeight: 600,
              background: mensaje.tipo === 'ok' ? 'rgba(45,198,83,0.15)' : 'rgba(255,59,48,0.15)',
              color: mensaje.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${mensaje.tipo === 'ok' ? 'rgba(45,198,83,0.3)' : 'rgba(255,59,48,0.3)'}`,
            }}>
              {mensaje.texto}
            </div>
          )}

          {/* Botón principal */}
          {!turnoOk ? (
            <button
              className="btn btn-primary btn-full"
              style={{ fontSize: 18, padding: '18px 0', borderRadius: 12 }}
              onClick={handleFichar}
              disabled={fichando}
            >
              {fichando ? 'Registrando...' : !yaEntro ? '🟢 Registrar Entrada' : '🔴 Registrar Salida'}
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'rgba(45,198,83,0.1)', border: '1px solid rgba(45,198,83,0.3)', borderRadius: 10, color: 'var(--green)', fontWeight: 700 }}>
              ✅ Turno del día completado
            </div>
          )}
        </div>

        {/* Historial personal */}
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-2)', marginBottom: 12 }}>
            Mi historial de asistencia
          </div>
          <div className="tabla-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)' }}>Sin registros aún</td></tr>
                ) : historial.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{formatFecha(h.fecha)}</td>
                    <td style={{ color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatHora(h.hora_entrada)}</td>
                    <td style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{formatHora(h.hora_salida)}</td>
                    <td style={{ color: h.horas_trabajadas ? 'var(--primary)' : 'var(--text-3)', fontWeight: 600 }}>{formatHoras(h.horas_trabajadas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
