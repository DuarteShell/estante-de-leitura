import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { HangingPlant } from './components/Decor';
import { Layout, PlainLayout } from './components/Layout';
import BookDetail from './pages/BookDetail';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Readings from './pages/Readings';
import ShelfPage from './pages/ShelfPage';
import SignUp from './pages/SignUp';
import { LibraryProvider, useLibrary } from './store/library';

// Telas pesadas (leitor de código de barras, importação) carregam sob demanda
const AddBook = lazy(() => import('./pages/AddBook'));
const Import = lazy(() => import('./pages/Import'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="loading" role="status">
      <HangingPlant />
      {children}
    </div>
  );
}

/** Carrega a estante do @ da URL e decide o que mostrar */
function UserScope() {
  const { username = '' } = useParams();
  const { view, viewing, status, error, reload, me } = useLibrary();
  useEffect(() => {
    view(username);
  }, [username, view]);

  if (viewing !== username.toLowerCase() || status === 'loading' || status === 'idle') {
    return <Centered>Regando as plantinhas…</Centered>;
  }
  if (status === 'missing') {
    return (
      <Centered>
        <b>Estante não encontrada</b>
        <span className="small">@{username} não existe ou deixou a estante privada.</span>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Link to={me ? `/u/${me.username}` : '/'} className="btn">
            {me ? 'Minha estante' : 'Página inicial'}
          </Link>
          {!me && (
            <Link to="/criar" className="btn btn-primary">
              Criar a minha
            </Link>
          )}
        </div>
      </Centered>
    );
  }
  if (status === 'error') {
    return (
      <Centered>
        <b>Não consegui carregar a estante</b>
        <span className="small">{error}</span>
        <button className="btn" onClick={reload}>
          Tentar de novo
        </button>
      </Centered>
    );
  }
  return <Layout />;
}

function Routing() {
  const { authReady } = useLibrary();
  if (!authReady) return <Centered>Regando as plantinhas…</Centered>;
  return (
    <Suspense fallback={<Centered>Abrindo…</Centered>}>
      <Routes>
        <Route element={<PlainLayout />}>
          <Route index element={<Landing />} />
          <Route path="entrar" element={<Login />} />
          <Route path="criar" element={<SignUp />} />
        </Route>
        <Route path="u/:username" element={<UserScope />}>
          <Route index element={<Home />} />
          <Route path="leituras" element={<Readings />} />
          <Route path="estante" element={<ShelfPage />} />
          <Route path="livro/:id" element={<BookDetail />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="adicionar" element={<AddBook />} />
          <Route path="importar" element={<Import />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <LibraryProvider>
        <ScrollToTop />
        <Routing />
      </LibraryProvider>
    </HashRouter>
  );
}
