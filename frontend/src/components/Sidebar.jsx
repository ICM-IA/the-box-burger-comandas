import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoTheBox from './LogoTheBox';

const IconComandas  = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h8M8 16h5"/></svg>;
const IconDelivery  = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M3 18H1V6h13v12m0-12h3l3 3v6h-6V6"/></svg>;
const IconCaja      = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const IconEmpleados = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconChevron   = ({ right }) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={right ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'}/></svg>;
const IconFichaje   = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const { usuario } = useAuth();

  const links = [
    { to: '/comandas',  icon: <IconComandas />,  label: 'Comandas',  roles: ['admin', 'cocina'] },
    { to: '/delivery',  icon: <IconDelivery />,  label: 'Delivery',  roles: ['admin', 'repartidor', 'cajero'] },
    { to: '/caja',      icon: <IconCaja />,      label: 'Caja',      roles: ['admin', 'cajero'] },
    { to: '/empleados', icon: <IconEmpleados />, label: 'Empleados', roles: ['admin'] },
    { to: '/fichaje',   icon: <IconFichaje />,   label: 'Fichaje',   roles: ['admin', 'cajero'] },
  ].filter((l) => l.roles.includes(usuario?.rol));

  // El rol empleado tiene su propia página sin sidebar
  if (usuario?.rol === 'empleado') return null;

  return (
    <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
      <div className="sidebar-logo" style={{ background: 'transparent', borderRadius: 0 }}>
        <LogoTheBox height={expanded ? 30 : 28} showText={false} />
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {link.icon}
            {expanded && <span className="nav-label">{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button className="sidebar-toggle" onClick={() => setExpanded(!expanded)} title={expanded ? 'Colapsar' : 'Expandir'}>
        <IconChevron right={!expanded} />
      </button>
    </aside>
  );
}
