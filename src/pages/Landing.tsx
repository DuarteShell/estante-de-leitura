import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { HangingPlant, ShelfPlant, ShelfStack } from '../components/Decor';
import { Icon } from '../components/Icon';
import { LOCAL_USERNAME, type PublicShelf } from '../lib/backend';
import { bookColors } from '../lib/util';
import { useLibrary } from '../store/library';

const DEMO = ['Romance', 'Fantasia', 'Clássicos', 'Mistério', 'Poesia', 'Terror', 'Ficção', 'Mangá', 'Contos'];

export default function Landing() {
  const { me, mode, authReady, listPublic } = useLibrary();
  const nav = useNavigate();
  const [visit, setVisit] = useState('');
  const [shelves, setShelves] = useState<PublicShelf[]>([]);

  useEffect(() => {
    listPublic()
      .then(setShelves)
      .catch(() => setShelves([]));
  }, [listPublic]);

  if (mode === 'local') return <Navigate to={`/u/${LOCAL_USERNAME}`} replace />;
  if (authReady && me) return <Navigate to={`/u/${me.username}`} replace />;

  return (
    <div className="stack lg" style={{ maxWidth: 900, margin: '0 auto' }}>
      <section className="landing-hero">
        <HangingPlant style={{ position: 'absolute', right: -8, top: -20 }} />
        <span className="eyebrow">Estante de leitura</span>
        <h1 style={{ fontSize: 40, maxWidth: 520 }}>Sua estante virtual, aconchegante e organizada</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 520 }}>
          Registre suas leituras por ano, dê notas de meia em meia estrela, guarde citações e mostre sua estante com um link.
        </p>
        <div className="row wrap" style={{ marginTop: 6 }}>
          <Link to="/criar" className="btn btn-primary" style={{ minHeight: 52 }}>
            <Icon name="plus" /> Criar minha estante
          </Link>
          <Link to="/entrar" className="btn" style={{ minHeight: 52 }}>
            Entrar com PIN
          </Link>
        </div>
      </section>

      <div className="shelf-case" aria-hidden="true">
        <div>
          <div className="shelf-row" style={{ height: 150 }}>
            {DEMO.map((g, i) => {
              const [bg, fg] = bookColors({ title: g + i });
              return (
                <span key={g} className="spine" style={{ width: 24 + ((i * 7) % 20), height: 110 + ((i * 13) % 36), background: bg }}>
                  <span className="band" style={{ background: fg, opacity: 0.5 }} />
                  <span className="t" style={{ color: fg }}>{g}</span>
                  <span />
                </span>
              );
            })}
            <ShelfPlant />
          </div>
          <div className="plank" />
        </div>
        <div>
          <div className="shelf-row" style={{ height: 40 }}>
            <ShelfStack />
          </div>
          <div className="plank" />
        </div>
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const u = visit.trim().replace(/^@/, '').toLowerCase();
          if (u) nav(`/u/${u}`);
        }}
      >
        <label className="search grow">
          <Icon name="search" size={20} />
          <span className="sr-only">Visitar estante</span>
          <input placeholder="Visitar a estante de @…" value={visit} onChange={(e) => setVisit(e.target.value)} autoCapitalize="none" />
        </label>
        <button className="btn">Ir</button>
      </form>

      {shelves.length > 0 && (
        <section className="stack">
          <h2>Estantes por aqui</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {shelves.map((s) => {
              const [bg, fg] = bookColors({ title: s.username });
              return (
                <Link key={s.username} to={`/u/${s.username}`} className="card flat shelf-card">
                  <span style={{ width: 44, height: 44, borderRadius: 14, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                    {(s.display_name || s.username)[0]?.toUpperCase()}
                  </span>
                  <span className="stack grow" style={{ gap: 2 }}>
                    <b className="serif">{s.site_title || `Estante de ${s.display_name}`}</b>
                    <span className="tiny muted">@{s.username}{s.bio ? ` · ${s.bio}` : ''}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
