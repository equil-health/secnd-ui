import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSdssV2Store from '../stores/sdssV2Store';
import { startCase, getCaseStatus, getCaseReport, triggerDeepDive, streamCaseStatus } from '../utils/sdssV2Api';
import CaseInputForm from '../components/v2/CaseInputForm';
import PhaseAProgress from '../components/v2/PhaseAProgress';
import ReportRenderer from '../components/v2/ReportRenderer';
import DeepDiveButton from '../components/v2/DeepDiveButton';
import CaseChat from '../components/v2/CaseChat';
import AuditPanel from '../components/v2/AuditPanel';
import UserBadge from '../components/UserBadge';

export default function SecondOpinionV2Page() {
  const navigate = useNavigate();
  const sseRef = useRef(null);
  const pollRef = useRef(null);
  const elapsedRef = useRef(null);

  const caseId = useSdssV2Store((s) => s.caseId);
  const status = useSdssV2Store((s) => s.status);
  const stagesCompleted = useSdssV2Store((s) => s.stagesCompleted);
  const currentStage = useSdssV2Store((s) => s.currentStage);
  const elapsedMs = useSdssV2Store((s) => s.elapsedMs);
  const queuePosition = useSdssV2Store((s) => s.queuePosition);
  const report = useSdssV2Store((s) => s.report);
  const error = useSdssV2Store((s) => s.error);
  const auditOpen = useSdssV2Store((s) => s.auditOpen);

  const store = useSdssV2Store;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sseRef.current?.close?.();
      clearInterval(pollRef.current);
      clearInterval(elapsedRef.current);
    };
  }, []);

  // ── Submit case ────────────────────────────────────────────────
  const handleSubmit = useCallback(async ({ caseText, mode, patientContext, images }) => {
    store.getState().reset();
    store.setState({ status: 'submitting' });

    try {
      const result = await startCase({ caseText, mode, patientContext, images });
      store.getState().startCase(result.case_id, caseText, mode);
      startStatusTracking(result.case_id);
    } catch (err) {
      store.getState().setFailed(err.message);
    }
  }, []);

  // ── Status tracking (SSE preferred, polling fallback) ──────────
  function startStatusTracking(id) {
    // Elapsed timer
    const startTime = Date.now();
    elapsedRef.current = setInterval(() => {
      store.setState({ elapsedMs: Date.now() - startTime });
    }, 1000);

    // Try SSE first
    try {
      const sse = streamCaseStatus(id);
      sseRef.current = sse;

      sse.addEventListener('stage_started', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageStarted(data.stage);
      });

      sse.addEventListener('stage_completed', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageCompleted(data.stage, data.duration_ms);
      });

      sse.addEventListener('phase_complete', async (e) => {
        const data = JSON.parse(e.data);
        sse.close?.();
        sseRef.current = null;
        clearInterval(elapsedRef.current);

        store.getState().phaseAComplete();
        await fetchReport(id);
      });

      sse.addEventListener('error', (e) => {
        // SSE errors — try falling back to polling
        let errorData;
        try { errorData = JSON.parse(e.data); } catch { errorData = null; }

        if (errorData?.message) {
          sse.close?.();
          sseRef.current = null;
          clearInterval(elapsedRef.current);
          store.getState().setFailed(errorData.message);
        }
        // If it's a connection error, EventSource will auto-reconnect
      });
    } catch {
      // SSE not supported — fall back to polling
      startPolling(id);
    }
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getCaseStatus(id);
        store.getState().updateStatus(data);

        if (data.status === 'phase_a_complete') {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          store.getState().phaseAComplete();
          await fetchReport(id);
        } else if (data.status === 'phase_b_complete') {
          clearInterval(pollRef.current);
          store.getState().phaseBComplete(data.report_version);
          await fetchReport(id);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          store.getState().setFailed(data.error);
        }
      } catch (err) {
        // Ignore transient fetch errors during polling
      }
    }, 1500);
  }

  async function fetchReport(id) {
    try {
      const reportData = await getCaseReport(id, 'json');
      store.getState().setReport(reportData);
    } catch (err) {
      // Report fetch failed — not fatal, user can retry
    }
  }

  // ── Deep dive ──────────────────────────────────────────────────
  const handleDeepDive = useCallback(async () => {
    if (!caseId) return;
    try {
      await triggerDeepDive(caseId);
      store.getState().startPhaseB();
      // Start polling for Phase B completion
      startPolling(caseId);
    } catch (err) {
      // 409 means already running or complete — update status
      if (err.status === 409) {
        const data = await getCaseStatus(caseId);
        store.getState().updateStatus(data);
      }
    }
  }, [caseId]);

  // ── New case ───────────────────────────────────────────────────
  function handleNewCase() {
    sseRef.current?.close?.();
    clearInterval(pollRef.current);
    clearInterval(elapsedRef.current);
    store.getState().reset();
  }

  // ── Render ─────────────────────────────────────────────────────
  const isIdle = status === 'idle';
  const isSubmitting = status === 'submitting';
  const isRunningA = status === 'running_phase_a';
  const hasReport = !!report;
  const isFailed = status === 'failed';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Second Opinion</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Verified Clinical Decision Support</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isIdle && (
            <button
              onClick={handleNewCase}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              New Case
            </button>
          )}
          <UserBadge />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-center">
        <p className="text-[10px] text-amber-700">
          AI-generated medical information for research and educational purposes only. Not a substitute for clinical judgment.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left panel — report + progress */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Idle: show case input form */}
            {(isIdle || isSubmitting) && (
              <div>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Verified Second Opinion</h2>
                  <p className="text-sm text-gray-500 max-w-lg mx-auto">
                    Submit a clinical case for AI-powered verification. The pipeline generates a differential, fact-checks against a biomedical knowledge graph, searches medical evidence, and compiles a verified report.
                  </p>
                </div>
                <CaseInputForm onSubmit={handleSubmit} disabled={isSubmitting} />
              </div>
            )}

            {/* Running Phase A: show progress */}
            {isRunningA && (
              <PhaseAProgress
                stagesCompleted={stagesCompleted}
                currentStage={currentStage}
                elapsedMs={elapsedMs}
                queuePosition={queuePosition}
              />
            )}

            {/* Failed */}
            {isFailed && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h-14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Analysis Failed</p>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                    <button
                      onClick={handleNewCase}
                      className="mt-3 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Report */}
            {hasReport && (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-2">
                  <DeepDiveButton status={status} onTrigger={handleDeepDive} />
                  <button
                    onClick={() => store.getState().toggleAudit()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Audit Trail
                  </button>
                  {status === 'running_phase_b' && (
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                      Deep dive in progress — chat available
                    </span>
                  )}
                </div>

                <ReportRenderer report={report} />
              </>
            )}
          </div>
        </div>

        {/* Right panel — chat (shown after Phase A) */}
        {hasReport && (
          <div className="w-full max-w-md border-l border-gray-200 bg-white flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800">Discuss Report</h3>
              <p className="text-[10px] text-gray-400">Ask questions about the diagnosis, evidence, or recommendations</p>
            </div>
            <CaseChat />
          </div>
        )}
      </div>

      {/* Audit panel */}
      <AuditPanel />
    </div>
  );
}
