import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

const LOCALES = [
  { id: 1, nombre: 'Entre Ríos' },
  { id: 2, nombre: 'Edison' },
];

export default function Header({ localId, onLocalChange }) {
  const { usuario, logout } = useAuth();
  const { conectado } = useSocket();
  const navigate = useNavigate();
  const [hora, setHora] = useState('');

  useEffect(() => {
    const tick = () => {
      setHora(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-local">
        🏠
        <select
          value={localId || ''}
          onChange={(e) => onLocalChange && onLocalChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Todos los locales</option>
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>
      </div>

      <div className="header-spacer" />

      <div className="header-clock">{hora}</div>

      <div className="header-user">
        <span className={conectado ? 'dot-connected' : 'dot-disconnected'} title={conectado ? 'Conectado' : 'Desconectado'} />
        <strong>{usuario?.nombre}</strong>
        <span>({usuario?.rol})</span>
      </div>

      <button className="btn-logout" onClick={handleLogout}>Salir</button>
    </header>
  );
}
