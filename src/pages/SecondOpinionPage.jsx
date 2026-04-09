import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sdssSubmit, sdssSubmitWithFiles, sdssHealth } from '../utils/api';
import useSdssPolling from '../hooks/useSdssPolling';
import FormattedMarkdown from '../utils/formatReport';
import UserBadge from '../components/UserBadge';
import { exportSdssPDF, exportSdssDOCX, exportSdssHTML } from '../utils/sdssExport';
import { renderEventItem, parseEventFields, extractVerdict, extractKnowledgeGaps, extractRecommendations, stripExtractedSections, parseSynthesisSections, VERDICT_LEVELS, PRIORITY_COLORS } from '../utils/reportHelpers';

// ── Pipeline stages ───────────────────────────────────────────
const STAGES = [
  { label: 'Stage 1: AI analysing case',                est: 480 },
  { label: 'Stage 2: Extracting clinical triplets',    est: 15  },
  { label: 'Stage 3: Verifying against knowledge graph', est: 480 },
  { label: 'Stage 4: Synthesising second opinion',     est: 20  },
];

// ── File helpers ──────────────────────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function fileIcon(type) {
  if (type === 'application/pdf') return 'PDF';
  if (type?.includes('word') || type?.includes('document')) return 'DOC';
  if (type?.startsWith('image/')) return 'IMG';
  return 'FILE';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SecondOpinionPage() {
  const [caseText, setCaseText] = useState('');
  const [mode, setMode] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [showFullReasoning, setShowFullReasoning] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const { status: pollStatus, result: pollResult, error: pollError, reset: resetPoll } = useSdssPolling(taskId);

  useEffect(() => {
    if (pollStatus === 'complete' && pollResult) {
      setResult(pollResult);
      setLoading(false);
    } else if (pollStatus === 'failed') {
      setError(pollError || 'Analysis failed. Please try again.');
      setLoading(false);
    }
  }, [pollStatus, pollResult, pollError]);

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

  useEffect(() => {
    sdssHealth()
      .then((data) => { setServerOnline(true); setServerInfo(data); })
      .catch(() => setServerOnline(false));
  }, []);

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
      if (result) setActiveStage(STAGES.length);
    }
    return () => clearTimeout(stageTimerRef.current);
  }, [loading]);

  // ── File management ───────────────────────────────────────────
  const addFiles = (newFiles) => {
    const valid = [];
    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`Unsupported file: ${f.name}. Allowed: PDF, DOCX, JPG, PNG.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`File too large: ${f.name} (${formatSize(f.size)}). Max 50 MB.`);
        return;
      }
      valid.push(f);
    }
    setFiles(prev => [...prev, ...valid]);
    setError(null);
  };

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (!caseText.trim() && files.length === 0) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      let task_id;
      if (files.length > 0) {
        // Multipart submit with files
        const formData = new FormData();
        formData.append('case_text', caseText.trim());
        formData.append('mode', mode);
        formData.append('india_context', false);
        for (const f of files) formData.append('files', f);
        const resp = await sdssSubmitWithFiles(formData);
        task_id = resp.task_id;
      } else {
        // JSON submit (text only)
        const resp = await sdssSubmit(caseText.trim(), mode);
        task_id = resp.task_id;
      }
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
    setFiles([]);
    setShowFullReasoning(false);
    setShowDeepDive(false);
    setActiveStage(0);
    setElapsed(0);
    setTaskId(null);
    resetPoll();
  };

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
          <Link to="/second-opinion/history" className="text-sm text-gray-500 hover:text-gray-700">Archive</Link>
          <Link to="/history" className="text-sm text-gray-500 hover:text-gray-700">History</Link>
          <UserBadge />
        </nav>
      </header>

      {/* Server status bar */}
      <div className="px-6 py-2 border-b bg-white flex items-center gap-3 text-xs">
        {serverOnline === null && <span className="text-gray-400">Checking AI server...</span>}
        {serverOnline === true && (
          <span className="flex items-center gap-1.5 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI system online
          </span>
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
                <h2 className="text-2xl font-bold text-gray-800">Second Opinion Analysis</h2>
                <p className="text-gray-500 mt-2">
                  AI-powered clinical decision support with knowledge graph verification
                </p>
              </div>

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
                  <p className="text-xs text-gray-500 mt-0.5">Full differential with verification</p>
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
                className="w-full h-48 px-4 py-3 border rounded-xl resize-y text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />

              {/* File upload zone */}
              <div
                className={`mt-3 border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    Drag & drop files, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      browse
                    </button>
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, DOCX, JPG, PNG — up to 50 MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files.length) addFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
              </div>

              {/* File chips */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full text-sm"
                    >
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {fileIcon(f.type)}
                      </span>
                      <span className="text-gray-700 truncate max-w-[180px]">{f.name}</span>
                      <span className="text-gray-400 text-xs">{formatSize(f.size)}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 ml-1 text-xs"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={(!caseText.trim() && files.length === 0) || serverOnline === false}
                className={`mt-4 w-full py-3 text-sm font-medium text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  mode === 'zebra' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                Run Second Opinion Analysis
              </button>

              <p className="mt-3 text-xs text-gray-400 text-center">
                Typical analysis time: 10–16 minutes
              </p>
            </>
          )}

          {/* ──────────────── LOADING / PROGRESS ──────────────── */}
          {loading && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border-2 border-purple-200 rounded-xl shadow-lg overflow-hidden">
                <div className="bg-purple-50 px-5 py-4 border-b border-purple-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-purple-900">Analysis in Progress</p>
                        <p className="text-xs text-purple-500">Processing your clinical case</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-purple-700">{fmtElapsed}</p>
                      <p className="text-[10px] text-purple-400 uppercase tracking-wider">Elapsed</p>
                    </div>
                  </div>
                </div>
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

          {/* ══════════════════════════════════════════════════
              CLINICAL REPORT — matches reference PDF layout
             ══════════════════════════════════════════════════ */}
          {result && <ClinicalReport result={result} mode={mode} onReset={handleReset}
            showFullReasoning={showFullReasoning} setShowFullReasoning={setShowFullReasoning}
            showDeepDive={showDeepDive} setShowDeepDive={setShowDeepDive} />}

        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  CLINICAL REPORT COMPONENT
// ═══════════════════════════════════════════════════════════════

function ClinicalReport({ result, mode, onReset, showFullReasoning, setShowFullReasoning, showDeepDive, setShowDeepDive }) {
  const dxList = result.p2_differential || [];
  const hasCritical = result.has_critical_flags || dxList.some(dx => dx.critical_flags?.length > 0);

  return (
    <div className="space-y-0">

      {/* ── Report Header (persistent bar like reference PDF) ── */}
      <div className="bg-indigo-700 text-white rounded-t-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-indigo-200">SECND Medical Platform</p>
            <h1 className="text-xl font-bold mt-0.5">Second Opinion Clinical Analysis</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSdssPDF(result, mode)}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              PDF
            </button>
            <button
              onClick={() => exportSdssDOCX(result, mode)}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              DOCX
            </button>
            <button
              onClick={() => exportSdssHTML(result, mode)}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              HTML
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              New Analysis
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-indigo-200">
          <span>{mode === 'zebra' ? 'Zebra Mode' : 'Standard'} Analysis</span>
          <span>|</span>
          <span>{new Date().toLocaleDateString()}</span>
          {(result.total_ms || result.total_latency_ms) && (
            <>
              <span>|</span>
              <span>Completed in {fmtMs(result.total_ms || result.total_latency_ms)}</span>
            </>
          )}
        </div>
      </div>

      {/* Sub-header disclaimer bar */}
      <div className="bg-gray-100 border-x border-b border-gray-200 px-6 py-2 text-[11px] text-gray-500 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        AI-Generated Second Opinion &nbsp;|&nbsp; Decision Support Only &nbsp;|&nbsp; Not a substitute for clinical judgment
      </div>

      <div className="bg-white border-x border-b border-gray-200 rounded-b-xl">

        {/* ── Section 1: Patient Summary (key-value grid like reference PDF) ── */}
        {(result.patient || result.top_diagnosis || result.temporal_events?.length > 0 || result.investigations_performed?.length > 0) && (
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {result.patient && Object.entries(result.patient).map(([k, v]) => v && (
                <div key={k} className="flex">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-32 flex-shrink-0 pt-0.5">{k.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-gray-900">{String(v)}</span>
                </div>
              ))}
              {result.top_diagnosis && (
                <div className="flex">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-32 flex-shrink-0 pt-0.5">Diagnosis</span>
                  <span className="text-sm font-bold text-indigo-700">{result.top_diagnosis}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            {result.temporal_events?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Timeline</p>
                <div className="space-y-1.5">
                  {result.temporal_events.map((evt, i) => {
                    const { primary, date, detail } = parseEventFields(evt);
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">
                          {date && <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5">{date}</span>}
                          {primary}
                          {detail && <span className="text-xs text-gray-500 italic ml-1"> — {detail}</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Investigations */}
            {result.investigations_performed?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Investigations Performed</p>
                <div className="flex flex-wrap gap-2">
                  {result.investigations_performed.map((inv, i) => (
                    <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">
                      {renderEventItem(inv)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Executive Verdict Banner ── */}
        <ExecutiveVerdictBanner result={result} />

        {/* ── Critical Safety Alert (prominent, like reference PDF) ── */}
        {hasCritical && (
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse-red" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-red-800 text-base">Critical Safety Alert</p>
                  <p className="text-sm text-red-700 mt-1">
                    One or more findings require immediate clinical attention.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {dxList.filter(dx => dx.critical_flags?.length > 0).map((dx, di) => (
                  dx.critical_flags.map((flag, fi) => {
                    const colonIdx = flag.indexOf(':');
                    const dashIdx = flag.indexOf(' — ');
                    const splitIdx = colonIdx > 0 ? colonIdx : dashIdx > 0 ? dashIdx : -1;
                    const flagTitle = splitIdx > 0 ? flag.slice(0, splitIdx).trim() : dx.diagnosis;
                    const flagDetail = splitIdx > 0 ? flag.slice(splitIdx + (colonIdx > 0 ? 1 : 3)).trim() : flag;

                    return (
                      <div key={`${di}-${fi}`} className="bg-white/60 rounded-lg border-l-4 border-red-600 px-4 py-3">
                        <p className="font-bold text-red-900 text-sm">{flagTitle}</p>
                        <p className="text-red-700 text-sm mt-0.5">{flagDetail}</p>
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Section 2: Differential Diagnosis (numbered like reference PDF) ── */}
        {dxList.length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pl-3 border-l-[3px] border-indigo-500">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              PrimeKG-Verified Differential
            </h2>
            <p className="text-xs text-gray-500 mb-4">Each hypothesis verified against 12.9M PrimeKG relationships. Ranked by KG structural support.</p>

            <div className="space-y-4">
              {dxList.map((dx, i) => (
                <DifferentialCard key={i} dx={dx} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Knowledge Gaps ── */}
        <KnowledgeGapsTable result={result} />

        {/* ── Clinical Recommendations ── */}
        <RecommendationsTable result={result} />

        {/* ── Clinical Analysis (synthesis — structured accordion) ── */}
        {result.synthesis && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pl-3 border-l-[3px] border-indigo-500">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Clinical Analysis
            </h2>
            <SynthesisAccordion synthesis={result.synthesis} />
          </div>
        )}

        {/* ── Evidence Base (unified section) ── */}
        <EvidenceBaseSection result={result} showDeepDive={showDeepDive} setShowDeepDive={setShowDeepDive} showFullReasoning={showFullReasoning} setShowFullReasoning={setShowFullReasoning} />

        {/* ── Footer Disclaimer ── */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl">
          <p className="text-[11px] text-gray-400 leading-relaxed text-center">
            SECND Medical Platform &nbsp;|&nbsp;
            Decision support only. Does not replace clinical judgment. Not FDA-cleared. Research use only.
          </p>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  DIFFERENTIAL CARD — numbered clinical style
// ═══════════════════════════════════════════════════════════════

function DifferentialCard({ dx, rank }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = dx.critical_flags?.length > 0;

  const likelihoodStyle = {
    high:          { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-700', num: 'bg-green-600' },
    moderate:      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', num: 'bg-amber-500' },
    low:           { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-600', num: 'bg-gray-400' },
    'must-exclude':{ bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   badge: 'bg-red-100 text-red-700', num: 'bg-red-600' },
  };
  const style = likelihoodStyle[dx.likelihood] || likelihoodStyle.low;

  // Build a clinical narrative from triplets if available
  const verifiedFindings = dx.triplets?.filter(t => {
    const v = String(t.answer || '').toLowerCase();
    return ['true', 'yes', 'verified'].includes(v);
  }) || [];
  const refutedFindings = dx.triplets?.filter(t => {
    const v = String(t.answer || '').toLowerCase();
    return ['false', 'no', 'refuted'].includes(v);
  }) || [];

  return (
    <div className={`rounded-xl border ${isCritical ? 'border-red-300 bg-red-50/50' : style.border + ' ' + style.bg}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 group"
      >
        {/* Rank number */}
        <span className={`w-8 h-8 rounded-lg ${style.num} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5`}>
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">{dx.diagnosis}</h3>
            {isCritical && (
              <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
              {dx.likelihood?.replace('-', ' ')}
            </span>
            {dx.kg_score != null && (
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dx.kg_score >= 0.7 ? 'bg-green-500' : dx.kg_score >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${(dx.kg_score * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-600">{(dx.kg_score * 100).toFixed(0)}%</span>
              </div>
            )}
            {dx.true_count != null && (
              <span className="text-gray-400">
                {dx.true_count} supporting / {dx.false_count || 0} against
              </span>
            )}
          </div>

          {/* Critical flags inline */}
          {isCritical && (
            <div className="mt-2 space-y-1">
              {dx.critical_flags.map((flag, fi) => (
                <p key={fi} className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                  {flag}
                </p>
              ))}
            </div>
          )}
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 mt-1 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expanded: clinical evidence summary */}
      {expanded && (dx.triplets?.length > 0) && (
        <div className="px-5 pb-4 ml-12 space-y-3">
          {/* Supporting evidence */}
          {verifiedFindings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Supporting Evidence ({verifiedFindings.length})
              </p>
              <div className="space-y-1">
                {verifiedFindings.map((t, ti) => (
                  <div key={ti} className="flex items-start gap-2 text-sm text-gray-700 bg-green-50/50 px-3 py-1.5 rounded-lg">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                    <div>
                      <span className="font-medium">{t.head}</span>
                      <span className="text-gray-400 mx-1.5">{t.relation?.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{t.tail}</span>
                      {t.clinical_note && <p className="text-xs text-gray-500 italic mt-0.5">{t.clinical_note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refuting evidence */}
          {refutedFindings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Against ({refutedFindings.length})
              </p>
              <div className="space-y-1">
                {refutedFindings.map((t, ti) => (
                  <div key={ti} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50/50 px-3 py-1.5 rounded-lg">
                    <span className="text-red-500 mt-0.5 flex-shrink-0">-</span>
                    <div>
                      <span className="font-medium">{t.head}</span>
                      <span className="text-gray-400 mx-1.5">{t.relation?.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{t.tail}</span>
                      {t.clinical_note && <p className="text-xs text-gray-500 italic mt-0.5">{t.clinical_note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  EXECUTIVE VERDICT BANNER
// ═══════════════════════════════════════════════════════════════

function ExecutiveVerdictBanner({ result }) {
  const verdict = extractVerdict(result);
  if (!verdict) return null;

  const levelStyle = VERDICT_LEVELS[verdict.level] || VERDICT_LEVELS.caution;
  const topDx = (result.p2_differential || [])[0];
  const supportNote = verdict.support || topDx?.kg_support || null;

  return (
    <div className="px-6 py-5 border-b border-gray-100">
      <div className={`rounded-xl px-6 py-5 ${levelStyle.bg} ${levelStyle.border} border ${levelStyle.text}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Executive Verdict</p>
            <p className="text-lg font-bold mt-1 leading-snug">{verdict.text}</p>
            {supportNote && (
              <p className="text-sm opacity-80 mt-1.5">{supportNote} — PrimeKG verification</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  KNOWLEDGE GAPS TABLE
// ═══════════════════════════════════════════════════════════════

function KnowledgeGapsTable({ result }) {
  const gaps = extractKnowledgeGaps(result);
  if (gaps.length === 0) return null;

  return (
    <div className="px-6 py-5 border-b border-gray-100">
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pl-3 border-l-[3px] border-indigo-500">
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        Knowledge Gaps
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Gap</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Clinical Implication</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gaps.map((gap, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                <td className="px-4 py-3 text-gray-800 font-medium">{gap.gap}</td>
                <td className="px-4 py-3 text-gray-600">{gap.implication || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  CLINICAL RECOMMENDATIONS TABLE
// ═══════════════════════════════════════════════════════════════

function RecommendationsTable({ result }) {
  const recs = extractRecommendations(result);
  if (recs.length === 0) return null;

  return (
    <div className="px-6 py-5 border-b border-gray-100">
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pl-3 border-l-[3px] border-indigo-500">
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
        Clinical Recommendations
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-10 px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recs.map((rec, i) => {
              const colors = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.MODERATE;
              return (
                <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="px-3 py-3 text-center font-bold text-gray-400">{i + 1}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                      {rec.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{rec.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  EVIDENCE BASE SECTION — references, deep-dive, full reasoning
// ═══════════════════════════════════════════════════════════════

function EvidenceBaseSection({ result, showDeepDive, setShowDeepDive, showFullReasoning, setShowFullReasoning }) {
  const refs = result.references || [];
  const hasStorm = !!result.storm_article;
  const hasP1 = !!result.p1_differential;

  if (refs.length === 0 && !hasStorm && !hasP1) return null;

  // Categorize references by quality
  const verified = refs.filter(r => r && typeof r === 'object' && r.is_verified);
  const guidelines = refs.filter(r => r && typeof r === 'object' && r.quality_tier === 'guideline');
  const retracted = refs.filter(r => r && typeof r === 'object' && r.is_retracted);

  return (
    <div className="px-6 py-5 border-b border-gray-100">
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pl-3 border-l-[3px] border-indigo-500">
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        Evidence Base
      </h2>

      {/* Summary stats bar */}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-lg font-bold text-indigo-700">{refs.length}</span>
            <span className="text-xs text-indigo-600">Sources</span>
          </div>
          {verified.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              <span className="text-lg font-bold text-green-700">{verified.length}</span>
              <span className="text-xs text-green-600">Verified</span>
            </div>
          )}
          {guidelines.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-lg border border-teal-100">
              <span className="text-lg font-bold text-teal-700">{guidelines.length}</span>
              <span className="text-xs text-teal-600">Guidelines</span>
            </div>
          )}
          {retracted.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
              <span className="text-lg font-bold text-red-700">{retracted.length}</span>
              <span className="text-xs text-red-600">Retracted</span>
            </div>
          )}
          {hasStorm && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-100">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span className="text-xs text-purple-600">STORM Deep Research</span>
            </div>
          )}
        </div>
      )}

      {/* References list */}
      {refs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">References ({refs.length})</p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {refs.map((ref, i) => {
              const isObj = ref && typeof ref === 'object';
              const title = isObj ? (ref.title || ref.name || ref.citation || String(ref)) : String(ref);
              const url = isObj ? (ref.url || ref.link || ref.doi_url || (ref.doi ? `https://doi.org/${ref.doi}` : null) || (ref.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` : null)) : null;
              const source = isObj ? (ref.source || ref.journal || ref.database) : null;
              const doi = isObj ? ref.doi : null;
              const pmid = isObj ? ref.pmid : null;
              const year = isObj ? ref.year : null;
              const qualityTier = isObj ? ref.quality_tier : null;
              const citationCount = isObj ? ref.citation_count : null;
              const isRetracted = isObj ? ref.is_retracted : false;
              const isOa = isObj ? ref.is_oa : false;
              const oaUrl = isObj ? ref.oa_url : null;

              const tierBadge = qualityTier ? {
                landmark: { label: 'Landmark', cls: 'bg-amber-100 text-amber-800' },
                strong: { label: 'Strong', cls: 'bg-green-100 text-green-800' },
                'peer-reviewed': { label: 'Peer-reviewed', cls: 'bg-blue-100 text-blue-800' },
                preprint: { label: 'Preprint', cls: 'bg-gray-100 text-gray-600' },
                guideline: { label: 'Guideline', cls: 'bg-teal-100 text-teal-800' },
                retracted: { label: 'RETRACTED', cls: 'bg-red-100 text-red-700 font-bold' },
                unverified: { label: 'Unverified', cls: 'bg-gray-50 text-gray-500' },
              }[qualityTier] : null;

              return (
                <div key={i} className={`flex gap-3 text-sm py-2 px-3 rounded-lg ${isRetracted ? 'bg-red-50 border border-red-200' : i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${isRetracted ? 'bg-red-200 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isRetracted && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded mb-1 inline-block">RETRACTED — Excluded from analysis</span>
                    )}
                    <div>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className={`hover:underline font-medium ${isRetracted ? 'text-red-600 line-through' : 'text-indigo-600 hover:text-indigo-800'}`}>
                          {title}
                        </a>
                      ) : (
                        <span className={`font-medium ${isRetracted ? 'text-red-600 line-through' : 'text-gray-800'}`}>{title}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {source && <span className="text-xs text-gray-400 italic">{source}</span>}
                      {year && <span className="text-xs text-gray-400">{year}</span>}
                      {tierBadge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tierBadge.cls}`}>{tierBadge.label}</span>
                      )}
                      {citationCount > 0 && (
                        <span className="text-[10px] text-gray-400">Cited {citationCount} times</span>
                      )}
                      {isOa && oaUrl && (
                        <a href={oaUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline">Open Access</a>
                      )}
                      {doi && (
                        <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
                          DOI
                        </a>
                      )}
                      {pmid && (
                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline">
                          PubMed
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Literature Deep-Dive (collapsible) */}
      {hasStorm && (
        <div className="rounded-lg border border-gray-200 mb-2">
          <button
            onClick={() => setShowDeepDive(!showDeepDive)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </span>
            <div className="flex-1">
              <span className="text-sm font-bold text-gray-900">Literature Deep-Dive</span>
              <span className="text-xs text-gray-400 ml-2">STORM-generated literature synthesis</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showDeepDive ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showDeepDive && (
            <div className="px-4 pb-4 ml-10 prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2 prose-li:text-gray-700">
              <FormattedMarkdown content={result.storm_article} />
            </div>
          )}
        </div>
      )}

      {/* Full AI Reasoning (collapsible) */}
      {hasP1 && (
        <div className="rounded-lg border border-gray-200">
          <button
            onClick={() => setShowFullReasoning(!showFullReasoning)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-slate-500 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </span>
            <div className="flex-1">
              <span className="text-sm font-bold text-gray-900">Full AI Reasoning</span>
              <span className="text-xs text-gray-400 ml-2">Complete differential before KG verification</span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showFullReasoning ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showFullReasoning && (
            <div className="px-4 pb-4 ml-10 prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2 prose-li:text-gray-700">
              <FormattedMarkdown content={result.p1_differential} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  SYNTHESIS ACCORDION — collapsible sections for clinical analysis
// ═══════════════════════════════════════════════════════════════

const SECTION_COLORS = {
  verdict:         { border: 'border-l-amber-500',  bg: 'bg-amber-50',  numBg: 'bg-amber-500',  numText: 'text-white' },
  safety:          { border: 'border-l-red-500',    bg: 'bg-red-50',    numBg: 'bg-red-500',    numText: 'text-white' },
  imaging:         { border: 'border-l-blue-500',   bg: 'bg-blue-50',   numBg: 'bg-blue-500',   numText: 'text-white' },
  differential:    { border: 'border-l-indigo-500', bg: 'bg-indigo-50', numBg: 'bg-indigo-500', numText: 'text-white' },
  evidence:        { border: 'border-l-purple-500', bg: 'bg-purple-50', numBg: 'bg-purple-500', numText: 'text-white' },
  gaps:            { border: 'border-l-orange-500', bg: 'bg-orange-50', numBg: 'bg-orange-500', numText: 'text-white' },
  recommendations: { border: 'border-l-green-500',  bg: 'bg-green-50',  numBg: 'bg-green-500',  numText: 'text-white' },
  disclaimer:      { border: 'border-l-gray-400',   bg: 'bg-gray-50',   numBg: 'bg-gray-400',   numText: 'text-white' },
  default:         { border: 'border-l-slate-400',  bg: 'bg-slate-50',  numBg: 'bg-slate-500',  numText: 'text-white' },
};

function SynthesisAccordion({ synthesis }) {
  const sections = parseSynthesisSections(synthesis);

  if (sections.length === 0) return null;

  // If there's only one section (no numbered headings found), render as prose
  if (sections.length === 1 && sections[0].number === null) {
    return (
      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-3 prose-li:text-gray-700 prose-strong:text-gray-900">
        <FormattedMarkdown content={synthesis} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section, i) => (
        <SynthesisSection key={i} section={section} />
      ))}
    </div>
  );
}

function SynthesisSection({ section }) {
  const [expanded, setExpanded] = useState(section.style.autoExpand);
  const colors = SECTION_COLORS[section.type] || SECTION_COLORS.default;

  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 ${colors.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors ${expanded ? colors.bg : ''}`}
      >
        {section.number && (
          <span className={`w-7 h-7 rounded-lg ${colors.numBg} ${colors.numText} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
            {section.number}
          </span>
        )}
        <span className="text-sm font-bold text-gray-900 flex-1">{section.title}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-10">
          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2 prose-li:text-gray-700 prose-strong:text-gray-900">
            <FormattedMarkdown content={section.body} />
          </div>
        </div>
      )}
    </div>
  );
}


// ── Helper ──────────────────────────────────────────────────────

function fmtMs(ms) {
  if (!ms) return '';
  return ms >= 60000
    ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;
}
