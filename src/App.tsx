import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HangingPlant } from './components/Decor';
import { Layout } from './components/Layout';
import BookDetail from './pages/BookDetail';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Readings from './pages/Readings';
import ShelfPage from './pages/ShelfPage';
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

function Gate() {
  const { loading, error, reload } = useLibrary();
  if (loading) {
    return (
      <div className="loading">
        <HangingPlant />
        <span>Regando as plantinhas…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="loading" role="alert">
        <HangingPlant />
        <b>Não consegui carregar a estante</b>
        <span className="small">{error}</span>
        <button className="btn" onClick={reload}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="loading">Abrindo…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="leituras" element={<Readings />} />
        <Route path="estante" element={<ShelfPage />} />
        <Route path="adicionar" element={<AddBook />} />
        <Route path="livro/:id" element={<BookDetail />} />
        <Route path="importar" element={<Import />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="entrar" element={<Login />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <LibraryProvider>
        <ScrollToTop />
        <Gate />
      </LibraryProvider>
    </HashRouter>
  );
}
