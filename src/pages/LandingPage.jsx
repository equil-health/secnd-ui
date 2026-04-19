import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserBadge from '../components/UserBadge';

// ── Iconography — monochrome, outline, uniform stroke weight ──────────
const Icon = {
  verified: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25 4.5-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  research: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  breaking: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  pulse: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  ),
  arrow: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
};

// ── Feature inventory ────────────────────────────────────────────────
const PRIMARY_FEATURE = {
  id: 'second-opinion',
  eyebrow: 'Flagship',
  title: 'Second Opinion',
  tagline: 'Verified clinical reasoning on demand.',
  description:
    'Submit a case. Receive an evidence-grounded second opinion with a treatment-safety gate, knowledge-graph verification, and deep literature review.',
  icon: Icon.verified,
  badge: 'v2 · Verified',
};

const SECONDARY_FEATURES = [
  {
    id: 'chat',
    title: 'Med Chat',
    description: 'Interactive clinical dialogue. Explore differentials, chase follow-ups, stress-test diagnoses.',
    icon: Icon.chat,
    path: '/chat',
    badge: null,
  },
  {
    id: 'research',
    title: 'Research Base',
    description: 'Autonomous deep research on any medical topic. Structured article, verified citations.',
    icon: Icon.research,
    path: '/research',
    badge: null,
  },
  {
    id: 'breaking',
    title: 'Breaking',
    description: 'Curated medical headlines with urgency tiers, retraction checks, and one-tap deep-dive.',
    icon: Icon.breaking,
    path: '/breaking',
    badge: null,
  },
  {
    id: 'pulse',
    title: 'Pulse',
    description: 'Personalised literature digest. Recent journal output summarised against your specialty.',
    icon: Icon.pulse,
    path: '/pulse',
    badge: 'New',
  },
];

