import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sdssSecondOpinion, sdssHealth } from '../utils/api';
import FormattedMarkdown from '../utils/formatReport';
import UserBadge from '../components/UserBadge';

// ── KG Support badge colours (from integration guide) ──────────
const KG_BADGE = {
  'Strongly Supported':   { bg: 'bg-green-100',  text: 'text-green-800',  bar: 'bg-green-500' },
  'Partially Supported':  { bg: 'bg-amber-100',  text: 'text-amber-800',  bar: 'bg-amber-500' },
  'Structurally Questioned': { bg: 'bg-red-100', text: 'text-red-800',    bar: 'bg-red-500' },
  'Not Found in KG':      { bg: 'bg-gray-100',   text: 'text-gray-600',   bar: 'bg-gray-400' },
};

function kgBadge(support) {
  return KG_BADGE[support] || KG_BADGE['Not Found in KG'];
}

// ── Likelihood badge ───────────────────────────────────────────
const LIKELIHOOD_COLORS = {
  high:          'bg-green-100 text-green-800',
  moderate:      'bg-amber-100 text-amber-800',
  low:           'bg-gray-100 text-gray-600',
  'must-exclude':'bg-red-100 text-red-800',
};

// ── Pipeline stages (from integration guide) ───────────────────
const STAGES = [
  { label: 'Stage 1: MedGemma analysing case',        est: 480 },
  { label: 'Stage 2: Extracting clinical triplets',    est: 15  },
  { label: 'Stage 3: Verifying against PrimeKG',       est: 480 },
  { label: 'Stage 4: Synthesising second opinion',     est: 20  },
];

function getVerdict(answer) {
  if (answer == null) return 'unknown';
  const v = String(answer).toLowerCase().trim();
  if (v === 'true' || v === 'yes' || v === 'verified') return 'verified';
  if (v === 'false' || v === 'no' || v === 'refuted')  return 'refuted';
  return 'unknown';
}

