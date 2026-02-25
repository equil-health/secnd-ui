import { useCallback, useRef } from 'react';
import useAppStore from '../stores/appStore';
import { getReport, getCase } from '../utils/api';

/**
 * Pipeline step definitions with simulated durations (ms).
 * These mirror the real pipeline steps from tasks.py.
 */
const SIM_STEPS = [
  { step: 0, label: 'Case accepted', duration: 400 },
  { step: 1, label: 'MedGemma analyzing case...', duration: 3500, preview: 'Generating clinical analysis...' },
  { step: 2, label: 'Cleaning output...', duration: 1200, preview: 'Removing duplication' },
  { step: 3, label: 'Validating claims...', duration: 2000, preview: 'Checking for hallucinations' },
  { step: 4, label: 'Extracting key claims...', duration: 1800, preview: 'Identifying verifiable claims' },
  { step: 5, label: 'Searching evidence...', duration: 2500, preview: 'Querying medical databases' },
  { step: 6, label: 'Verifying citations (OpenAlex)...', duration: 2200, preview: 'Cross-referencing 250M+ works' },
  { step: 7, label: 'Verifying claims against evidence...', duration: 2000, preview: 'Synthesizing evidence' },
  { step: 8, label: 'STORM deep research...', duration: 3000, preview: 'Literature review in progress' },
  { step: 9, label: 'Verifying STORM citations...', duration: 1500, preview: 'Validating research references' },
  { step: 10, label: 'Building report...', duration: 1500, preview: 'Compiling final report' },
];

/**
 * Hook that simulates the pipeline by animating through steps
 * with fake delays, then loads the real report from the API.
 */
export default function useSimulation() {
  const timers = useRef([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const runSimulation = useCallback(
    async (caseId) => {
      clearTimers();

      const {
        resetCase,
        setActiveCase,
        setPipelineSteps,
        setPipelineStatus,
        setSimulation,
        setReport,
        addMessage,
      } = useAppStore.getState();

      // Reset state for new simulation
      resetCase();
      setSimulation(true);

      // Set active case — fetch basic case data
      try {
        const caseData = await getCase(caseId);
        const caseObj = caseData.case || caseData;
        setActiveCase({ id: caseId, ...caseObj });
        addMessage({
          role: 'ai',
          content: `Running simulation for case: ${caseObj.presenting_complaint || 'Case'}`,
          ts: new Date().toISOString(),
        });
      } catch {
        setActiveCase({ id: caseId });
      }

      // Initialize all steps as waiting
      const initialSteps = SIM_STEPS.map((s) => ({
        step: s.step,
        label: s.label,
        status: 'waiting',
      }));
      setPipelineSteps(initialSteps);
      setPipelineStatus('running');

      // Animate through steps with cumulative delays
      let cumulativeDelay = 0;

      for (let i = 0; i < SIM_STEPS.length; i++) {
        const stepDef = SIM_STEPS[i];

        // Mark step as running
        const runTimer = setTimeout(() => {
          useAppStore.setState((state) => {
            const steps = [...state.pipelineSteps];
            steps[i] = {
              ...steps[i],
              status: 'running',
              preview: stepDef.preview || '',
            };
            return { pipelineSteps: steps };
          });
        }, cumulativeDelay);
        timers.current.push(runTimer);

        cumulativeDelay += stepDef.duration;

        // Mark step as done
        const doneTimer = setTimeout(() => {
          useAppStore.setState((state) => {
            const steps = [...state.pipelineSteps];
            steps[i] = {
              ...steps[i],
              status: 'done',
              duration_s: stepDef.duration / 1000,
            };
            return { pipelineSteps: steps };
          });
        }, cumulativeDelay);
        timers.current.push(doneTimer);

        // Small gap between steps
        cumulativeDelay += 200;
      }

      // After all steps, fetch and display the real report
      const completeTimer = setTimeout(async () => {
        setPipelineStatus('complete');
        try {
          const report = await getReport(caseId);
          setReport(report);
          addMessage({
            role: 'ai',
            content:
              'Report is ready. You can view the full analysis below or ask follow-up questions.',
            ts: new Date().toISOString(),
          });
        } catch (err) {
          addMessage({
            role: 'ai',
            content: `Failed to load report: ${err.message}`,
            ts: new Date().toISOString(),
            error: true,
          });
        }
      }, cumulativeDelay);
      timers.current.push(completeTimer);
    },
    [clearTimers],
  );

  return { runSimulation, clearTimers };
}
