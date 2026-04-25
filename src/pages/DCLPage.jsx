// DCL v1 orchestrator page — step 1 scaffolding.
//
// Mirrors SecondOpinionV2Page.jsx status-tracking structure. Reuses
// sdssV2Store, startCase, getCaseStatus, streamCaseStatus. On
// phase_a_complete, fetches the DCL checklist via getDclChecklist and
// renders a placeholder. The real six-zone renderer, header, and
// disclaimer footer components are added in later steps.

import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSdssV2Store from '../stores/sdssV2Store';
import { startCase, getCaseStatus, streamCaseStatus } from '../utils/sdssV2Api';
import { getDclChecklist } from '../utils/dclApi';
import CaseInputForm from '../components/v2/CaseInputForm';
import CaseProgress from '../components/v2/CaseProgress';
import UserBadge from '../components/UserBadge';
import DCLChecklistRenderer from '../components/dcl/DCLChecklistRenderer';

export default function DCLPage() {
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
  const error = useSdssV2Store((s) => s.error);
  const store = useSdssV2Store;

  const [checklist, setChecklist] = useState(null);
  const [checklistError, setChecklistError] = useState(null);

  useEffect(() => {
    return () => {
      sseRef.current?.close?.();
      clearInterval(pollRef.current);
      clearInterval(elapsedRef.current);
    };
  }, []);

  const fetchChecklist = useCallback(async (id, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const payload = await getDclChecklist(id);
        setChecklist(payload);
        // Step 1 smoke signal — makes mock payload visible without a renderer
        console.log('[DCL] checklist payload:', payload);
        return;
      } catch (err) {
        console.warn(`[DCL] checklist fetch attempt ${i + 1}/${retries} failed:`, err.message);
        if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    setChecklistError('Checklist generated but could not be fetched. Check your connection and refresh.');
  }, []);

  const startPolling = useCallback((id) => {
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
          await fetchChecklist(id);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
          sseRef.current?.close?.();
          sseRef.current = null;
          store.getState().setFailed(data.error);
        }
      } catch (err) {
        console.warn('[DCL] poll error (will retry):', err.message);
      }
    }, 3000);
  }, [fetchChecklist]);

  const startStatusTracking = useCallback((id) => {
    const startTime = Date.now();
    elapsedRef.current = setInterval(() => {
      store.setState({ elapsedMs: Date.now() - startTime });
    }, 1000);

    try {
      const sse = streamCaseStatus(id);
      sseRef.current = sse;

      sse.addEventListener('stage_started', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageStarted(data.stage);
      });
      sse.addEventListener('stage_completed', (e) => {
        const data = JSON.parse(e.data);
        store.getState().stageCompleted(data.stage, data.duration_ms || 0);
      });
      sse.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        if (data.status === 'failed') {
          sse.close?.();
          sseRef.current = null;
          clearInterval(elapsedRef.current);
          store.getState().setFailed(data.error || 'Pipeline failed');
        }
      });
      sse.addEventListener('phase_complete', async () => {
        sse.close?.();
        sseRef.current = null;
        clearInterval(elapsedRef.current);
        store.getState().phaseAComplete();
        await fetchChecklist(id);
      });
      sse.addEventListener('error', (e) => {
        let errorData;
        try { errorData = JSON.parse(e.data); } catch { errorData = null; }
        if (errorData?.message) {
          sse.close?.();
          sseRef.current = null;
          clearInterval(elapsedRef.current);
          store.getState().setFailed(errorData.message);
        } else {
          sse.close?.();
          sseRef.current = null;
        }
      });
    } catch {
      // SSE unsupported — polling below handles it.
    }

    startPolling(id);
  }, [startPolling, fetchChecklist]);

  const handleSubmit = useCallback(async ({ caseText, mode, patientContext, images }) => {
    store.getState().reset();
    setChecklist(null);
    setChecklistError(null);
    store.setState({ status: 'submitting', lastSubmissionArgs: { caseText, mode, patientContext, images } });

    try {
      const result = await startCase({ caseText, mode, patientContext, images });
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
  }, [startStatusTracking]);

  const handleNewCase = useCallback(() => {
    sseRef.current?.close?.();
    clearInterval(pollRef.current);
    clearInterval(elapsedRef.current);
    store.getState().reset();
    setChecklist(null);
    setChecklistError(null);
  }, []);

  const isIdle = status === 'idle';
  const isSubmitting = status === 'submitting';
  const isQueued = status === 'queued';
  const isRunningA = status === 'running_phase_a';
  const isFailed = status === 'failed';
  const isQueueFull = status === 'queue_full';
  const hasChecklist = !!checklist;

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      {/* Placeholder header — DCLHeader.jsx replaces this in a later step */}
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
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <span className="text-[11px] font-black text-white tracking-tight">D</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight text-slate-900">Differential Check List</h1>
              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-[0.22em]">
                DCL v0.1 · Internal
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

      {/* Persistent disclaimer — DCLDisclaimerFooter.jsx moves this to footer later */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-1.5 text-center">
        <p className="text-[10px] text-amber-800 font-medium">
          <span className="text-amber-600 mr-1.5">⚠</span>
          DCL provides a checklist, not a diagnosis. Decisions rest with you and your seniors.
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {(isIdle || isSubmitting) && (
              <div>
                <div className="mb-8">
                  <div className="eyebrow text-indigo-600 mb-3">New Case</div>
                  <h2 className="display-hero text-4xl sm:text-5xl text-slate-900">
                    Describe the case.
                  </h2>
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-xl">
                    We'll compile a six-zone checklist — safety alerts, treatment holds, a ranked differential, and next steps — to review alongside your own impression.
                  </p>
                </div>
                <CaseInputForm onSubmit={handleSubmit} disabled={isSubmitting} mode="dcl" />
              </div>
            )}

            {(isQueued || isRunningA) && (
              <CaseProgress
                caseText={caseText}
                patientContext={lastSubmissionArgs?.patientContext}
                elapsedMs={elapsedMs}
                queued={isQueued}
                queueInfo={queueInfo}
              />
            )}

            {isQueueFull && (
              <div className="relative overflow-hidden rounded-xl bg-white border border-amber-200 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                <div className="p-5 pl-6">
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
            )}

            {isFailed && (
              <div className="relative overflow-hidden rounded-xl bg-white border border-red-200 shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                <div className="p-5 pl-6">
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
            )}

            {checklistError && !hasChecklist && (
              <div className="rounded-xl bg-white border border-red-200 p-5 text-sm text-red-700">
                {checklistError}
              </div>
            )}

            {hasChecklist && (
              <DCLChecklistRenderer checklist={checklist} onNewCase={handleNewCase} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

