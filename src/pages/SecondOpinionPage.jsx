import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sdssSubmit, sdssHealth } from '../utils/api';
import useSdssPolling from '../hooks/useSdssPolling';
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

// ── Row accent colours by likelihood (left border + subtle bg) ──
const ROW_ACCENT = {
  high:           { border: 'border-l-green-500',  bg: 'bg-green-50/40' },
  moderate:       { border: 'border-l-amber-500',  bg: 'bg-amber-50/30' },
  low:            { border: 'border-l-gray-300',   bg: 'bg-gray-50/30' },
  'must-exclude': { border: 'border-l-red-500',    bg: 'bg-red-50/30' },
};

// ── Severity icon per likelihood ──────────────────────────────
function LikelihoodIcon({ likelihood }) {
  if (likelihood === 'high') return (
    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
  if (likelihood === 'must-exclude') return (
    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
  if (likelihood === 'moderate') return (
    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

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
  const [showStorm, setShowStorm] = useState(false);
  const [taskId, setTaskId] = useState(null);

  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);

  // ── WebSocket + polling fallback ────────────────────────────
  const { status: pollStatus, result: pollResult, error: pollError, reset: resetPoll } = useSdssPolling(taskId);

  // React to status updates
  useEffect(() => {
    if (pollStatus === 'complete' && pollResult) {
      setResult(pollResult);
      setLoading(false);
    } else if (pollStatus === 'failed') {
      setError(pollError || 'Analysis failed. Please try again.');
      setLoading(false);
    }
  }, [pollStatus, pollResult, pollError]);

  // ── Local elapsed timer (ticks every second while loading) ──
  useEffect(() => {
    if (loading) {
      const start = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000
      );
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

  // ── Health check on mount ────────────────────────────────────
  useEffect(() => {
    sdssHealth()
      .then((data) => { setServerOnline(true); setServerInfo(data); })
      .catch(() => setServerOnline(false));
  }, []);

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
      const { task_id } = await sdssSubmit(caseText.trim(), mode);
      setTaskId(task_id);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCaseText('');
    setExpandedDx(null);
    setShowP1(false);
    setShowStorm(false);
    setActiveStage(0);
    setElapsed(0);
    setTaskId(null);
    resetPoll();
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
          {result && (() => {
            // Pre-compute summary stats for the at-a-glance bar
            const dxList = result.p2_differential || [];
            const countByLikelihood = { high: 0, moderate: 0, low: 0, 'must-exclude': 0 };
            dxList.forEach(dx => { countByLikelihood[dx.likelihood] = (countByLikelihood[dx.likelihood] || 0) + 1; });
            const totalTriplets = dxList.reduce((s, dx) => s + (dx.triplets?.length || 0), 0);
            const verifiedTriplets = dxList.reduce((s, dx) => s + (dx.true_count || 0), 0);
            const hasCritical = result.has_critical_flags || dxList.some(dx => dx.critical_flags?.length > 0);

            return (
            <div className="space-y-5">

              {/* ── Report Header Bar ── */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Second Opinion Report</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {mode === 'zebra' ? 'Zebra Mode' : 'Standard'} analysis
                    {result.total_ms && ` completed in ${result.total_ms >= 60000
                      ? `${Math.floor(result.total_ms / 60000)}m ${Math.round((result.total_ms % 60000) / 1000)}s`
                      : `${(result.total_ms / 1000).toFixed(1)}s`
                    }`}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition"
                >
                  New Analysis
                </button>
              </div>

              {/* ── Critical Safety Flag Banner (pulsing) ── */}
              {hasCritical && (
                <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-5 flex items-start gap-4 shadow-lg ring-2 ring-red-300 ring-offset-2 animate-pulse-slow">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-lg tracking-tight">CRITICAL SAFETY FLAG DETECTED</p>
                    <p className="text-sm text-red-100 mt-1">
                      One or more diagnoses require immediate clinical attention. Review flagged items below.
                    </p>
                    {dxList.filter(dx => dx.critical_flags?.length > 0).map((dx, i) => (
                      <p key={i} className="text-sm font-semibold text-red-100 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                        {dx.diagnosis}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── At-a-Glance Summary Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Top diagnosis */}
                {result.top_diagnosis && (
                  <div className="col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 text-white shadow-md">
                    <p className="text-[10px] uppercase tracking-widest text-indigo-200 font-semibold">Top KG-Verified Diagnosis</p>
                    <p className="text-lg font-bold mt-1 leading-tight">{result.top_diagnosis}</p>
                    {dxList[0] && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-white/20 rounded-full h-2">
                          <div className="bg-white h-2 rounded-full" style={{ width: `${(dxList[0].kg_score || 0) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-indigo-200">{((dxList[0].kg_score || 0) * 100).toFixed(0)}% KG</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Stat: hypotheses count */}
                <div className="bg-white border rounded-xl p-4 flex flex-col justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Hypotheses</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{dxList.length}</p>
                  <div className="flex gap-1 mt-2">
                    {countByLikelihood.high > 0 && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded">{countByLikelihood.high} high</span>}
                    {countByLikelihood.moderate > 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">{countByLikelihood.moderate} mod</span>}
                    {countByLikelihood['must-exclude'] > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">{countByLikelihood['must-exclude']} excl</span>}
                  </div>
                </div>
                {/* Stat: triplet verification */}
                <div className="bg-white border rounded-xl p-4 flex flex-col justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">KG Triplets</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{totalTriplets}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: totalTriplets ? `${(verifiedTriplets / totalTriplets) * 100}%` : '0%' }} />
                    </div>
                    <span className="text-[9px] text-gray-500 font-mono">{totalTriplets ? ((verifiedTriplets / totalTriplets) * 100).toFixed(0) : 0}% verified</span>
                  </div>
                </div>
              </div>

              {/* ── Synthesis Report (main doctor-facing output) ── */}
              {result.synthesis && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">Reconciled Second Opinion</h3>
                        <p className="text-xs text-gray-400">MedGemma reasoning verified against PrimeKG knowledge graph</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <FormattedMarkdown content={result.synthesis} />
                  </div>

                  {/* ── Inline References (clickable from [n] citations) ── */}
                  {result.references?.length > 0 && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        References ({result.references.length})
                      </p>
                      <ol className="space-y-2">
                        {result.references.map((ref, i) => {
                          // Handle both string refs and object refs {title, url, doi, source, ...}
                          const isObj = ref && typeof ref === 'object';
                          const title = isObj ? (ref.title || ref.name || ref.citation || JSON.stringify(ref)) : String(ref);
                          const url = isObj ? (ref.url || ref.link || ref.doi_url || (ref.doi ? `https://doi.org/${ref.doi}` : null) || (ref.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` : null)) : null;
                          const source = isObj ? (ref.source || ref.journal || ref.database) : null;
                          const doi = isObj ? ref.doi : null;
                          const pmid = isObj ? ref.pmid : null;
                          const year = isObj ? ref.year : null;

                          return (
                            <li key={i} id={`ref-${i + 1}`} className="flex gap-2 text-xs scroll-mt-20">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium leading-snug">
                                    {title}
                                  </a>
                                ) : (
                                  <span className="text-gray-800 font-medium leading-snug">{title}</span>
                                )}
                                <div className="flex flex-wrap gap-2 mt-0.5">
                                  {source && <span className="text-[10px] text-gray-400 italic">{source}</span>}
                                  {year && <span className="text-[10px] text-gray-400">{year}</span>}
                                  {doi && (
                                    <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
                                      DOI: {doi}
                                    </a>
                                  )}
                                  {pmid && (
                                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline">
                                      PMID: {pmid}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* ── Patient & Clinical Context (if extracted) ── */}
              {(result.patient || result.temporal_events?.length > 0 || result.investigations_performed?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Patient demographics */}
                  {result.patient && Object.keys(result.patient).length > 0 && (
                    <div className="bg-white border rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                        Patient
                      </p>
                      <div className="space-y-1">
                        {Object.entries(result.patient).map(([k, v]) => v && (
                          <p key={k} className="text-xs text-gray-700">
                            <span className="font-semibold text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span> {String(v)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Temporal events / timeline */}
                  {result.temporal_events?.length > 0 && (
                    <div className="bg-white border rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Timeline
                      </p>
                      <div className="space-y-1.5">
                        {result.temporal_events.map((evt, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-gray-700">{typeof evt === 'string' ? evt : JSON.stringify(evt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investigations performed */}
                  {result.investigations_performed?.length > 0 && (
                    <div className="bg-white border rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                        Investigations
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.investigations_performed.map((inv, i) => (
                          <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-medium rounded border border-teal-200">
                            {typeof inv === 'string' ? inv : JSON.stringify(inv)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Evidence & Hallucination quality bar ── */}
              {(result.evidence_count != null || result.hallucination_issues != null) && (
                <div className="flex gap-3">
                  {result.evidence_count != null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-700">{result.evidence_count} evidence items</span>
                    </div>
                  )}
                  {result.hallucination_issues != null && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                      result.hallucination_issues === 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <svg className={`w-4 h-4 ${result.hallucination_issues === 0 ? 'text-green-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      <span className={`text-xs font-semibold ${result.hallucination_issues === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                        {result.hallucination_issues === 0 ? 'No hallucination flags' : `${result.hallucination_issues} hallucination flag${result.hallucination_issues > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Verified Differential Table (colour-coded rows) ── */}
              {dxList.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">
                          KG-Verified Differential
                        </h3>
                        <p className="text-xs text-gray-400">{dxList.length} hypotheses ranked by knowledge-graph support</p>
                      </div>
                    </div>
                    {/* Colour legend */}
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-green-500" /> High likelihood</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-amber-500" /> Moderate</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-gray-300" /> Low</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-red-500" /> Must-exclude</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dxList.map((dx, i) => {
                      const badge = kgBadge(dx.kg_support);
                      const accent = ROW_ACCENT[dx.likelihood] || ROW_ACCENT.low;
                      const isOpen = expandedDx === i;
                      const isCritical = dx.critical_flags?.length > 0;
                      return (
                        <div key={i} className={`border-l-4 ${accent.border} ${isCritical ? 'bg-red-50/40' : accent.bg} transition-colors`}>
                          {/* Diagnosis row */}
                          <button
                            onClick={() => setExpandedDx(isOpen ? null : i)}
                            className="w-full text-left px-5 py-4 flex items-center gap-3 group hover:bg-black/[0.02] transition-colors"
                          >
                            {/* Rank circle with severity colour */}
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              dx.likelihood === 'high' ? 'bg-green-100 text-green-700 ring-2 ring-green-200'
                              : dx.likelihood === 'must-exclude' ? 'bg-red-100 text-red-700 ring-2 ring-red-200'
                              : dx.likelihood === 'moderate' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200'
                              : 'bg-gray-100 text-gray-500'
                            }`}>
                              {i + 1}
                            </span>

                            {/* Name + badges + bar */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-gray-900">{dx.diagnosis}</span>
                                {/* Likelihood with icon */}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${LIKELIHOOD_COLORS[dx.likelihood] || 'bg-gray-100 text-gray-600'}`}>
                                  <LikelihoodIcon likelihood={dx.likelihood} />
                                  {dx.likelihood?.replace('-', ' ')}
                                </span>
                                {/* KG support */}
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                                  {dx.kg_support}
                                </span>
                                {/* Critical pill */}
                                {isCritical && (
                                  <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1 animate-pulse">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                                    </svg>
                                    CRITICAL
                                  </span>
                                )}
                              </div>

                              {/* KG score bar — bigger & more visible */}
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 bg-gray-200/60 rounded-full h-2.5 max-w-[240px]">
                                  <div
                                    className={`h-2.5 rounded-full ${badge.bar} transition-all duration-500`}
                                    style={{ width: `${Math.max((dx.kg_score || 0) * 100, 3)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 font-mono font-semibold">
                                  {((dx.kg_score || 0) * 100).toFixed(0)}%
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  ({dx.true_count || 0} verified / {dx.false_count || 0} refuted)
                                </span>
                              </div>
                            </div>

                            {/* Expand chevron */}
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {/* Critical flags detail (always visible if present) */}
                          {isCritical && (
                            <div className="px-5 pb-3 ml-11">
                              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {dx.critical_flags.map((flag, fi) => (
                                  <p key={fi} className="text-xs text-red-700 font-semibold flex items-center gap-1.5 py-0.5">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                                    </svg>
                                    {flag}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expanded triplets */}
                          {isOpen && dx.triplets?.length > 0 && (
                            <div className="px-5 pb-4 ml-11">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Verified Triplets ({dx.triplets.length})
                              </p>
                              <div className="space-y-1.5">
                                {dx.triplets.map((t, ti) => {
                                  const verdict = getVerdict(t.answer);
                                  const borderColor = verdict === 'verified'
                                    ? 'bg-green-50 border-green-300'
                                    : verdict === 'refuted'
                                      ? 'bg-red-50 border-red-300'
                                      : 'bg-gray-50 border-gray-200';
                                  return (
                                    <div key={ti} className={`flex items-center gap-2 p-2.5 rounded-lg border ${borderColor} flex-wrap`}>
                                      {verdict === 'verified' ? (
                                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        </span>
                                      ) : verdict === 'refuted' ? (
                                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </span>
                                      ) : (
                                        <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                                          <span className="text-white text-[9px] font-bold">?</span>
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-semibold rounded">
                                        {t.head}
                                      </span>
                                      <span className="text-[10px] text-gray-500 font-mono italic">{t.relation}</span>
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-semibold rounded">
                                        {t.tail}
                                      </span>
                                      {t.confidence && (
                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                          t.confidence === 'high' ? 'bg-green-100 text-green-800'
                                            : t.confidence === 'medium' ? 'bg-amber-100 text-amber-800'
                                              : 'bg-red-100 text-red-800'
                                        }`}>
                                          {t.confidence}
                                        </span>
                                      )}
                                      {t.priority && (
                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                          t.priority === 'high' ? 'bg-red-100 text-red-700'
                                            : t.priority === 'medium' ? 'bg-amber-100 text-amber-700'
                                              : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          P:{t.priority}
                                        </span>
                                      )}
                                      {t.adapter_used && (
                                        <span className="text-[9px] text-gray-400 italic">{t.adapter_used}</span>
                                      )}
                                      {t.adapter && !t.adapter_used && (
                                        <span className="text-[9px] text-gray-400 italic">{t.adapter}</span>
                                      )}
                                      {t.clinical_note && (
                                        <p className="w-full text-[10px] text-gray-500 mt-1 pl-7 italic leading-relaxed">{t.clinical_note}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── STORM Deep-Dive Article (collapsible) ── */}
              {result.storm_article && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowStorm(!showStorm)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">STORM Deep-Dive Article</h3>
                        <p className="text-xs text-gray-400 mt-0.5">AI-generated literature synthesis on the primary diagnosis</p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${showStorm ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {showStorm && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <FormattedMarkdown content={result.storm_article} />
                    </div>
                  )}
                </div>
              )}

              {/* ── P1 Narrative (collapsible) ── */}
              {result.p1_differential && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowP1(!showP1)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">MedGemma Full Reasoning (P1)</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Raw differential before KG verification</p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${showP1 ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {showP1 && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <FormattedMarkdown content={result.p1_differential} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Latency Footer ── */}
              {result.latency_stages && (
                <div className="flex justify-center gap-4 text-[10px] text-gray-400 py-1">
                  {result.latency_stages?.p1_ms && <span>P1 {(result.latency_stages.p1_ms / 1000).toFixed(1)}s</span>}
                  {result.latency_stages?.extraction_ms && <span>Extract {(result.latency_stages.extraction_ms / 1000).toFixed(1)}s</span>}
                  {result.latency_stages?.p2_ms && <span>P2 {(result.latency_stages.p2_ms / 1000).toFixed(1)}s</span>}
                  {result.latency_stages?.synthesis_ms && <span>Synth {(result.latency_stages.synthesis_ms / 1000).toFixed(1)}s</span>}
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}
