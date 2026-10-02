import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { login, isAuthenticated } from './authClient';
import { DEMO_ACCOUNTS } from './demoAccounts';
import { Select } from '../ui/ui';
import { hydrateSessionIntoState } from '../desktop/session';
import { PROJECTS, USERS, SITES } from '../shared/data';

// Visually a plain, self-contained page (not part of the desktop Shell chrome), styled with the
// same design tokens the rest of the app already uses (surface/ink/accent/line — see
// shared/index.css) so it reads as part of Hertz Studio without touching any existing UI.
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to={location.state?.from?.pathname || '/desktop/dashboard'} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const session = await login(email, password);
      hydrateSessionIntoState(session);
      navigate(location.state?.from?.pathname || '/desktop/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }

  // Figures shown on the brand panel come from the same seed data the app starts with.
  const stats = [
    [PROJECTS.filter((p) => p.status !== 'finished').length, 'Active projects'],
    [USERS.filter((u) => !['client', 'contractor'].includes(u.role)).length, 'Team members'],
    [SITES.filter((x) => x.progress < 100).length, 'Live sites'],
  ];

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-nav px-16 py-14 text-nav-ink lg:flex">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="70" y="150" width="580" height="600" />
            <path d="M70 380H330V150M330 380V560H650M470 560V750M200 560H330M200 380V560" />
            <path d="M330 250a60 60 0 0 1 60-60M470 560a60 60 0 0 0 60 60" />
            <path d="M110 150v-30M650 150v-30M110 120h540" strokeDasharray="6 6" />
            <circle cx="560" cy="300" r="48" />
          </g>
        </svg>
        <div className="relative">
          <b className="block font-serif text-[22px] font-semibold uppercase leading-none tracking-[0.16em]">Hertz</b>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] opacity-70">Studio</span>
        </div>
        <div className="relative">
          <h1 className="m-0 max-w-[440px] text-[46px] font-medium leading-[1.1]">Design, site and studio in one place.</h1>
          <p className="mt-3.5 max-w-[380px] leading-relaxed opacity-80">Projects, drawings, site updates and money, kept in step so the whole team works from the same picture.</p>
        </div>
        <dl className="relative m-0 flex gap-7">
          {stats.map(([n, label]) => (
            <div key={label}>
              <dd className="m-0 font-serif text-[26px] font-semibold leading-none">{n}</dd>
              <dt className="mt-1 text-xs opacity-75">{label}</dt>
            </div>
          ))}
        </dl>
      </aside>

      <main className="grid place-items-center overflow-y-auto px-6 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-[380px]">
          <div className="mb-7 lg:hidden">
            <b className="block font-serif text-lg font-semibold uppercase tracking-[0.16em] text-accent-text">Hertz Studio</b>
          </div>
          <h2 className="m-0 mb-1.5 text-[30px] font-semibold leading-tight">Welcome back</h2>
          <p className="m-0 mb-7 text-sm text-ink-3">Sign in to continue to Hertz Studio.</p>

          {error && (
            <div role="alert" className="mb-4 rounded-r1 bg-warn-soft px-3.5 py-2.5 text-sm font-medium text-warn">
              {error}
            </div>
          )}

          <label htmlFor="login-account" className="mb-4 block text-[13px] font-semibold text-ink-2">
            Account
            <Select id="login-account" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full font-normal">
              {DEMO_ACCOUNTS.map((a) => (
                <option key={a.personaId} value={a.email}>{a.label}</option>
              ))}
            </Select>
          </label>

          <label htmlFor="login-password" className="mb-5 block text-[13px] font-semibold text-ink-2">
            Password
            <input
              id="login-password"
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
      </main>
    </div>
  );
}