export default function SecondOpinionPage() {
  // ── State ────────────────────────────────────────────────────
  const [caseText, setCaseText] = useState('');
  const [mode, setMode] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [expandedDx, setExpandedDx] = useState(null);
  const [showP1, setShowP1] = useState(false);

  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);

  // ── Health check on mount ────────────────────────────────────
  useEffect(() => {
    sdssHealth()
      .then((data) => { setServerOnline(true); setServerInfo(data); })
      .catch(() => setServerOnline(false));
  }, []);

  // ── Elapsed timer ────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      const start = Date.now();
      setElapsed(0);
      setActiveStage(0);
      timerRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000
      );
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

  // ── Animated stage progression ───────────────────────────────
  useEffect(() => {
    if (loading) {
      let idx = 0;
      setActiveStage(0);
      const advance = () => {
        idx++;
        if (idx < STAGES.length) {
          setActiveStage(idx);
          stageTimerRef.current = setTimeout(advance, STAGES[idx].est * 1000);
        }
      };
      stageTimerRef.current = setTimeout(advance, STAGES[0].est * 1000);
    } else {
      clearTimeout(stageTimerRef.current);
      if (result) setActiveStage(STAGES.length); // all done
    }
    return () => clearTimeout(stageTimerRef.current);
  }, [loading]);

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!caseText.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await sdssSecondOpinion(caseText.trim(), mode);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCaseText('');
    setExpandedDx(null);
    setShowP1(false);
    setActiveStage(0);
    setElapsed(0);
  };

  // ── Format elapsed ──────────────────────────────────────────
  const fmtElapsed = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
        <Link to="/" className="text-lg font-semibold text-indigo-700 hover:text-indigo-800">
          SECND Opinion
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/submit" className="text-sm text-gray-500 hover:text-gray-700">Upload</Link>
          <Link to="/history" className="text-sm text-gray-500 hover:text-gray-700">History</Link>
          <UserBadge />
        </nav>
      </header>

      {/* Server status bar */}
      <div className="px-6 py-2 border-b bg-white flex items-center gap-3 text-xs">
        {serverOnline === null && <span className="text-gray-400">Checking AI server...</span>}
        {serverOnline === true && (
          <>
            <span className="flex items-center gap-1.5 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              AI system online
            </span>
            {serverInfo?.model && (
              <span className="text-gray-400">| {serverInfo.model}</span>
            )}
            {serverInfo?.kg_points && (
              <span className="text-gray-400">| KG: {serverInfo.kg_points.toLocaleString()} relationships</span>
            )}
            {serverInfo?.adapters && (
              <span className="text-gray-400">| {serverInfo.adapters} specialist adapters</span>
            )}
          </>
        )}
        {serverOnline === false && (
          <span className="flex items-center gap-1.5 text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            AI server offline — analysis unavailable
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-6 py-8">

          {/* ──────────────── INPUT PHASE ──────────────── */}
          {!loading && !result && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800">SDSS Second Opinion</h2>
                <p className="text-gray-500 mt-2">
                  MedGemma differential diagnosis verified against 121K+ PrimeKG relationships
                </p>
              </div>

              {/* Mode selector */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setMode('standard')}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    mode === 'standard'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${mode === 'standard' ? 'text-indigo-700' : 'text-gray-700'}`}>
                    Standard
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Full differential with KG verification</p>
                </button>
                <button
                  onClick={() => setMode('zebra')}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    mode === 'zebra'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${mode === 'zebra' ? 'text-amber-700' : 'text-gray-700'}`}>
                    Zebra Mode
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Rare disease focus</p>
                </button>
              </div>

              {/* Case text input */}
              <textarea
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                placeholder="Paste the full clinical case here — patient demographics, presenting complaint, history, exam findings, lab results, imaging, and referring diagnosis..."
                className="w-full h-56 px-4 py-3 border rounded-xl resize-y text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />

              {error && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!caseText.trim() || serverOnline === false}
                className={`mt-4 w-full py-3 text-sm font-medium text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  mode === 'zebra' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Run SDSS Second Opinion
              </button>

              <p className="mt-3 text-xs text-gray-400 text-center">
                This analysis takes 10–16 minutes. The pipeline runs 4 stages of local AI inference on a dedicated GPU.
              </p>
            </>
          )}

          {/* ──────────────── LOADING / PROGRESS ──────────────── */}
          {loading && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border-2 border-purple-200 rounded-xl shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-purple-50 px-5 py-4 border-b border-purple-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-purple-900">SDSS Pipeline Running</p>
                        <p className="text-xs text-purple-500">MedGemma + PrimeKG verification</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-purple-700">{fmtElapsed}</p>
                      <p className="text-[10px] text-purple-400 uppercase tracking-wider">Elapsed</p>
                    </div>
                  </div>
                </div>

                {/* Stages */}
                <div className="px-5 py-4 space-y-1">
                  {STAGES.map((stage, i) => {
                    const isDone = i < activeStage;
                    const isActive = i === activeStage;
                    return (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-500 ${
                        isActive ? 'bg-purple-50 border border-purple-200' : isDone ? 'bg-green-50/50' : ''
                      }`}>
                        <div className="w-7 h-7 flex-shrink-0">
                          {isDone ? (
                            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : isActive ? (
                            <div className="w-7 h-7 rounded-full border-2 border-purple-400 bg-white flex items-center justify-center">
                              <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center">
                              <span className="text-[10px] font-bold text-gray-300">{String(i + 1).padStart(2, '0')}</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-sm transition-colors duration-300 ${
                          isDone ? 'text-green-700 font-medium' : isActive ? 'text-purple-800 font-semibold' : 'text-gray-400'
                        }`}>
                          {stage.label}
                        </span>
                        {isActive && (
                          <span className="ml-auto relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="px-5 pb-4">
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(((activeStage + 0.5) / STAGES.length) * 100, 95)}%` }}
                    />
                  </div>
                </div>

                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400 text-center">
                    This typically takes 10–16 minutes. Do not close this page.
                  </p>
                </div>
              </div>

              {/* Case preview */}
              <div className="mt-6 bg-white border rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Submitted Case</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6">{caseText}</p>
              </div>
            </div>
          )}

          {/* ──────────────── ERROR STATE ──────────────── */}
          {!loading && error && !result && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                <p className="text-red-700 font-medium">{error}</p>
                <button onClick={handleReset} className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* ──────────────── RESULT ──────────────── */}
          {result && (
            <div className="space-y-6">

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Second Opinion Report</h2>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition"
                >
                  New Analysis
                </button>
              </div>

              {/* ── Critical Safety Flag Banner ── */}
              {result.has_critical_flags && (
                <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 shadow-lg">
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="font-bold text-lg">CRITICAL SAFETY FLAG DETECTED</p>
                    <p className="text-sm text-red-100">Review the flagged diagnoses below immediately.</p>
                  </div>
                </div>
              )}

              {/* ── Top Diagnosis Badge ── */}
              {result.top_diagnosis && (
                <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Top KG-Verified Diagnosis</p>
                    <p className="text-xl font-bold text-indigo-900">{result.top_diagnosis}</p>
                  </div>
                </div>
              )}

              {/* ── Synthesis Report (main doctor-facing output) ── */}
              {result.synthesis && (
                <div className="bg-white border rounded-xl shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800">Reconciled Second Opinion</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Final synthesised report combining MedGemma reasoning and PrimeKG verification</p>
                  </div>
                  <div className="px-5 py-4">
                    <FormattedMarkdown content={result.synthesis} />
                  </div>
                </div>
              )}

              {/* ── Verified Differential Table ── */}
              {result.p2_differential?.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800">
                      KG-Verified Differential ({result.p2_differential.length} hypotheses)
                    </h3>
                  </div>
                  <div className="divide-y">
                    {result.p2_differential.map((dx, i) => {
                      const badge = kgBadge(dx.kg_support);
                      const isOpen = expandedDx === i;
                      return (
                        <div key={i} className="px-5 py-4">
                          {/* Diagnosis row */}
                          <button
                            onClick={() => setExpandedDx(isOpen ? null : i)}
                            className="w-full text-left flex items-center gap-3 group"
                          >
                            {/* Rank */}
                            <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                              {i + 1}
                            </span>

                            {/* Name + badges */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{dx.diagnosis}</span>
                                {/* Likelihood */}
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${LIKELIHOOD_COLORS[dx.likelihood] || 'bg-gray-100 text-gray-600'}`}>
                                  {dx.likelihood}
                                </span>
                                {/* KG support badge */}
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                                  {dx.kg_support}
                                </span>
                              </div>

                              {/* KG score bar */}
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[200px]">
                                  <div
                                    className={`h-1.5 rounded-full ${badge.bar} transition-all`}
                                    style={{ width: `${(dx.kg_score || 0) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {((dx.kg_score || 0) * 100).toFixed(0)}%
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  ({dx.true_count || 0}T / {dx.false_count || 0}F)
                                </span>
                              </div>
                            </div>

                            {/* Critical flags */}
                            {dx.critical_flags?.length > 0 && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full flex-shrink-0">
                                CRITICAL
                              </span>
                            )}

                            {/* Expand chevron */}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {/* Critical flags detail */}
                          {dx.critical_flags?.length > 0 && (
                            <div className="mt-2 ml-10">
                              {dx.critical_flags.map((flag, fi) => (
                                <p key={fi} className="text-xs text-red-600 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                                  </svg>
                                  {flag}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Expanded triplets */}
                          {isOpen && dx.triplets?.length > 0 && (
                            <div className="mt-3 ml-10 space-y-1.5">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Verified Triplets ({dx.triplets.length})
                              </p>
                              {dx.triplets.map((t, ti) => {
                                const verdict = getVerdict(t.answer);
                                const borderColor = verdict === 'verified'
                                  ? 'bg-green-50/50 border-green-200'
                                  : verdict === 'refuted'
                                    ? 'bg-red-50/30 border-red-200'
                                    : 'bg-gray-50 border-gray-200';
                                return (
                                  <div key={ti} className={`flex items-center gap-2 p-2.5 rounded-lg border ${borderColor} flex-wrap`}>
                                    {verdict === 'verified' ? (
                                      <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </span>
                                    ) : verdict === 'refuted' ? (
                                      <span className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-[8px] font-bold">?</span>
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-medium rounded">
                                      {t.head}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">{t.relation}</span>
                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-medium rounded">
                                      {t.tail}
                                    </span>
                                    {t.confidence && (
                                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                                        t.confidence === 'high' ? 'bg-green-100 text-green-800'
                                          : t.confidence === 'medium' ? 'bg-amber-100 text-amber-800'
                                            : 'bg-red-100 text-red-800'
                                      }`}>
                                        {t.confidence}
                                      </span>
                                    )}
                                    {t.adapter && (
                                      <span className="text-[9px] text-gray-400">{t.adapter}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── P1 Narrative (collapsible) ── */}
              {result.p1_differential && (
                <div className="bg-white border rounded-xl shadow-sm">
                  <button
                    onClick={() => setShowP1(!showP1)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">MedGemma Full Reasoning (P1)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Raw differential before KG verification</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${showP1 ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {showP1 && (
                    <div className="px-5 pb-4 border-t border-gray-100 pt-4">
                      <FormattedMarkdown content={result.p1_differential} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Latency Footer ── */}
              {(result.total_ms || result.latency_stages) && (
                <div className="text-center text-xs text-gray-400 space-x-3 py-2">
                  {result.total_ms && (
                    <span>
                      Total: {result.total_ms >= 60000
                        ? `${Math.floor(result.total_ms / 60000)}m ${Math.round((result.total_ms % 60000) / 1000)}s`
                        : `${(result.total_ms / 1000).toFixed(1)}s`
                      }
                    </span>
                  )}
                  {result.latency_stages?.p1_ms && (
                    <span>P1: {(result.latency_stages.p1_ms / 1000).toFixed(1)}s</span>
                  )}
                  {result.latency_stages?.p2_ms && (
                    <span>P2: {(result.latency_stages.p2_ms / 1000).toFixed(1)}s</span>
                  )}
                  {result.latency_stages?.extraction_ms && (
                    <span>Extract: {(result.latency_stages.extraction_ms / 1000).toFixed(1)}s</span>
                  )}
                  {result.latency_stages?.synthesis_ms && (
                    <span>Synth: {(result.latency_stages.synthesis_ms / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-[11px] text-gray-500 leading-relaxed">
                <p className="font-medium text-gray-600 mb-1">Disclaimer</p>
                <p>
                  This report is generated by the SECND SDSS v1.0 pipeline using MedGemma and PrimeKG knowledge graph verification.
                  It is intended for informational and research purposes only and is <strong>not</strong> a confirmatory clinical diagnosis.
                  Do not use for medical emergencies.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
