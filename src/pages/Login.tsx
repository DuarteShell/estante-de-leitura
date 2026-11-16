import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { HangingPlant } from '../components/Decor';
import { PinInput } from '../components/PinInput';
import { useLibrary } from '../store/library';

export default function Login() {
  const { signIn, me, mode } = useLibrary();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState(params.get('u') ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === 'local' || me) return <Navigate to={me ? `/u/${me.username}` : '/'} replace />;

  const submit = async (p = pin) => {
    if (!username || p.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim().toLowerCase(), p);
      nav(`/u/${username.trim().toLowerCase()}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar');
      setPin('');
      setBusy(false);
    }
  };

  return (
    <div className="stack lg" style={{ maxWidth: 420, margin: '6vh auto 0', position: 'relative' }}>
      <HangingPlant style={{ position: 'absolute', right: -10, top: -60 }} />
      <h1>Entrar</h1>
      <p className="muted" style={{ margin: 0 }}>Seu @ e o PIN de 6 dígitos.</p>
      <form
        className="card stack lg"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>@usuário</span>
          <div className="at-input">
            <b>@</b>
            <input
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
          </div>
        </label>
        <PinInput label="PIN" value={pin} onChange={setPin} onComplete={(v) => submit(v)} />
        {error && (
          <p className="small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || !username || pin.length !== 6}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
        Ainda não tem estante? <Link to="/criar">Criar a minha</Link>
      </p>
    </div>
  );
}
