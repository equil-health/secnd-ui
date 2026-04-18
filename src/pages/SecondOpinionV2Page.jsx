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
  const queueInfo = useSdssV2Store((s) => s.queueInfo);
  const retryAfter = useSdssV2Store((s) => s.retryAfter);
  const lastSubmissionArgs = useSdssV2Store((s) => s.lastSubmissionArgs);
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
    store.setState({ status: 'submitting', lastSubmissionArgs: { caseText, mode, patientContext, images } });

    try {
      const result = await startCase({ caseText, mode, patientContext, images });
      // Backend now returns status="queued"; worker flips to running_phase_a
      // when it picks up the task. Render progress for both states.
      store.getState().startCase(result.case_id, caseText, mode, result.status || 'queued');
      startStatusTracking(result.case_id);
    } catch (err) {
      if (err.code === 'queue_full') {
        store.getState().setQueueFull({
          message: err.message,
          queueInfo: err.queueDepth,
          retryAfter: err.retryAfter,
          args: { caseText, mode, patientContext, images },
        });
      } else {
        store.getState().setFailed(err.message);
      }
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

      // Per-stage SSE events (both mock and real backend emit these)
      sse.addEventListener('stage_started', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageStarted(data.stage);
      });

      sse.addEventListener('stage_completed', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageCompleted(data.stage, data.duration_ms || 0);
      });

      // Real backend SSE events (disk-poll based, 2s intervals)
      sse.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        // Backend sends {status: "running_phase_a"} — use it to confirm phase
        if (data.status === 'failed') {
          sse.close?.();
          sseRef.current = null;
          clearInterval(elapsedRef.current);
          store.getState().setFailed(data.error || 'Pipeline failed');
        }
      });

      sse.addEventListener('report_ready', (e) => {
        // Backend emits when a new report version is written to disk
        // We'll fetch it on phase_complete
      });

      sse.addEventListener('phase_complete', async (e) => {
        const data = JSON.parse(e.data);
        sse.close?.();
        sseRef.current = null;
        clearInterval(elapsedRef.current);

        // Backend sends {status, report_version} — handle both Phase A and B
        if (data.status === 'phase_b_complete') {
          store.getState().phaseBComplete(data.report_version);
        } else {
          store.getState().phaseAComplete();
        }
        await fetchReport(id);
      });

      sse.addEventListener('error', (e) => {
        // SSE connection dropped (common with ngrok/cloudflared tunnels)
        // Check if it's a backend error event with data, or a connection drop
        let errorData;
        try { errorData = JSON.parse(e.data); } catch { errorData = null; }

        if (errorData?.message) {
          // Backend sent an explicit error — fatal
          sse.close?.();
          sseRef.current = null;
          clearInterval(elapsedRef.current);
          store.getState().setFailed(errorData.message);
        } else {
          // Connection drop — close SSE, let polling handle it
          console.warn('SSE connection dropped — polling will continue');
          sse.close?.();
          sseRef.current = null;
        }
      });
    } catch {
      // SSE not supported — fall back to polling
      startPolling(id);
    }

    // Always poll alongside SSE — SSE may drop through tunnels (ngrok/cloudflared)
    // and polling is the reliable fallback for both progress and completion
    startPolling(id);
  }

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getCaseStatus(id);
        store.getState().updateStatus(data);

        if (data.status === 'phase_a_complete') {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          sseRef.current?.close?.();
          sseRef.current = null;
          store.getState().phaseAComplete();
          await fetchReport(id);
        } else if (data.status === 'phase_b_complete') {
          clearInterval(pollRef.current);
          sseRef.current?.close?.();
          sseRef.current = null;
          store.getState().phaseBComplete(data.report_version);
          await fetchReport(id);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          sseRef.current?.close?.();
          sseRef.current = null;
          store.getState().setFailed(data.error);
        }
      } catch (err) {
        // Transient tunnel errors — keep polling, don't give up
        console.warn('Poll error (will retry):', err.message);
      }
    }, 3000);
  }

  async function fetchReport(id, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const reportData = await getCaseReport(id, 'json');
        store.getState().setReport(reportData);
        return;
      } catch (err) {
        console.warn(`Report fetch attempt ${i + 1}/${retries} failed:`, err.message);
        if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    // All retries failed — set error so user sees something
    store.getState().setFailed('Report generated but could not be fetched. Check your connection and refresh.');
  }

  // ── Deep dive ──────────────────────────────────────────────────
  const handleDeepDive = useCallback(async () => {
    if (!caseId) return;
    try {
      const result = await triggerDeepDive(caseId);
      // Backend returns status="queued" — the worker flips to running_phase_b
      // when it picks up. Treat both as "Phase B in progress" for the UI.
      store.setState({ status: result?.status === 'queued' ? 'queued' : 'running_phase_b', phaseBElapsedMs: 0 });
      startPolling(caseId);
    } catch (err) {
      if (err.code === 'queue_full') {
        // Backend rolled state back to phase_a_complete; tell the user to retry.
        alert(err.message + (err.retryAfter ? ` Retry in ~${err.retryAfter}s.` : ''));
      } else if (err.status === 409) {
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
  const isQueued = status === 'queued';
  const isRunningA = status === 'running_phase_a';
  const hasReport = !!report;
  const isFailed = status === 'failed';
  const isQueueFull = status === 'queue_full';

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
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

            {/* Queued or running Phase A: show progress timeline */}
            {(isQueued || isRunningA) && (
              <PhaseAProgress
                stagesCompleted={stagesCompleted}
                currentStage={currentStage}
                elapsedMs={elapsedMs}
                queuePosition={queuePosition}
                queueInfo={queueInfo}
                queued={isQueued}
              />
            )}

            {/* Queue full — friendly 503 with retry */}
            {isQueueFull && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">System at capacity</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {error || 'SDSS is processing the maximum number of cases.'}
                    </p>
                    {queueInfo && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        {queueInfo.in_flight} case{queueInfo.in_flight === 1 ? '' : 's'} in progress
                        {queueInfo.max_workers ? ` (${queueInfo.max_workers} worker${queueInfo.max_workers === 1 ? '' : 's'}, queue ${queueInfo.queue_max})` : ''}.
                        {retryAfter ? ` Retry in ~${retryAfter}s.` : ''}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => lastSubmissionArgs && handleSubmit(lastSubmissionArgs)}
                        disabled={!lastSubmissionArgs}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition disabled:opacity-50"
                      >
                        Retry submission
                      </button>
                      <button
                        onClick={handleNewCase}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition"
                      >
                        Start over
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                {/* Deep Dive CTA */}
                <DeepDiveButton status={status} onTrigger={handleDeepDive} />

                {/* Secondary toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => store.getState().toggleAudit()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Audit Trail
                  </button>
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