// Stats rendered in the left column; placeholder numbers until wired to
// a real API. Intentionally specific — generic round numbers read as
// marketing; odd digits read as measurement.
// ═════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/70">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-[11px] font-black text-white tracking-tight">S</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">SECND</span>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 ml-2">
              Medical Intelligence
            </span>
          </div>
          <UserBadge />
        </div>
      </div>

      {/* ── Hero strip — pastel green/blue, airy ───────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-b border-slate-200/70">
        {/* Soft colour wash */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(ellipse at top left, rgba(125,211,252,0.35), transparent 55%), radial-gradient(ellipse at bottom right, rgba(167,243,208,0.35), transparent 55%)',
          }}
        />
        {/* Faint grid — barely there */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(rgba(15,23,42,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-12 sm:py-14">
          <div className="flex items-center gap-2 mb-4 animate-fade-in-up">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live · Production
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Beta · Not for emergency use
            </span>
          </div>

          <h1 className="animate-fade-in-up display-hero text-3xl sm:text-5xl text-slate-900 max-w-3xl">
            Evidence-backed clinical reasoning
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600">
              for the moments that matter.
            </span>
          </h1>
          <p className="animate-fade-in-up animate-delay-100 mt-5 max-w-xl text-sm sm:text-base text-slate-600 leading-relaxed">
            A second-opinion engine for clinicians. Every conclusion grounded in medical knowledge, stress-tested against current literature, and gated by explicit treatment-safety rules.
          </p>
        </div>
      </section>

      {/* ── Main 2-column grid ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-8 lg:gap-12">
        {/* Left column — sticky rail */}
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div>
            <div className="eyebrow text-indigo-600 mb-3">Start here</div>
            <h2 className="display-title text-3xl sm:text-4xl text-slate-900">
              Pick a workflow.
              <br />
              <span className="text-slate-500 font-normal italic">We handle the rest.</span>
            </h2>
            <p className="mt-5 text-sm text-slate-600 leading-relaxed">
              Five modes, one engine. Start with a full verified case, dive into literature, or chat through a clinical question.
            </p>
          </div>

          <button
            onClick={() => navigate('/case')}
            className="group w-full flex items-center justify-between rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-3.5 text-sm font-semibold transition-all shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20"
          >
            <span className="flex items-center gap-2">
              <span>Start a verified case</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                v2
              </span>
            </span>
            <span className="transition-transform group-hover:translate-x-0.5">{Icon.arrow}</span>
          </button>

          {/* Trust marks */}
          <div className="border-t border-slate-200 pt-6">
            <div className="eyebrow text-slate-400 mb-3">Grounded in</div>
            <div className="flex flex-wrap gap-2">
              {[
                'Biomedical knowledge graph',
                'Peer-reviewed literature',
                'Autonomous deep research',
                'Specialty clinical guidelines',
              ].map((src) => (
                <span
                  key={src}
                  className="text-[11px] font-medium text-slate-600 border border-slate-200 bg-white rounded-md px-2 py-1"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Right column — cards */}
        <div className="space-y-4">
          {/* Primary card */}
          <PrimaryCard
            feature={PRIMARY_FEATURE}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            onNavigate={navigate}
          />

          {/* Secondary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECONDARY_FEATURES.map((f, i) => (
              <SecondaryCard
                key={f.id}
                feature={f}
                onClick={() => navigate(f.path)}
                delayClass={i === 1 ? 'animate-delay-100' : i === 2 ? 'animate-delay-200' : ''}
              />
            ))}
          </div>
        </div>
      </section>

      <LandingDisclaimer />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Cards
// ═════════════════════════════════════════════════════════════════════

function PrimaryCard({ feature, expanded, onToggle, onNavigate }) {
  return (
    <div className="animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_48px_-12px_rgba(15,23,42,0.18)] transition-shadow">
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-indigo-600 to-emerald-500" />

        <button
          type="button"
          onClick={onToggle}
          className="w-full text-left p-7 sm:p-8"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-white">
                {feature.icon}
              </span>
              <div>
                <div className="eyebrow text-indigo-600">{feature.eyebrow}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="display-title text-2xl sm:text-3xl text-slate-900">
                    {feature.title}
                  </h3>
                  {feature.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {feature.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`flex-shrink-0 mt-1 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>

          <p className="font-display text-lg sm:text-xl font-semibold text-slate-900 leading-snug mb-2 italic">
            {feature.tagline}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
            {feature.description}
          </p>

          <div className="mt-5 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Knowledge-graph verified
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Treatment-safety gated
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Hallucination-checked
            </span>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-7 sm:px-8 py-5 animate-fade-in-up">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 mb-3">
              Choose an entry point
            </div>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('/case')}
                className="group w-full flex items-center justify-between rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-3.5 text-sm font-semibold transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <span>Verified Case</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                    v2
                  </span>
                </span>
                <span className="text-xs font-normal text-slate-400 flex items-center gap-1.5">
                  GPU-accelerated
                  <span className="transition-transform group-hover:translate-x-0.5">{Icon.arrow}</span>
                </span>
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => onNavigate('/second-opinion')}
                  className="group flex items-center justify-between rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 px-4 py-3 text-sm font-semibold transition-all"
                >
                  <span>Legacy Second Opinion</span>
                  <span className="text-slate-400 transition-transform group-hover:translate-x-0.5">{Icon.arrow}</span>
                </button>
                <button
                  onClick={() => onNavigate('/chat')}
                  className="group flex items-center justify-between rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 px-4 py-3 text-sm font-semibold transition-all"
                >
                  <span>Chat Mode</span>
                  <span className="text-slate-400 transition-transform group-hover:translate-x-0.5">{Icon.arrow}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => onNavigate('/submit')}
                  className="rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold transition-colors"
                >
                  Upload
                </button>
                <button
                  onClick={() => onNavigate('/demo')}
                  className="rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold transition-colors"
                >
                  Demo
                </button>
                <button
                  onClick={() => onNavigate('/history')}
                  className="rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 text-xs font-semibold transition-colors"
                >
                  History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecondaryCard({ feature, onClick, delayClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group animate-fade-in-up ${delayClass} relative overflow-hidden rounded-xl bg-white border border-slate-200 p-5 text-left transition-all hover:border-slate-900 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.18)]`}
    >
      {/* left accent bar — appears on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-900 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
          {feature.icon}
        </span>
        {feature.badge && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
            {feature.badge}
          </span>
        )}
      </div>

      <h3 className="display-title text-lg text-slate-900 mb-1">
        {feature.title}
      </h3>
      <p className="text-xs text-slate-600 leading-relaxed mb-3">
        {feature.description}
      </p>
      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-900">
        <span>Open</span>
        <span className="transition-transform group-hover:translate-x-0.5">{Icon.arrow}</span>
      </div>
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Disclaimer
// ═════════════════════════════════════════════════════════════════════

function LandingDisclaimer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-[0.22em] hover:text-slate-200 transition-colors"
        >
          <span>
            <span className="text-amber-400 mr-2">⚠</span>
            Critical Disclaimer — AI-generated, not a clinical diagnosis
          </span>
          <span className="text-xs">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="max-w-4xl mx-auto mt-4 space-y-2 text-[11px] leading-relaxed text-slate-400">
            <p>
              This report is generated by the SECND Reporter Engine. It is intended for informational and research purposes only and constitutes a &ldquo;Clinical Second Opinion&rdquo; based on available digital records. It is <span className="font-semibold text-slate-200">not</span> a confirmatory clinical diagnosis.
            </p>
            <p className="font-semibold text-amber-300">No emergency use. Do not use this portal for medical emergencies.</p>
            <div className="border-t border-slate-800 pt-2 mt-1 space-y-1">
              <p><span className="font-semibold text-slate-200">Standard Output</span> — Evidence-backed verification of the referring diagnosis.</p>
              <p><span className="font-semibold text-slate-200">Think Zebra (Beta)</span> — Differential discovery for low-prevalence conditions. Not clinical recommendations.</p>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
