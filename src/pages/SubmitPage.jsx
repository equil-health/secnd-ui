import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submitCaseWithFiles } from '../utils/api';
import useAppStore from '../stores/appStore';
import usePipeline from '../hooks/usePipeline';
import PipelineTracker from '../components/PipelineTracker';

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
  const [mode, setMode] = useState('standard');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const { pipelineStatus, setActiveCase, setPipelineSteps, setPipelineStatus } = useAppStore();

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
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
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
        </nav>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 overflow-y-auto">
          {!submitted ? (
            <>
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
                onClick={handleSubmit}
                disabled={submitting || !caseText.trim()}
                className={`mt-4 w-full py-3 text-sm font-medium text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  mode === 'zebra'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitting
                  ? 'Submitting...'
                  : mode === 'zebra'
                    ? '🦓 Submit — Think Zebra'
                    : 'Submit Case'}
              </button>
            </>
          ) : (
            /* Post-submission view */
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

        {/* Sidebar pipeline tracker (visible during processing) */}
        {submitted && pipelineStatus !== 'complete' && pipelineStatus !== 'error' && (
          <aside className="hidden lg:block w-80 border-l bg-white p-4 overflow-y-auto">
            <PipelineTracker />
          </aside>
        )}
      </div>
    </div>
  );
}
