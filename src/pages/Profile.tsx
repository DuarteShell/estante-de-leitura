import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PinInput } from '../components/PinInput';
import { PottedPlant } from '../components/Decor';
import { Icon } from '../components/Icon';
import { exportCsv, exportJson } from '../lib/exporters';
import { useLibrary } from '../store/library';

export default function Profile() {
  const lib = useLibrary();
  const { profile, canEdit, mode, displayName, siteTitle, books, readings, quotes, base } = lib;
  const [name, setName] = useState(profile?.display_name ?? '');
  const [title, setTitle] = useState(profile?.site_title ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [goal, setGoal] = useState(profile?.annual_goal ? String(profile.annual_goal) : '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [saving, setSaving] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const nav = useNavigate();
  const shareUrl = `${window.location.origin}${window.location.pathname}#/u/${profile?.username ?? ''}`;

  useEffect(() => {
    setName(profile?.display_name ?? '');
    setTitle(profile?.site_title ?? '');
    setBio(profile?.bio ?? '');
    setGoal(profile?.annual_goal ? String(profile.annual_goal) : '');
    setIsPublic(profile?.is_public ?? true);
  }, [profile]);

  if (!canEdit) {
    return (
      <div className="page narrow">
        <header className="page-head">
          <div>
            <h1>{siteTitle}</h1>
            {profile?.bio && <p className="sub">{profile.bio}</p>}
          </div>
          <PottedPlant />
        </header>
        <div className="card stack">
          <span className="small">
            {displayName} tem <b>{books.filter((b) => b.owned && b.status !== 'desejo').length}</b> livros na estante e já leu <b>{books.filter((b) => b.status === 'lido').length}</b>.
          </span>
        </div>
        {!lib.me && (
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <Link to="/criar" className="btn btn-primary">
              Criar minha estante
            </Link>
            <Link to={`/entrar?u=${profile?.username ?? ''}`} className="btn">
              É sua? Entrar
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Perfil e dados</h1>
          <p className="sub" style={{ margin: 0 }}>Seu nome, meta e backup</p>
        </div>
        <PottedPlant />
      </header>

      <form
        className="card stack lg"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await lib.saveProfile({
              display_name: name.trim() || 'Leitor',
              site_title: title.trim() || null,
              bio: bio.trim() || null,
              annual_goal: goal ? Number(goal) : null,
              is_public: isPublic
            });
            lib.notify('Perfil salvo');
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="field">
          <span>Seu nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado(a)" />
        </label>
        <label className="field">
          <span>Nome do site</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Estante de ${name || 'Leitor'}`} />
        </label>
        <label className="field">
          <span>Frase de apresentação</span>
          <input className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ex.: Leitora de fantasia e romances fofos" />
        </label>
        <label className="field">
          <span>Meta de livros por ano</span>
          <input className="input" type="number" inputMode="numeric" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="24" />
        </label>
        {mode === 'supabase' && (
          <div className="field">
            <span>Quem pode ver sua estante</span>
            <div className="seg" role="group" aria-label="Visibilidade">
              <button type="button" className={isPublic ? 'on' : ''} onClick={() => setIsPublic(true)}>
                Pública
              </button>
              <button type="button" className={!isPublic ? 'on' : ''} onClick={() => setIsPublic(false)}>
                Só eu
              </button>
            </div>
            <span className="tiny muted">{isPublic ? 'Qualquer pessoa com o link vê seus livros (só você edita).' : 'Ninguém além de você consegue ver.'}</span>
          </div>
        )}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </form>

      {mode === 'supabase' && (
        <section className="card stack">
          <h2 style={{ fontSize: 19 }}>Seu link</h2>
          <span className="small muted">Seu login é <b>@{profile?.username}</b> (não dá pra trocar).</span>
          <div className="row">
            <input className="input grow" readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Link da sua estante" />
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  lib.notify('Link copiado');
                } catch {
                  lib.notify('Selecione e copie o link');
                }
              }}
            >
              Copiar
            </button>
          </div>
        </section>
      )}

      {mode === 'supabase' && (
        <form
          className="card stack lg"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\d{6}$/.test(newPin) || newPin !== newPin2) return;
            await lib.changePin(newPin);
            setNewPin('');
            setNewPin2('');
            lib.notify('PIN alterado');
          }}
        >
          <h2 style={{ fontSize: 19 }}>Trocar PIN</h2>
          <PinInput label="Novo PIN" value={newPin} onChange={setNewPin} autoComplete="new-password" />
          <PinInput label="Repita o novo PIN" value={newPin2} onChange={setNewPin2} autoComplete="new-password" />
          {newPin2.length === 6 && newPin !== newPin2 && <span className="tiny" style={{ color: 'var(--danger)', fontWeight: 700 }}>Os PINs não são iguais</span>}
          <button className="btn" disabled={newPin.length !== 6 || newPin !== newPin2}>
            Salvar novo PIN
          </button>
        </form>
      )}

      <section className="card stack">
        <h2 style={{ fontSize: 19 }}>Importar</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Traga seu histórico do Notion, Goodreads, StoryGraph ou de qualquer planilha CSV (Skoob, Skeelo, Google Sheets, Excel…).
        </p>
        <Link to={`${base}/importar`} className="btn">
          <Icon name="upload" size={18} /> Importar planilha ou backup
        </Link>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 19 }}>Exportar</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {books.length} livros · {readings.length} leituras · {quotes.length} citações
        </p>
        <div className="grid grid-2">
          <button className="btn" onClick={() => exportJson(lib)}>
            <Icon name="download" size={18} /> Backup (.json)
          </button>
          <button className="btn" onClick={() => exportCsv(lib)}>
            <Icon name="download" size={18} /> Planilha (.csv)
          </button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          O backup .json restaura tudo (inclusive em outro aparelho ou ao migrar do modo local para o Supabase). O .csv abre no Excel, Google Sheets e Notion.
        </p>
      </section>

      <section className="card flat stack">
        {mode === 'local' ? (
          <>
            <span className="eyebrow">Modo local</span>
            <p className="small" style={{ margin: 0 }}>
              Os dados estão só neste navegador. Para publicar a estante e acessar de qualquer lugar, configure o Supabase (veja o README) e importe o backup .json lá.
            </p>
          </>
        ) : (
          <button
            className="btn"
            onClick={async () => {
              await lib.signOut();
              nav('/', { replace: true });
            }}
          >
            <Icon name="logout" size={18} /> Sair
          </button>
        )}
      </section>
    </div>
  );
}
