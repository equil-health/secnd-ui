import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useBreakingStore from '../stores/breakingStore';
import useToastStore from '../stores/toastStore';
import UserBadge from '../components/UserBadge';
import HeadlineCard from '../components/HeadlineCard';
import SpecialtyTabs from '../components/SpecialtyTabs';
import TrialBanner from '../components/TrialBanner';
import BreakingOnboarding from '../components/BreakingOnboarding';
import TopicOnboarding from '../components/TopicOnboarding';

export default function BreakingPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const {
    headlines, alertCount, trialStatus, loading, error, activeSpecialty,
    fetchHeadlines, setActiveSpecialty, setSpecialties, deepResearch,
    saveTopics,
  } = useBreakingStore();

  const [initialized, setInitialized] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [topicOnboarding, setTopicOnboarding] = useState(false);
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHeadlines()
      .then((data) => {
        // If no headlines and no specialties → show onboarding
        const specs = Object.keys(data?.headlines || {});
        if (specs.length === 0) setOnboarding(true);
        setInitialized(true);
      })
      .catch(() => {
        setOnboarding(true);
        setInitialized(true);
      });
  }, []);

  async function handleOnboardingSave(specialties) {
    setSaving(true);
    try {
      await setSpecialties(specialties);
      setSelectedSpecialties(specialties);
      setOnboarding(false);
      // Show topic onboarding after specialty selection
      setTopicOnboarding(true);
    } catch (err) {
      addToast(err.message || 'Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTopicSave(topics) {
    setSaving(true);
    try {
      // If user skipped (empty topics), just close
      const hasTopics = Object.values(topics).some((arr) => arr.length > 0);
      if (hasTopics) {
        await saveTopics(topics);
        addToast('Topics saved! Your feed will reflect these at 05:00 IST.', 'success');
      } else {
        addToast('Specialties saved! Loading your Breaking feed.', 'success');
      }
      setTopicOnboarding(false);
      await fetchHeadlines();
    } catch (err) {
      addToast(err.message || 'Failed to save topics', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeepResearch(headline) {
    try {
      const result = await deepResearch(headline.id);
      if (result.blocked) {
        addToast(result.message || 'Report limit reached', 'error');
      } else if (result.case_id) {
        addToast('Research pipeline started!', 'success');
        navigate(`/report/${result.case_id}`);
      }
    } catch (err) {
      addToast(err.message || 'Deep research failed', 'error');
    }
  }

  const specialties = Object.keys(headlines);
  // If activeSpecialty is stale (not in current specialties list), reset to first available
  const validActive = activeSpecialty && specialties.includes(activeSpecialty) ? activeSpecialty : null;
  const displaySpecialty = validActive || specialties[0] || selectedSpecialties[0] || null;
  const currentHeadlines = headlines[displaySpecialty] || [];

  // Sync store if activeSpecialty was stale
  if (displaySpecialty && displaySpecialty !== activeSpecialty) {
    setActiveSpecialty(displaySpecialty);
  }

  // Sort: ALERT > MAJOR > NEW
  const TIER_ORDER = { ALERT: 0, MAJOR: 1, NEW: 2 };
  const sorted = [...currentHeadlines].sort(
    (a, b) => (TIER_ORDER[a.urgency_tier] || 2) - (TIER_ORDER[b.urgency_tier] || 2)
  );

  // Specialties with ALERTs
  const alertSpecialties = specialties.filter((sp) =>
    (headlines[sp] || []).some((h) => h.urgency_tier === 'ALERT')
  );

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
              Daily · 05:00 IST
            </span>
            {alertCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {alertCount} Alert{alertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h1 className="animate-fade-in-up display-hero text-3xl sm:text-5xl text-slate-900 leading-tight">
            Breaking
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600">
              medical headlines.
            </span>
          </h1>
          <p className="animate-fade-in-up animate-delay-100 mt-4 max-w-xl text-sm sm:text-base text-slate-600 leading-relaxed">
            Curated daily. Ranked by urgency, verified against retraction registries, one-tap deep-dive on any story.
          </p>
        </div>
      </section>

      {/* Trial banner */}
      <TrialBanner trialStatus={trialStatus} />

      <div className="mx-auto max-w-4xl px-6 mt-6 pb-20">
        {/* Loading skeleton */}
        {!initialized && (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-full w-2/3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Onboarding — specialty selection */}
        {initialized && onboarding && (
          <BreakingOnboarding onSave={handleOnboardingSave} saving={saving} />
        )}

        {/* Onboarding — topic personalisation (v7.0) */}
        {initialized && topicOnboarding && !onboarding && (
          <TopicOnboarding
            specialties={selectedSpecialties}
            onSave={handleTopicSave}
            saving={saving}
          />
        )}

        {/* Main feed */}
        {initialized && !onboarding && !topicOnboarding && (
          <div className="space-y-4">
            {/* Specialty tabs */}
            {specialties.length > 0 && (
              <SpecialtyTabs
                specialties={specialties}
                active={displaySpecialty}
                onSelect={setActiveSpecialty}
                alertSpecialties={alertSpecialties}
              />
            )}

            {/* Settings links */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {sorted.length} headline{sorted.length !== 1 ? 's' : ''} for {displaySpecialty}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedSpecialties(specialties);
                    setTopicOnboarding(true);
                  }}
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                >
                  Manage topics
                </button>
                <button
                  onClick={() => setOnboarding(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  Change specialties
                </button>
              </div>
            </div>

            {/* Headlines */}
            {sorted.length > 0 ? (
              <div className="space-y-3">
                {sorted.map((h) => (
                  <HeadlineCard
                    key={h.id}
                    headline={h}
                    onDeepResearch={handleDeepResearch}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 text-sm">
                  No headlines for <strong>{displaySpecialty}</strong> today.
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Headlines are refreshed daily at 05:00 IST.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
