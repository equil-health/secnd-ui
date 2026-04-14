import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useMedChat from '../hooks/useMedChat';
import useChatStore from '../stores/chatStore';
import useSdssPolling from '../hooks/useSdssPolling';
import ChatMessage from '../components/ChatMessage';
import UserBadge from '../components/UserBadge';
import FormattedMarkdown from '../utils/formatReport';
import { sdssGetTask, chatAnalyze } from '../utils/api';
import { localChatTranscribe as chatTranscribe } from '../utils/localMedasr';


// Pipeline stages
const STAGES = [
  { label: 'Analysing case with AI', est: 480 },
  { label: 'Extracting clinical triplets', est: 15 },
  { label: 'Verifying against knowledge graph', est: 480 },
  { label: 'Synthesising second opinion', est: 20 },
];

// File constraints
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

export default function ChatPage() {
  const { taskId: routeTaskId } = useParams();
  const navigate = useNavigate();
  const { messages, sendMessage, isStreaming, streamingContent, stopStreaming } = useMedChat();
  const {
    taskId, reportLabel, setTaskContext, clearTaskContext, clearChat,
    analysisTaskId, analysisStatus, addMessage,
    startAnalysis, setAnalysisStatus, completeAnalysis, failAnalysis,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState('standard');
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);
  const [analyzeStage, setAnalyzeStage] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const plusMenuRef = useRef(null);

  // Poll for analysis result
  const { status: pollStatus, result: pollResult, error: pollError, reset: resetPoll } = useSdssPolling(analysisTaskId);

  // Load report context if taskId is in the route
  useEffect(() => {
    if (!routeTaskId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await sdssGetTask(routeTaskId);
        if (cancelled) return;
        const result = data.result || {};
        setTaskContext(routeTaskId, result.top_diagnosis || 'SDSS Report');
      } catch {
        setTaskContext(routeTaskId, 'SDSS Report');
      }
    })();
    return () => { cancelled = true; };
  }, [routeTaskId, setTaskContext]);

  // Handle analysis poll results
  useEffect(() => {
    if (pollStatus === 'complete' && pollResult) {
      const topDx = pollResult.top_diagnosis || 'SDSS Report';
      addMessage({
        role: 'assistant',
        content: _buildReportSummary(pollResult),
        ts: new Date().toISOString(),
        isReport: true,
      });
      completeAnalysis(analysisTaskId, topDx);
      resetPoll();
      clearInterval(timerRef.current);
      clearTimeout(stageTimerRef.current);
    } else if (pollStatus === 'failed') {
      addMessage({
        role: 'assistant',
        content: `**Analysis failed:** ${pollError || 'The GPU pod could not complete the analysis. Please try again.'}`,
        ts: new Date().toISOString(),
        error: true,
      });
      failAnalysis();
      resetPoll();
      clearInterval(timerRef.current);
      clearTimeout(stageTimerRef.current);
    } else if (pollStatus === 'processing') {
      setAnalysisStatus('processing');
    }
  }, [pollStatus, pollResult, pollError]);

  // Elapsed timer for analysis
  useEffect(() => {
    if (analysisTaskId && analysisStatus) {
      const start = Date.now();
      setAnalyzeElapsed(0);
      setAnalyzeStage(0);
      timerRef.current = setInterval(
        () => setAnalyzeElapsed(Math.floor((Date.now() - start) / 1000)), 1000
      );
      let idx = 0;
      const advance = () => {
        idx++;
        if (idx < STAGES.length) {
          setAnalyzeStage(idx);
          stageTimerRef.current = setTimeout(advance, STAGES[idx].est * 1000);
        }
      };
      stageTimerRef.current = setTimeout(advance, STAGES[0].est * 1000);
      return () => {
        clearInterval(timerRef.current);
        clearTimeout(stageTimerRef.current);
      };
    }
  }, [analysisTaskId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, analyzeElapsed]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // Close plus menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setShowPlusMenu(false);
      }
    }
    if (showPlusMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPlusMenu]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  // ── Voice input (MediaRecorder → MedASR) ─────────────────────
  async function toggleVoice() {
    if (isRecording) {
      // Stop recording — the onstop handler will send to MedASR
      mediaRecorderRef.current?.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      return;
    }

    setFileError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all mic tracks
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        if (audioBlob.size < 1000) {
          // Too short, ignore
          return;
        }

        // Send to MedASR
        setIsTranscribing(true);
        try {
          const { text } = await chatTranscribe(audioBlob);
          if (text && text.trim()) {
            setInput((prev) => prev ? `${prev} ${text.trim()}` : text.trim());
            textareaRef.current?.focus();
          }
        } catch (err) {
          setFileError(`Transcription failed: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // collect in 250ms chunks
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration counter
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setFileError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setFileError(`Could not access microphone: ${err.message}`);
      }
    }
  }

  // ── File management ──────────────────────────────────────────
  const addFiles = useCallback((newFiles) => {
    setFileError(null);
    const valid = [];
    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setFileError(`Unsupported file: ${f.name}. Allowed: PDF, DOCX, JPG, PNG.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`File too large: ${f.name} (${formatSize(f.size)}). Max 50 MB.`);
        return;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  // Drag and drop
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
  };

  // ── Actions ──────────────────────────────────────────────────
  async function handleAnalyze() {
    const caseText = input.trim();
    if (!caseText && files.length === 0) return;

    setShowAnalyzeModal(false);
    setShowPlusMenu(false);

    const fileNames = files.map((f) => f.name);
    const displayParts = [];
    if (caseText) displayParts.push(caseText);
    if (fileNames.length > 0) displayParts.push(`\n*Attached: ${fileNames.join(', ')}*`);

    addMessage({ role: 'user', content: displayParts.join('\n'), ts: new Date().toISOString() });
    addMessage({
      role: 'assistant',
      content: `**Starting SDSS analysis** (${analyzeMode} mode)${files.length > 0 ? ` with ${files.length} file${files.length > 1 ? 's' : ''}` : ''}...\nRunning the full second-opinion pipeline. Progress below.`,
      ts: new Date().toISOString(),
      isSystem: true,
    });

    const submitFiles = [...files];
    setInput('');
    setFiles([]);

    try {
      const { task_id } = await chatAnalyze(caseText, analyzeMode, submitFiles);
      startAnalysis(task_id, caseText);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `**Failed to start analysis:** ${err.message}`,
        ts: new Date().toISOString(),
        error: true,
      });
    }
  }

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
    sendMessage(input);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    clearChat();
    resetPoll();
    setFiles([]);
    setFileError(null);
    if (isRecording) { mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setIsRecording(false); }
    clearInterval(timerRef.current);
    clearTimeout(stageTimerRef.current);
    if (routeTaskId) navigate('/chat');
  }

  const isAnalyzing = !!analysisTaskId;
  const hasInput = input.trim() || files.length > 0;
  const inputDisabled = isStreaming || isAnalyzing || isTranscribing;

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-indigo-600/10 border-4 border-dashed border-indigo-400 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-center">
            <svg className="w-12 h-12 text-indigo-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-lg font-semibold text-indigo-700">Drop clinical files here</p>
            <p className="text-sm text-gray-500">PDF, DOCX, JPG, PNG (max 50 MB)</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SDSS Chat</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Clinical AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            New Chat
          </button>
          <UserBadge />
        </div>
      </div>

      {/* Report context banner */}
      {taskId && reportLabel && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <span className="text-sm text-indigo-700">
              Report loaded: <strong>{reportLabel}</strong> — follow-up questions use full report context
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/second-opinion/${taskId}`} className="text-xs text-indigo-500 hover:text-indigo-700 transition underline">
              View Report
            </Link>
            <button onClick={clearTaskContext} className="text-xs text-indigo-500 hover:text-indigo-700 transition">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center mb-6">
            <p className="text-xs text-amber-700">
              AI-generated medical information for research and educational purposes only.
              Not a substitute for clinical judgment. Always consult a qualified healthcare professional.
            </p>
          </div>

          {/* Empty state */}
          {messages.length === 0 && !isStreaming && !isAnalyzing && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {taskId ? 'Explore this report' : 'Clinical AI Chat'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {taskId
                  ? 'The full SDSS report is loaded. Ask follow-up questions about the diagnosis, evidence, or clinical implications.'
                  : 'Ask a clinical question, attach files, or use voice input. Use + for more options including full SDSS pipeline analysis.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {taskId ? (
                  ['Why was this the top diagnosis?', 'What are the key safety flags?', 'Suggest additional workup', 'Explain the evidence quality'].map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                      className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition">
                      {q}
                    </button>
                  ))
                ) : (
                  ['Differential diagnosis for acute chest pain in a 45yo male', 'Interpret elevated troponin with normal ECG', 'Workup for unexplained weight loss in elderly'].map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                      className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition">
                      {q}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {/* Inline analysis progress card */}
          {isAnalyzing && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-sm font-semibold text-purple-800">SDSS Pipeline Running</span>
                <span className="text-xs text-purple-500 ml-auto">{_formatTime(analyzeElapsed)}</span>
              </div>
              <div className="space-y-2">
                {STAGES.map((stage, i) => {
                  const isDone = i < analyzeStage;
                  const isActive = i === analyzeStage;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {isDone ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-4 h-4 flex-shrink-0">
                          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 flex-shrink-0">
                          <div className="w-3 h-3 rounded-full bg-gray-200 mx-auto" />
                        </div>
                      )}
                      <span className={isDone ? 'text-green-700' : isActive ? 'text-purple-700 font-medium' : 'text-gray-400'}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm">
                <FormattedMarkdown content={streamingContent} />
                <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attached files preview */}
      {files.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 sm:px-6 py-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
                <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {fileIcon(f.type)}
                </span>
                <span className="text-gray-700 max-w-[150px] truncate">{f.name}</span>
                <span className="text-gray-400">{formatSize(f.size)}</span>
                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition ml-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error bar */}
      {fileError && (
        <div className="bg-red-50 border-t border-red-200 px-4 sm:px-6 py-1.5">
          <p className="text-xs text-red-600 max-w-3xl mx-auto">{fileError}</p>
        </div>
      )}

      {/* ── Input bar (ChatGPT-style) ──────────────────────────── */}
      <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-2 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">

            {/* + Button with menu */}
            <div className="relative" ref={plusMenuRef}>
              <button
                onClick={() => { setShowPlusMenu(!showPlusMenu); setShowAnalyzeModal(false); }}
                disabled={inputDisabled}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0"
                title="More options"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              {/* Plus menu dropdown */}
              {showPlusMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-20">
                  {/* Upload files */}
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    Upload photos & files
                  </button>

                  <div className="border-t border-gray-100 my-1" />

                  {/* Run SDSS Analysis */}
                  <button
                    onClick={() => { setShowPlusMenu(false); setShowAnalyzeModal(true); }}
                    disabled={!hasInput}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5" />
                    </svg>
                    <div>
                      <span className="font-medium">SDSS Analysis</span>
                      <span className="block text-[10px] text-gray-400">Full second-opinion pipeline</span>
                    </div>
                  </button>

                  {/* Deep Research */}
                  <button
                    onClick={() => { setShowPlusMenu(false); navigate('/research'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                  >
                    <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <div>
                      <span className="font-medium">Deep Research</span>
                      <span className="block text-[10px] text-gray-400">Research Base article generation</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording ? 'Recording... tap mic to stop'
                : isTranscribing ? 'Transcribing with MedASR...'
                : isAnalyzing ? 'Analysis in progress...'
                : isStreaming ? 'Waiting for response...'
                : 'Ask anything'
              }
              disabled={inputDisabled}
              rows={1}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-sm focus:outline-none disabled:text-gray-400 placeholder:text-gray-400"
            />

            {/* Mic button */}
            {isTranscribing ? (
              // Transcribing state
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">
                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Transcribing...</span>
              </div>
            ) : (
              <button
                onClick={toggleVoice}
                disabled={inputDisabled && !isRecording}
                title={isRecording ? `Recording ${_formatTime(recordingDuration)} — tap to stop` : 'Voice input (MedASR)'}
                className={`p-2 rounded-full transition flex-shrink-0 ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {isRecording ? (
                  // Recording indicator — pulsing red dot + duration
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-mono font-medium">{_formatTime(recordingDuration)}</span>
                  </div>
                ) : (
                  // Mic icon
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}

            {/* Send / Stop button */}
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-full bg-gray-800 hover:bg-gray-900 text-white transition flex-shrink-0"
                title="Stop generating"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isAnalyzing}
                className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white disabled:text-gray-400 transition flex-shrink-0"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            )}
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-2">
            SECND Chat can make mistakes. Verify clinical information independently.
          </p>
        </div>
      </div>

      {/* Analyze mode modal */}
      {showAnalyzeModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={() => setShowAnalyzeModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-1">Run SDSS Analysis</h3>
            <p className="text-xs text-gray-500 mb-4">
              Submit the case text{files.length > 0 ? ` and ${files.length} file${files.length > 1 ? 's' : ''}` : ''} to the full second-opinion pipeline.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: 'standard', label: 'Standard', desc: 'Evidence-backed verification', color: 'indigo' },
                { id: 'zebra', label: 'Think Zebra', desc: 'Rare disease differential discovery', color: 'amber' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAnalyzeMode(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition ${
                    analyzeMode === m.id
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm font-semibold text-gray-800">{m.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalyzeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition"
              >
                Start Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => { if (e.target.files.length) addFiles([...e.target.files]); e.target.value = ''; }}
      />
    </div>
  );
}


// ── Helpers ────────────────────────────────────────────────────

function _formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function _buildReportSummary(result) {
  const parts = ['**SDSS Analysis Complete**\n'];

  if (result.top_diagnosis) {
    parts.push(`**Top Diagnosis:** ${result.top_diagnosis}\n`);
  }

  if (result.differential && result.differential.length > 0) {
    parts.push('**Differential:**');
    result.differential.slice(0, 5).forEach((dx) => {
      if (typeof dx === 'object') {
        const name = dx.diagnosis || dx.name || '';
        const score = dx.confidence || dx.score || '';
        parts.push(`- ${name}${score ? ` (${score})` : ''}`);
      } else {
        parts.push(`- ${dx}`);
      }
    });
    parts.push('');
  }

  if (result.safety_flags && result.safety_flags.length > 0) {
    parts.push('**Safety Flags:**');
    result.safety_flags.forEach((f) => parts.push(`- ${f}`));
    parts.push('');
  }

  parts.push('*The full report is now loaded as context. Ask me anything about this case.*');

  return parts.join('\n');
}
