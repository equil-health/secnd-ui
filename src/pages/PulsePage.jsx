import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePulseStore from '../stores/pulseStore';
import useToastStore from '../stores/toastStore';
import UserBadge from '../components/UserBadge';
import PulsePreferencesForm from '../components/PulsePreferencesForm';
import PulseDigestCard from '../components/PulseDigestCard';

export default function PulsePage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const {
    preferences, latestDigest, selectedDigest, digests, loading, generating, error,
    fetchPreferences, fetchLatestDigest, fetchDigests, generate, clearSelectedDigest,
  } = usePulseStore();

  const [showPrefs, setShowPrefs] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [digestPending, setDigestPending] = useState(false);

  useEffect(() => {
    async function init() {
      await fetchPreferences();
      setInitialized(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (initialized && preferences) {
      fetchLatestDigest();
      fetchDigests();
    }
  }, [initialized, preferences]);

  async function handleGenerate() {
    try {
      await generate();
      setDigestPending(true);
      addToast('Digest generation started! This usually takes 20-30 seconds.', 'success');
      const pollStart = new Date();
      let attempts = 0;
      const maxAttempts = 18;
      const pollInterval = setInterval(async () => {
        attempts++;
        await fetchLatestDigest();
        await fetchDigests();
        const latest = usePulseStore.getState().latestDigest;
        if (latest && latest.generated_at && new Date(latest.generated_at) > pollStart) {
          clearInterval(pollInterval);
          setDigestPending(false);
          addToast('New digest ready!', 'success');
        }
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setDigestPending(false);
        }
      }, 5000);
    } catch (err) {
      setDigestPending(false);
      addToast(err.message || 'Failed to trigger digest', 'error');
    }
  }

  const hasPrefs = !!preferences;
  const isSetup = !hasPrefs && initialized;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Top bar — branded lockup, matches landing ───────────────── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/70">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 group"
          >
            <span className="text-slate-400 group-hover:text-slate-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-[11px] font-black text-white tracking-tight">S</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">SECND</span>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 ml-2">
              Medical Intelligence
            </span>
          </button>
          <UserBadge />
        </div>
      </div>

      {/* ── Hero — pastel sky/emerald, airy ─────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-b border-slate-200/70">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top left, rgba(125,211,252,0.35), transparent 55%), radial-gradient(ellipse at bottom right, rgba(167,243,208,0.35), transparent 55%)',
          }}
        />
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
        <div className="relative mx-auto max-w-4xl px-6 py-10 sm:py-12">
          <div className="flex items-center gap-2 mb-3 animate-fade-in-up">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Personalised
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Literature digest
            </span>
          </div>
          <h1 className="animate-fade-in-up display-hero text-3xl sm:text-5xl text-slate-900 leading-tight">
            Pulse
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600">
              the research that matters to you.
            </span>
          </h1>
          <p className="animate-fade-in-up animate-delay-100 mt-4 max-w-xl text-sm sm:text-base text-slate-600 leading-relaxed">
            Recent journal output from your specialty, summarised against the topics you track. Stay current without the noise.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 mt-8 pb-20">
        {/* Setup phase — no preferences yet */}
        {isSetup && (
          <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Set up your Pulse</h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose your specialty and topics to receive curated literature digests.
            </p>
            <PulsePreferencesForm onSaved={() => fetchPreferences()} />
          </div>
        )}

        {/* Dashboard phase — has preferences */}
        {hasPrefs && (
          <div className="space-y-6">
            {/* Action bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {preferences.specialty}
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-500 capitalize">{preferences.frequency}</span>
                </p>
                {preferences.topics && preferences.topics.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {preferences.topics.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrefs(!showPrefs)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  {showPrefs ? 'Hide Settings' : 'Settings'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  {generating ? 'Generating...' : 'Generate Now'}
                </button>
              </div>
            </div>

            {/* Collapsible preferences editor */}
            {showPrefs && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-fade-in-up">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Edit Preferences</h3>
                <PulsePreferencesForm onSaved={() => {
                  setShowPrefs(false);
                  fetchPreferences();
                }} />
              </div>
            )}

            {/* Selected historical digest */}
            {selectedDigest && (
              <div>
                <button
                  onClick={clearSelectedDigest}
                  className="mb-2 text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to latest
                </button>
                <PulseDigestCard digest={selectedDigest} />
              </div>
            )}

            {/* Generating state — replaces old digest while new one is being created */}
            {!selectedDigest && digestPending && (
              <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
                  <svg className="w-6 h-6 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">Generating your new digest...</p>
                <p className="text-xs text-gray-500 mt-1">
                  Searching PubMed for <strong>{preferences?.specialty}</strong> articles
                  {preferences?.topics?.length > 0 && (
                    <> on {preferences.topics.join(', ')}</>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-2">This usually takes 20-30 seconds</p>
              </div>
            )}

            {/* Latest digest (hidden when viewing a selected historical digest or generating) */}
            {!selectedDigest && !digestPending && loading && !latestDigest && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
                  <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
                  <div className="h-20 bg-gray-100 rounded mt-4" />
                </div>
              </div>
            )}

            {!selectedDigest && !digestPending && !loading && latestDigest && <PulseDigestCard digest={latestDigest} />}

            {!selectedDigest && !digestPending && !loading && !latestDigest && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 text-sm">
                  No digests yet. Click <strong>Generate Now</strong> to create your first one!
                </p>
              </div>
            )}

            {/* Digest history */}
            {digests.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200">
                <div className="px-6 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Digest History</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {digests.map((d) => (
                    <div key={d.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-800">
                          {d.specialty_used || 'Digest'}
                          <span className="text-gray-400 ml-2">
                            {new Date(d.created_at).toLocaleDateString()}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {d.article_count} article{d.article_count !== 1 ? 's' : ''}
                          <span className="mx-1">·</span>
                          <span className={
                            d.status === 'complete' ? 'text-green-600' :
                            d.status === 'failed' ? 'text-red-500' :
                            d.status === 'generating' ? 'text-amber-500' : 'text-gray-400'
                          }>
                            {d.status}
                          </span>
                        </p>
                      </div>
                      {d.status === 'complete' && (
                        <button
                          onClick={() => usePulseStore.getState().fetchDigest(d.id)}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
