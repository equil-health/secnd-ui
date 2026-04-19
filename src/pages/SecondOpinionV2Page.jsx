import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSdssV2Store from '../stores/sdssV2Store';
import { startCase, getCaseStatus, getCaseReport, triggerDeepDive, streamCaseStatus } from '../utils/sdssV2Api';
import CaseInputForm from '../components/v2/CaseInputForm';
import CaseProgress from '../components/v2/CaseProgress';
import ReportRenderer from '../components/v2/ReportRenderer';
import DeepDiveButton from '../components/v2/DeepDiveButton';
import CaseChat from '../components/v2/CaseChat';
import AuditPanel from '../components/v2/AuditPanel';
import UserBadge from '../components/UserBadge';
import { exportV2PDF, exportV2DOCX, exportV2HTML } from '../utils/sdssV2Export';

export default function SecondOpinionV2Page() {
  const navigate = useNavigate();
  const sseRef = useRef(null);
  const pollRef = useRef(null);
  const elapsedRef = useRef(null);

  const caseId = useSdssV2Store((s) => s.caseId);
  const status = useSdssV2Store((s) => s.status);
  const caseText = useSdssV2Store((s) => s.caseText);
  const elapsedMs = useSdssV2Store((s) => s.elapsedMs);
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
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      {/* Top bar — white/blur, matches landing */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/70 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-900 transition p-1 -ml-1"
            title="Back to home"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-[11px] font-black text-white tracking-tight">S</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight text-slate-900">Second Opinion</h1>
              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-[0.22em]">
                Verified · v2
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isIdle && (
            <button
              onClick={handleNewCase}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition"
            >
              New Case
            </button>
          )}
          <UserBadge />
        </div>
      </div>

      {/* Disclaimer strip — slim, pastel-amber */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-1.5 text-center">
        <p className="text-[10px] text-amber-800 font-medium">
          <span className="text-amber-600 mr-1.5">⚠</span>
          AI-generated for research and education only. Not a substitute for clinical judgment.
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
                <div className="mb-8">
                  <div className="eyebrow text-indigo-600 mb-3">New Case</div>
                  <h2 className="display-hero text-4xl sm:text-5xl text-slate-900">
                    Describe the case.
                  </h2>
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-xl">
                    We'll generate a differential, verify against a biomedical knowledge graph, cross-check the literature, and compile a report you can act on.
                  </p>
                </div>
                <CaseInputForm onSubmit={handleSubmit} disabled={isSubmitting} />
              </div>
            )}

            {/* Queued or running Phase A: case preview + ruminating card */}
            {(isQueued || isRunningA) && (
              <CaseProgress
                caseText={caseText}
                patientContext={lastSubmissionArgs?.patientContext}
                elapsedMs={elapsedMs}
                queued={isQueued}
                queueInfo={queueInfo}
              />
            )}

            {/* Queue full — amber status card */}
            {isQueueFull && (
              <div className="relative overflow-hidden rounded-xl bg-white border border-amber-200 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                <div className="p-5 pl-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">System at capacity</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {error || 'SECND is processing the maximum number of cases.'}
                      </p>
                      {queueInfo && (
                        <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                          {queueInfo.in_flight} in flight · {queueInfo.max_workers} worker{queueInfo.max_workers === 1 ? '' : 's'} · queue max {queueInfo.queue_max}
                          {retryAfter ? ` · retry in ~${retryAfter}s` : ''}
                        </p>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => lastSubmissionArgs && handleSubmit(lastSubmissionArgs)}
                          disabled={!lastSubmissionArgs}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md transition disabled:opacity-50"
                        >
                          Retry submission
                        </button>
                        <button
                          onClick={handleNewCase}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition"
                        >
                          Start over
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Failed — red status card */}
            {isFailed && (
              <div className="relative overflow-hidden rounded-xl bg-white border border-red-200 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                <div className="p-5 pl-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h-14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Analysis failed</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{error}</p>
                      <button
                        onClick={handleNewCase}
                        className="mt-4 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md transition"
                      >
                        Try again
                      </button>
                    </div>
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
                <div className="flex items-center gap-2 flex-wrap border-y border-slate-200 py-2.5 -mx-1 px-1">
                  <button
                    onClick={() => store.getState().toggleAudit()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Audit Trail
                  </button>
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[9px] text-slate-400 uppercase tracking-[0.22em] font-semibold mr-2">
                      Export
                    </span>
                    <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden divide-x divide-slate-200">
                      <button
                        onClick={() => { try { exportV2PDF(report); } catch (e) { alert(e.message); } }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => { try { exportV2DOCX(report); } catch (e) { alert(e.message); } }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        DOCX
                      </button>
                      <button
                        onClick={() => { try { exportV2HTML(report); } catch (e) { alert(e.message); } }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        HTML
                      </button>
                    </div>
                  </div>
                </div>

                <ReportRenderer report={report} />
              </>
            )}
          </div>
        </div>

        {/* Right panel — chat (shown after Phase A) */}
        {hasReport && (
          <div className="w-full max-w-md border-l border-slate-200 bg-white flex flex-col">
            <div className="relative overflow-hidden px-4 py-3 border-b border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: 'radial-gradient(ellipse at top right, rgba(125,211,252,0.3), transparent 55%), radial-gradient(ellipse at bottom left, rgba(167,243,208,0.25), transparent 55%)',
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="eyebrow text-emerald-700">Discuss Report</h3>
                </div>
                <p className="text-[11px] text-slate-700 mt-1 leading-snug">
                  Ask about the diagnosis, evidence, treatment holds, or next steps.
                </p>
              </div>
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
