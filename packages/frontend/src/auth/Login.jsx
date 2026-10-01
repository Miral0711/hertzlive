import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { login, isAuthenticated } from './authClient';
import { DEMO_ACCOUNTS } from './demoAccounts';
import { hydrateSessionIntoState } from '../desktop/session';

// Visually a plain, self-contained page (not part of the desktop Shell chrome), styled with the
// same design tokens the rest of the app already uses (surface/ink/accent/line — see
// shared/index.css) so it reads as part of Archos Studio without touching any existing UI.
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to={location.state?.from?.pathname || '/desktop/today'} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const session = await login(email, password);
      hydrateSessionIntoState(session);
      navigate(location.state?.from?.pathname || '/desktop/today', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center overflow-y-auto bg-surface-2 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-r3 border border-line bg-surface p-6 shadow-s2"
      >
        <div className="mb-6 text-center">
          <b className="block text-lg font-bold tracking-tight text-ink">Hertz Studio</b>
          <small className="text-ink-3">Sign in to Archos Studio</small>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-r1 bg-warn-soft px-3.5 py-2.5 text-sm font-medium text-warn">
            {error}
          </div>
        )}

        <label htmlFor="login-account" className="mb-3 block text-[13px] text-ink-2">
          Account
          <select
            id="login-account"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-10 w-full rounded-r1 border border-line-2 bg-surface px-2.5 text-ink"
          >
            {DEMO_ACCOUNTS.map((a) => (
              <option key={a.personaId} value={a.email}>{a.label}</option>
            ))}
          </select>
        </label>

        <label htmlFor="login-password" className="mb-5 block text-[13px] text-ink-2">
          Password
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 min-h-10 w-full rounded-r1 border border-line-2 bg-surface px-2.5 text-ink"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-r1 bg-accent px-3.5 font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>

        <small className="mt-4 block text-center text-ink-3">
          Prototype login · demo accounts, password &quot;password&quot;
        </small>
      </form>
    </div>
  );
}
