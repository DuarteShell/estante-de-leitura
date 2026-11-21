import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLibrary } from '../store/library';
import { PottedPlant } from './Decor';
import { Icon, type IconName } from './Icon';

export function Toast() {
  const { toast } = useLibrary();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast}
    </div>
  );
}

/** Moldura simples (página inicial, login, cadastro) */
export function PlainLayout() {
  return (
    <div className="app plain">
      <main className="main" id="conteudo">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}

/** Moldura da estante de alguém: menu lateral no computador, barra embaixo no celular */
export function Layout() {
  const { canEdit, siteTitle, mode, base, me, profile } = useLibrary();
  const loc = useLocation();
  const wishActive = loc.pathname === `${base}/estante` && loc.search.includes('f=desejo');
  const items: { to: string; label: string; icon: IconName; end?: boolean }[] = [
    { to: base, label: 'Início', icon: 'home', end: true },
    { to: `${base}/leituras`, label: 'Leituras', icon: 'readings' },
    { to: `${base}/estante`, label: 'Estante', icon: 'shelf' },
    { to: `${base}/perfil`, label: 'Perfil', icon: 'user' }
  ];
  const visitingOther = me && profile && me.id !== profile.id;
  const cls = (active: boolean) => `nav-item ${active ? 'active' : ''}`;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Menu">
        <Link to={base} className="brand">
          {siteTitle}
          {!canEdit && profile && <span className="tiny muted" style={{ display: 'block', fontFamily: 'var(--sans)', fontWeight: 700 }}>@{profile.username}</span>}
        </Link>
        {items.slice(0, 3).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cls(isActive && !(it.label === 'Estante' && wishActive))}>
            <Icon name={it.icon} /> {it.label}
          </NavLink>
        ))}
        <Link to={`${base}/estante?f=desejo`} className={cls(wishActive)}>
          <Icon name="heart" /> Lista de desejos
        </Link>
        <NavLink to={`${base}/perfil`} className={({ isActive }) => cls(isActive)}>
          <Icon name="user" /> {canEdit ? 'Perfil de leitor' : 'Sobre'}
        </NavLink>
        {canEdit && (
          <Link to={`${base}/adicionar`} className="btn btn-primary nav-add-wide">
            <Icon name="plus" /> Adicionar livro
          </Link>
        )}
        {visitingOther && (
          <Link to={`/u/${me.username}`} className="btn nav-add-wide">
            <Icon name="shelf" /> Minha estante
          </Link>
        )}
        {!me && (
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            <Link to="/criar" className="btn btn-primary">
              <Icon name="plus" /> Criar minha estante
            </Link>
            <Link to="/entrar" className="btn">
              Entrar com PIN
            </Link>
          </div>
        )}
        {mode === 'local' && <span className="tiny muted" style={{ padding: '0 12px' }}>Modo local: dados só neste navegador</span>}
        <div className="side-plant">
          <PottedPlant size={90} />
        </div>
      </aside>

      <main className="main" id="conteudo">
        {(!me || visitingOther) && (
          <div className="visitor-bar">
            <span className="small grow">
              Você está vendo a estante de <b>@{profile?.username}</b>
            </span>
            {me ? (
              <Link to={`/u/${me.username}`} className="btn btn-sm">
                Minha estante
              </Link>
            ) : (
              <Link to="/criar" className="btn btn-sm btn-primary">
                Criar a minha
              </Link>
            )}
          </div>
        )}
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
          <Link to={`${base}/adicionar`} className="nav-add" aria-label="Adicionar livro">
            <Icon name="plus" size={26} stroke={2.2} />
          </Link>
        )}
        {items.slice(2).map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => cls(isActive)}>
            <Icon name={it.icon} />
            {it.label === 'Perfil' && !canEdit ? 'Sobre' : it.label}
          </NavLink>
        ))}
      </nav>

      <Toast />
    </div>
  );
}
