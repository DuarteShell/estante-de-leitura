import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLibrary } from '../store/library';
import { PottedPlant } from './Decor';
import { Icon, type IconName } from './Icon';

const items: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/leituras', label: 'Leituras', icon: 'readings' },
  { to: '/estante', label: 'Estante', icon: 'shelf' },
  { to: '/perfil', label: 'Perfil', icon: 'user' }
];

export function Layout() {
  const { canEdit, toast, siteTitle, mode } = useLibrary();
  const loc = useLocation();
  const wishActive = loc.pathname === '/estante' && loc.search.includes('f=desejo');

  const cls = (active: boolean) => `nav-item ${active ? 'active' : ''}`;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Menu">
        <Link to="/" className="brand">
          {siteTitle}
        </Link>
        {items.slice(0, 3).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls(isActive && !(it.to === '/estante' && wishActive))}>
            <Icon name={it.icon} /> {it.label}
          </NavLink>
        ))}
        <Link to="/estante?f=desejo" className={cls(wishActive)}>
          <Icon name="heart" /> Lista de desejos
        </Link>
        <NavLink to="/perfil" className={({ isActive }) => cls(isActive)}>
          <Icon name="user" /> Perfil e dados
        </NavLink>
        {canEdit && (
          <Link to="/adicionar" className="btn btn-primary nav-add-wide">
            <Icon name="plus" /> Adicionar livro
          </Link>
        )}
        {mode === 'local' && <span className="tiny muted" style={{ padding: '0 12px' }}>Modo local: dados só neste navegador</span>}
        <div className="side-plant">
          <PottedPlant size={90} />
        </div>
      </aside>

      <main className="main" id="conteudo">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {items.slice(0, 2).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls(isActive)}>
            <Icon name={it.icon} />
            {it.label}
          </NavLink>
        ))}
        {canEdit && (
          <Link to="/adicionar" className="nav-add" aria-label="Adicionar livro">
            <Icon name="plus" size={26} stroke={2.2} />
          </Link>
        )}
        {items.slice(2).map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => cls(isActive)}>
            <Icon name={it.icon} />
            {it.label}
          </NavLink>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
