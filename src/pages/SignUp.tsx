import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PottedPlant } from '../components/Decor';
import { PinInput } from '../components/PinInput';
import { USERNAME_RE } from '../lib/backend';
import { useLibrary } from '../store/library';

const suggest = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);

export default function SignUp() {
  const { signUp, usernameAvailable, me, mode, notify } = useLibrary();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [touchedUser, setTouchedUser] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!touchedUser) setUsername(suggest(name));
  }, [name, touchedUser]);

  useEffect(() => {
    setAvailable(null);
    if (!USERNAME_RE.test(username)) return;
    const t = setTimeout(async () => {
      try {
        setAvailable(await usernameAvailable(username));
      } catch {
        setAvailable(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, usernameAvailable]);

  if (mode === 'local' || me) return <Navigate to={me ? `/u/${me.username}` : '/'} replace />;

  const validUser = USERNAME_RE.test(username);
  const pinOk = /^\d{6}$/.test(pin) && pin === pin2;
  const weak = /^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);

  return (
    <div className="stack lg" style={{ maxWidth: 460, margin: '4vh auto 0' }}>
      <header className="page-head">
        <div>
          <h1>Criar minha estante</h1>
          <p className="sub" style={{ margin: 0 }}>Leva 30 segundos. Sem e-mail.</p>
        </div>
        <PottedPlant />
      </header>

      <form
        className="card stack lg"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validUser || !pinOk || weak || available === false) return;
          setBusy(true);
          setError(null);
          try {
            await signUp(username, name.trim() || username, pin);
            notify('Estante criada! Que tal importar suas leituras?');
            nav(`/u/${username}`, { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível criar a conta');
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Seu nome</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer aparecer na estante" />
        </label>

        <label className="field">
          <span>@usuário (é o seu link e o seu login)</span>
          <div className="at-input">
            <b>@</b>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              required
              value={username}
              onChange={(e) => {
                setTouchedUser(true);
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20));
              }}
            />
          </div>
          <span className="tiny" style={{ fontWeight: 600, color: !validUser && username ? 'var(--danger)' : available === false ? 'var(--danger)' : 'var(--ink-2)' }}>
            {!username
              ? '3 a 20 caracteres: letras, números e _'
              : !validUser
                ? 'Use de 3 a 20 caracteres: letras minúsculas, números e _'
                : available === false
                  ? 'Esse @ já está em uso'
                  : available
                    ? `Disponível! Seu link: …/#/u/${username}`
                    : 'Verificando…'}
          </span>
        </label>

        <PinInput label="Crie um PIN de 6 dígitos" value={pin} onChange={setPin} autoComplete="new-password" />
        <PinInput label="Repita o PIN" value={pin2} onChange={setPin2} autoComplete="new-password" />
        {pin2.length === 6 && pin !== pin2 && <span className="tiny" style={{ color: 'var(--danger)', fontWeight: 700 }}>Os PINs não são iguais</span>}
        {pin.length === 6 && weak && <span className="tiny" style={{ color: 'var(--danger)', fontWeight: 700 }}>PIN fácil demais — evite 000000 ou 123456</span>}

        <p className="tiny muted" style={{ margin: 0 }}>
          Anote seu PIN: como não usamos e-mail, se esquecer é preciso pedir pra quem administra o site redefinir.
        </p>

        {error && (
          <p className="small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy || !validUser || !pinOk || weak || available === false}>
          {busy ? 'Criando…' : 'Criar estante'}
        </button>
      </form>
      <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
        Já tem? <Link to="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
