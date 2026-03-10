import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useBreakingStore from '../stores/breakingStore';
import useToastStore from '../stores/toastStore';
import UserBadge from '../components/UserBadge';
import HeadlineCard from '../components/HeadlineCard';
import SpecialtyTabs from '../components/SpecialtyTabs';
import TrialBanner from '../components/TrialBanner';
import BreakingOnboarding from '../components/BreakingOnboarding';

export default function BreakingPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const {
    headlines, alertCount, trialStatus, loading, error, activeSpecialty,
    fetchHeadlines, setActiveSpecialty, setSpecialties, deepResearch,
  } = useBreakingStore();

  const [initialized, setInitialized] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
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
      setOnboarding(false);
      addToast('Specialties saved! Loading your Breaking feed.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save preferences', 'error');
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
  const currentHeadlines = headlines[activeSpecialty] || [];

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
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white/80 backdrop-blur border-b px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <UserBadge />
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0F2C5C] via-[#0F2C5C] to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Breaking</h1>
          <p className="mt-2 text-teal-200 text-sm sm:text-base">
            Daily curated medical headlines — ranked, verified, delivered.
          </p>
          {alertCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-xs font-bold">
              {'\u{1F6A8}'} {alertCount} ALERT{alertCount > 1 ? 's' : ''} today
            </div>
          )}
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

        {/* Onboarding */}
        {initialized && onboarding && (
          <BreakingOnboarding onSave={handleOnboardingSave} saving={saving} />
        )}

        {/* Main feed */}
        {initialized && !onboarding && (
          <div className="space-y-4">
            {/* Specialty tabs */}
            {specialties.length > 0 && (
              <SpecialtyTabs
                specialties={specialties}
                active={activeSpecialty}
                onSelect={setActiveSpecialty}
                alertSpecialties={alertSpecialties}
              />
            )}

            {/* Settings link */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {sorted.length} headline{sorted.length !== 1 ? 's' : ''} for {activeSpecialty}
              </p>
              <button
                onClick={() => setOnboarding(true)}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                Change specialties
              </button>
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
                  No headlines for <strong>{activeSpecialty}</strong> today.
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
