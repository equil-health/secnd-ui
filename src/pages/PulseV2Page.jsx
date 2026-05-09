import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePulseStore from '../stores/pulseStore';
import useToastStore from '../stores/toastStore';
import { getPulseVersion } from '../utils/api';
import UserBadge from '../components/UserBadge';
import PulsePreferencesForm from '../components/PulsePreferencesForm';
import PulseV2DigestCard from '../components/PulseV2DigestCard';

function VersionBadge({ info }) {
  if (!info) return null;
  const tone =
    info.version === 'v2' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : info.version === 'shadow' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      Backend: {info.version}
      {info.tooluniverse_available === false && info.version !== 'v1' && (
        <span className="ml-1 text-red-600 normal-case">· ToolUniverse unavailable</span>
      )}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    complete: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    failed: 'text-red-600 bg-red-50 border-red-200',
    generating: 'text-amber-700 bg-amber-50 border-amber-200',
    pending: 'text-slate-500 bg-slate-50 border-slate-200',
  };
  const cls = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function PulseV2Page() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const {
    preferences, latestDigest, selectedDigest, digests, loading, generating, error,
    fetchPreferences, fetchLatestDigest, fetchDigests, fetchDigest, generate, clearSelectedDigest,
  } = usePulseStore();

  const [showPrefs, setShowPrefs] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [digestPending, setDigestPending] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    (async () => {
      await fetchPreferences();
      try {
        const v = await getPulseVersion();
        setVersionInfo(v);
      } catch { /* version endpoint optional */ }
      setInitialized(true);
    })();
  }, []);

  useEffect(() => {
    if (initialized) {
      // Fetch the archive proactively so it's discoverable BEFORE the user
      // generates anything — this was the v1 pain point.
      fetchDigests();
      if (preferences) fetchLatestDigest();
    }
  }, [initialized, preferences]);

  async function handleGenerate() {
    try {
      await generate();
      setDigestPending(true);
      addToast('Multi-source digest started — searching across configured sources.', 'success');
      const pollStart = new Date();
      let attempts = 0;
      const maxAttempts = 24;
      const poll = setInterval(async () => {
        attempts++;
        await fetchLatestDigest();
        await fetchDigests();
        const latest = usePulseStore.getState().latestDigest;
        if (latest && latest.generated_at && new Date(latest.generated_at) > pollStart) {
          clearInterval(poll);
          setDigestPending(false);
          addToast('Digest ready.', 'success');
        }
        if (attempts >= maxAttempts) {
          clearInterval(poll);
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
  const hasArchive = digests.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/70">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/pulse')}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              title="Switch to v1 (PubMed-only)"
            >
              ← v1
            </button>
            <UserBadge />
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-b border-slate-200/70">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top left, rgba(125,211,252,0.35), transparent 55%), radial-gradient(ellipse at bottom right, rgba(167,243,208,0.35), transparent 55%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-10 sm:py-12">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Multi-source
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Pulse v2
            </span>
            <VersionBadge info={versionInfo} />
          </div>
          <h1 className="display-hero text-3xl sm:text-5xl text-slate-900 leading-tight">
            Pulse
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600">
              every relevant source, deduplicated.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            PubMed, Europe PMC, OpenAlex, Semantic Scholar and preprint archives — fanned out in parallel,
            merged by DOI, ranked by relevance.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 mt-8 pb-20 space-y-6">
        {/* Setup */}
        {isSetup && (
          <div className="bg-white rounded-2xl shadow-lg border border-sky-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Set up your Pulse</h2>
            <p className="text-sm text-slate-500 mb-6">
              Choose your specialty and topics. The same preferences power v1 and v2 — switch anytime.
            </p>
            <PulsePreferencesForm onSaved={() => fetchPreferences()} />
          </div>
        )}

        {/* Action bar (always visible once preferences exist) */}
        {hasPrefs && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {preferences.specialty}
                <span className="text-slate-400 mx-2">·</span>
                <span className="text-slate-500 capitalize">{preferences.frequency}</span>
              </p>
              {preferences.topics?.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{preferences.topics.join(', ')}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive {hasArchive && <span className="text-slate-400">({digests.length})</span>}
              </button>
              <button
                onClick={() => setShowPrefs(!showPrefs)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                {showPrefs ? 'Hide Settings' : 'Settings'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-emerald-600 text-white text-xs font-semibold hover:from-sky-700 hover:to-emerald-700 disabled:opacity-50 transition shadow-sm"
              >
                {generating ? 'Generating…' : 'Generate Now'}
              </button>
            </div>
          </div>
        )}

        {/* Archive — top-level, always discoverable */}
        {hasPrefs && archiveOpen && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-fade-in-up">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Archive</h3>
                <p className="text-[11px] text-slate-500">Every digest you've generated — newest first.</p>
              </div>
              <button
                onClick={() => fetchDigests()}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
              >
                Refresh
              </button>
            </div>
            {hasArchive ? (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {digests.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => d.status === 'complete' && fetchDigest(d.id)}
                    disabled={d.status !== 'complete'}
                    className="w-full text-left px-6 py-3 flex items-center justify-between hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    <div>
                      <p className="text-sm text-slate-800">
                        {d.specialty_used || 'Digest'}
                        <span className="text-slate-400 ml-2">
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{d.article_count} article{d.article_count !== 1 ? 's' : ''}</span>
                        <StatusPill status={d.status} />
                      </p>
                    </div>
                    {d.status === 'complete' && (
                      <span className="text-xs text-sky-600 font-medium">View →</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-6 py-6 text-sm text-slate-500 text-center">
                No digests yet. Click <strong>Generate Now</strong> to populate your archive.
              </p>
            )}
          </div>
        )}

        {/* Settings panel */}
        {hasPrefs && showPrefs && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Edit Preferences</h3>
            <PulsePreferencesForm onSaved={() => {
              setShowPrefs(false);
              fetchPreferences();
            }} />
          </div>
        )}

        {/* Selected historical digest */}
        {hasPrefs && selectedDigest && (
          <div>
            <button
              onClick={clearSelectedDigest}
              className="mb-2 text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to latest
            </button>
            <PulseV2DigestCard digest={selectedDigest} title="Archived Digest" />
          </div>
        )}

        {/* Generating */}
        {hasPrefs && !selectedDigest && digestPending && (
          <div className="bg-white rounded-2xl border border-sky-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-100 mb-4">
              <svg className="w-6 h-6 text-sky-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900">Searching multiple sources…</p>
            <p className="text-xs text-slate-500 mt-1">
              Fanning out across {versionInfo?.v2_sources?.join(', ') || 'configured sources'}
            </p>
          </div>
        )}

        {/* Latest digest */}
        {hasPrefs && !selectedDigest && !digestPending && loading && !latestDigest && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="h-20 bg-slate-100 rounded mt-4" />
            </div>
          </div>
        )}

        {hasPrefs && !selectedDigest && !digestPending && !loading && latestDigest && (
          <PulseV2DigestCard digest={latestDigest} title="Latest Digest" />
        )}

        {hasPrefs && !selectedDigest && !digestPending && !loading && !latestDigest && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500 text-sm">
              No digests yet. Click <strong>Generate Now</strong> to create your first multi-source digest.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
