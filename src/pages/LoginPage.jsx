import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/api';
import useAuthStore from '../stores/authStore';
import useToastStore from '../stores/toastStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      setAuth(data.access_token, data.user);
      addToast(`Logged in as ${data.user.full_name}`, 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Left brand panel ─────────────────────────────────────────── */}
      <aside className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-b lg:border-b-0 lg:border-r border-slate-200/70 hidden lg:flex flex-col justify-between px-10 py-12 xl:px-14 xl:py-16">
        {/* Soft colour wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top left, rgba(125,211,252,0.35), transparent 55%), radial-gradient(ellipse at bottom right, rgba(167,243,208,0.35), transparent 55%)',
          }}
        />
        {/* Faint grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        {/* Logo lockup */}
        <div className="relative flex items-center gap-2.5 animate-fade-in-up">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20">
            <span className="text-xs font-black text-white tracking-tight">S</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">SECND</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 ml-2">
            Medical Intelligence
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <div className="flex items-center gap-2 mb-5 animate-fade-in-up">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Clinician Access
            </span>
          </div>
          <h1 className="animate-fade-in-up display-hero text-4xl xl:text-5xl text-slate-900 leading-tight">
            Evidence-backed
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600">
              clinical reasoning.
            </span>
          </h1>
          <p className="animate-fade-in-up animate-delay-100 mt-5 text-sm xl:text-base text-slate-600 leading-relaxed">
            Sign in to submit verified cases, chase differentials, and review literature stress-tested against current evidence.
          </p>

          {/* Trust marks */}
          <div className="animate-fade-in-up animate-delay-200 mt-8">
            <div className="eyebrow text-slate-400 mb-3">Grounded in</div>
            <div className="flex flex-wrap gap-2">
              {[
                'Biomedical knowledge graph',
                'Peer-reviewed literature',
                'Autonomous deep research',
                'Specialty guidelines',
              ].map((src) => (
                <span
                  key={src}
                  className="text-[11px] font-medium text-slate-600 border border-slate-200 bg-white/80 backdrop-blur-sm rounded-md px-2 py-1"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer fine-print */}
        <p className="relative text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Beta · Not for emergency use
        </p>
      </aside>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <main className="flex flex-col">
        {/* Mobile-only compact brand bar */}
        <div className="lg:hidden border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="px-6 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-[11px] font-black text-white tracking-tight">S</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">SECND</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 ml-2">
              Medical Intelligence
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
          <div className="w-full max-w-sm animate-fade-in-up">
            <div className="eyebrow text-indigo-600 mb-3">Sign in</div>
            <h2 className="display-title text-3xl sm:text-4xl text-slate-900 leading-tight">
              Welcome back.
              <br />
              <span className="text-slate-500 font-normal italic">Let's get to work.</span>
            </h2>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Use your clinician credentials. If you don't have access yet, contact your administrator.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.org"
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-500 transition-shadow shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-500 transition-shadow shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-lg">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="group w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 text-sm font-semibold transition-all shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-[11px] text-slate-500 leading-relaxed">
              By signing in, you acknowledge that SECND output is AI-generated, intended for informational and research purposes only, and not a confirmatory clinical diagnosis.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
