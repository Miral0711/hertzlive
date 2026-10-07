import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, login } from '../auth/authClient';
import { DEMO_ACCOUNTS } from '../auth/demoAccounts';
import { hydrateSessionIntoState } from '../desktop/session';
import { applyAgencyTheme } from '../shared/core';
import { Select } from '../ui/ui';
import { state } from './model';
import './mobile.css';

function nextPath(from) {
  const path = from?.pathname || '';
  if (path.startsWith('/mobile') && path !== '/mobile/login') return path;
  return '/mobile/chats';
}

export function MobileRequireAuth({ children }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/mobile/login" replace state={{ from: location }} />;
  }
  return children;
}

export default function MobileLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = nextPath(location.state?.from);
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const theme = state.theme === 'system' ? undefined : state.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    applyAgencyTheme();
  }, [theme]);

  if (isAuthenticated()) {
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const session = await login(email, password);
      hydrateSessionIntoState(session);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="field-stage">
      <div className="field phone-login" data-theme={theme}>
        <svg className="pointer-events-none absolute right-5 top-5 h-[104px] w-[116px] opacity-30" viewBox="0 0 116 104" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="6" y="6" width="104" height="92" />
            <path d="M6 46H58V6M58 46V74H110M82 74V98M34 74H58M34 46V74" />
            <path d="M58 28a16 16 0 0 1 16-16" />
            <circle cx="86" cy="30" r="12" />
          </g>
        </svg>

        <div className="login-scroll relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-8">
          <div className="mb-6">
            <b className="block font-serif text-[22px] font-semibold uppercase leading-none tracking-[0.16em]">Hertz</b>
            <span className="mt-1.5 block text-[11px] uppercase tracking-[0.14em] opacity-70">Studio</span>
            <p className="m-0 mt-5 max-w-[15rem] font-serif text-[26px] font-medium leading-[1.15]">Design, site and studio in one place.</p>
          </div>

          <form onSubmit={onSubmit} className="rounded-r3 bg-surface px-5 pb-5 pt-6 text-ink shadow-s2">
            <h2 className="m-0 mb-1 text-[26px] leading-tight">Welcome back</h2>
            <p className="m-0 mb-5 text-sm text-ink-3">Sign in to continue to Hertz Studio.</p>

            {error && (
              <div role="alert" className="mb-4 rounded-r1 bg-warn-soft px-3.5 py-2.5 text-sm font-medium text-warn">
                {error}
              </div>
            )}

            <label htmlFor="mobile-login-account" className="mb-4 block text-[13px] font-semibold text-ink-2">
              Account
              <Select id="mobile-login-account" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full font-normal">
                {DEMO_ACCOUNTS.map((a) => (
                  <option key={a.personaId} value={a.email}>{a.label}</option>
                ))}
              </Select>
            </label>

            <label htmlFor="mobile-login-password" className="mb-5 block text-[13px] font-semibold text-ink-2">
              Password
              <input
                id="mobile-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-1.5 min-h-11 w-full rounded-r2 border border-line-2 bg-surface px-3 font-normal text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
              />
            </label>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-r2 bg-accent px-3.5 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="mb-0 mt-4 text-center text-xs text-ink-3">
              Prototype login · demo accounts, password &quot;password&quot;
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
