import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { usuario } = useAuth();
  const socketRef = useRef(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!usuario) return;

    const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConectado(true);
      if (usuario.local_id) {
        socket.emit('unirse_local', usuario.local_id);
      }
    });

    socket.on('disconnect', () => setConectado(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
    };
  }, [usuario]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, conectado }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
