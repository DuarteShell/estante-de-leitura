import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { HangingPlant } from '../components/Decor';
import { useLibrary } from '../store/library';

export default function Login() {
  const { signIn, canEdit, mode } = useLibrary();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === 'local' || canEdit) return <Navigate to="/" replace />;

  return (
    <div className="stack lg" style={{ maxWidth: 420, margin: '6vh auto 0', position: 'relative' }}>
      <HangingPlant style={{ position: 'absolute', right: -10, top: -60 }} />
      <h1>Entrar</h1>
      <p className="muted" style={{ margin: 0 }}>Só a dona/dono da estante precisa entrar. Visitantes veem tudo sem login.</p>
      <form
        className="card stack lg"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await signIn(email.trim(), password);
            nav('/', { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível entrar');
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
