import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submitCaseWithFiles, queryMedGemma } from '../utils/api';
import useAppStore from '../stores/appStore';
import usePipeline from '../hooks/usePipeline';
import PipelineTracker from '../components/PipelineTracker';
import SecondOpinionPanel from '../components/SecondOpinionPanel';
import UserBadge from '../components/UserBadge';
import useAuthStore from '../stores/authStore';
import useToastStore from '../stores/toastStore';
import { getMe } from '../utils/api';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function fileIcon(type) {
  if (type === 'application/pdf') return 'PDF';
  if (type.includes('wordprocessingml') || type.includes('msword')) return 'DOC';
  if (type.startsWith('image/')) return 'IMG';
  return 'FILE';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitPage() {
  const navigate = useNavigate();
  const [caseText, setCaseText] = useState('');
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('medgemma');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState(null);
  const [medgemmaResult, setMedgemmaResult] = useState(null);
  const [medgemmaLoading, setMedgemmaLoading] = useState(false);
  const [indiaContext, setIndiaContext] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const { pipelineStatus, setActiveCase, setPipelineSteps, setPipelineStatus } = useAppStore();
  const { user, updateUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const isDemo = user?.is_demo;
  const maxReports = user?.max_reports;
  const reportsUsed = user?.reports_used ?? 0;
  const remaining = maxReports != null ? maxReports - reportsUsed : null;
  const atLimit = isDemo && remaining != null && remaining <= 0;

  // Connect pipeline WebSocket after submission
  usePipeline(caseId);

  // Navigate to report when pipeline completes
  useEffect(() => {
    if (pipelineStatus === 'complete' && caseId) {
      const timer = setTimeout(() => navigate(`/report/${caseId}`), 1500);
      return () => clearTimeout(timer);
    }
  }, [pipelineStatus, caseId, navigate]);

  const addFiles = useCallback((newFiles) => {
    const valid = [];
    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not a supported file type. Use PDF, DOCX, JPG, or PNG.`);
        return;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" exceeds the 50MB size limit.`);
        return;
      }
      valid.push(f);
    }
    setError(null);
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSubmit = async () => {
    if (!caseText.trim()) {
      setError('Please describe the case before submitting.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('case_text', caseText.trim());
      formData.append('mode', mode);
      for (const f of files) {
        formData.append('files', f);
      }

      // Reset pipeline state
      setPipelineSteps([]);
      setPipelineStatus(null);

      const result = await submitCaseWithFiles(formData);
      setCaseId(result.id);
      setActiveCase(result);
      setSubmitted(true);
      addToast('Case submitted — pipeline started', 'success');

      // Refresh user profile to update reports_used
      try {
        const me = await getMe();
        updateUser(me);
        if (me.is_demo && me.max_reports != null) {
          const rem = me.max_reports - me.reports_used;
          if (rem <= 2 && rem > 0) addToast(`You have ${rem} report${rem === 1 ? '' : 's'} remaining`, 'warning');
        }
      } catch {}

    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMedGemmaSubmit = async () => {
    if (!caseText.trim()) {
      setError('Please describe the case before submitting.');
      return;
    }
    setError(null);
    setMedgemmaLoading(true);
    setMedgemmaResult(null);
    setSubmitted(true);

    try {
      const query = caseText.trim() + '\n\nI need a second opinion on this case.';
      const data = await queryMedGemma(query, indiaContext);
      setMedgemmaResult(data);
      addToast('Analysis complete', 'success');
    } catch (err) {
      setError(err.message || 'Query failed. Please try again.');
      setSubmitted(false);
    } finally {
      setMedgemmaLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
        <Link to="/" className="text-lg font-semibold text-indigo-700 hover:text-indigo-800">
          SECND Opinion
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/app" className="text-sm text-gray-500 hover:text-gray-700">
            Chat
          </Link>
          <Link to="/history" className="text-sm text-gray-500 hover:text-gray-700">
            History
          </Link>
          <UserBadge />
        </nav>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 overflow-y-auto">
          {!submitted ? (
            <>
              {/* Demo limit banner */}
              {isDemo && remaining != null && remaining > 0 && remaining <= 2 && (
                <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  You have <strong>{remaining} of {maxReports}</strong> reports remaining
                </div>
              )}
              {atLimit && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
                  <strong>Report limit reached</strong> — contact admin for more access
                </div>
              )}

              {/* Welcome */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800">Submit a Case</h2>
                <p className="text-gray-500 mt-2">
                  Describe the clinical case and attach any relevant medical documents.
                </p>
              </div>

              {/* Drag-drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="text-gray-400 text-4xl mb-2">+</div>
                <p className="text-sm text-gray-500">
                  Drag & drop files here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, DOCX, JPG, PNG — up to 50MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files.length) addFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
              </div>

              {/* File chips */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full text-sm"
                    >
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {fileIcon(f.type)}
                      </span>
                      <span className="text-gray-700 truncate max-w-[200px]">{f.name}</span>
                      <span className="text-gray-400 text-xs">{formatSize(f.size)}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Mode selector */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Mode
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('medgemma')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      mode === 'medgemma'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${mode === 'medgemma' ? 'text-indigo-700' : 'text-gray-700'}`}>
                      Standard
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Second opinion on referring diagnosis
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('zebra')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      mode === 'zebra'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${mode === 'zebra' ? 'text-amber-700' : 'text-gray-700'}`}>
                      🦓 Think Zebra
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Rare disease differential — Orphanet, OMIM, GARD
                    </p>
                  </button>
                </div>
              </div>

              {/* India context toggle */}
              {mode === 'medgemma' && (
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={indiaContext}
                      onChange={(e) => setIndiaContext(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    India clinical context
                  </label>
                </div>
              )}

              {/* Text area */}
              <textarea
                ref={textareaRef}
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                placeholder="Describe the clinical case... Include patient demographics, presenting complaint, medical history, exam findings, lab results, imaging, and the referring diagnosis."
                className="mt-4 w-full h-48 px-4 py-3 border rounded-xl resize-y text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />

              {/* Error */}
              {error && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={mode === 'medgemma' ? handleMedGemmaSubmit : handleSubmit}
                disabled={submitting || medgemmaLoading || !caseText.trim() || atLimit}
                className={`mt-4 w-full py-3 text-sm font-medium text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  mode === 'zebra'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitting || medgemmaLoading
                  ? 'Submitting...'
                  : mode === 'zebra'
                    ? '🦓 Submit — Think Zebra'
                    : 'Submit Case'}
              </button>
            </>
          ) : mode === 'medgemma' ? (
            /* Post-submission view */
            <div className="space-y-6">
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Clinical Query</h3>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Second Opinion</span>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                  {caseText}
                </p>
              </div>

              <SecondOpinionPanel
                loading={medgemmaLoading}
                result={medgemmaResult}
                error={error}
              />

              {/* New query button */}
              {medgemmaResult && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setMedgemmaResult(null);
                      setError(null);
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Submit another query
                  </button>
                </div>
              )}

              {error && !medgemmaLoading && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setMedgemmaResult(null);
                      setError(null);
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Standard/Zebra post-submission view */
            <div className="space-y-6">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Case Submitted</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                  {caseText}
                </p>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                      >
                        <span className="font-bold text-indigo-600">{fileIcon(f.type)}</span>
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipeline progress */}
              <PipelineTracker />

              {pipelineStatus === 'complete' && (
                <div className="text-center">
                  <p className="text-green-600 font-medium mb-2">Analysis complete!</p>
                  <p className="text-sm text-gray-500">Redirecting to report...</p>
                </div>
              )}

              {pipelineStatus === 'error' && (
                <div className="text-center">
                  <p className="text-red-600 font-medium mb-2">Pipeline encountered an error.</p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setCaseId(null);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar pipeline tracker (visible during processing, not for MedGemma) */}
        {submitted && mode !== 'medgemma' && pipelineStatus !== 'complete' && pipelineStatus !== 'error' && (
          <aside className="hidden lg:block w-80 border-l bg-white p-4 overflow-y-auto">
            <PipelineTracker />
          </aside>
        )}
      </div>
    </div>
  );
}
