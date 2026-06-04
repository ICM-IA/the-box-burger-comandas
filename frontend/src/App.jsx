import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Fichar from './pages/Fichar';
import Comandas from './pages/Comandas';
import Delivery from './pages/Delivery';
import Caja from './pages/Caja';
import Empleados from './pages/Empleados';

function Layout({ children }) {
  const [localId, setLocalId] = useState(null);
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <Header localId={localId} onLocalChange={setLocalId} />
        <main className="page">
          {typeof children === 'function' ? children({ localId }) : children}
        </main>
      </div>
    </div>
  );
}

// Redirige al inicio correcto según el rol
function HomeRedirect() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol === 'empleado') return <Navigate to="/fichar" replace />;
  if (usuario.rol === 'cajero')   return <Navigate to="/caja" replace />;
  if (usuario.rol === 'repartidor') return <Navigate to="/delivery" replace />;
  return <Navigate to="/comandas" replace />;
}

export default function App() {
  const { usuario } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={usuario ? <HomeRedirect /> : <Login />} />

      {/* Página exclusiva para empleados */}
      <Route path="/fichar" element={
        <ProtectedRoute roles={['empleado']}>
          <Fichar />
        </ProtectedRoute>
      } />

      {/* Páginas del sistema operativo */}
      <Route path="/comandas" element={
        <ProtectedRoute roles={['admin', 'cocina']}>
          <Layout>{({ localId }) => <Comandas localId={localId} />}</Layout>
        </ProtectedRoute>
      } />

      <Route path="/delivery" element={
        <ProtectedRoute roles={['admin', 'repartidor', 'cajero']}>
          <Layout>{({ localId }) => <Delivery localId={localId} />}</Layout>
        </ProtectedRoute>
      } />

      <Route path="/caja" element={
        <ProtectedRoute roles={['admin', 'cajero']}>
          <Layout>{({ localId }) => <Caja localId={localId} />}</Layout>
        </ProtectedRoute>
      } />

      <Route path="/empleados" element={
        <ProtectedRoute roles={['admin']}>
          <Layout><Empleados /></Layout>
        </ProtectedRoute>
      } />

      {/* Raíz → redirige según rol */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
