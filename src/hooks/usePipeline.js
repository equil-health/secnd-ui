import { useCallback } from 'react';
import useAppStore from '../stores/appStore';
import useWebSocket from './useWebSocket';

/**
 * Connects to the pipeline WebSocket and updates Zustand store
 * with step progress, completion, and errors.
 */
export default function usePipeline(caseId) {
  const { setPipelineStatus } = useAppStore();

  const handleMessage = useCallback(
    (data) => {
      if (data.type === 'update') {
        useAppStore.setState((state) => {
          const steps = [...state.pipelineSteps];
          const totalNeeded = data.total_steps || steps.length;
          while (steps.length < totalNeeded) {
            steps.push({ step: steps.length, label: '', status: 'waiting' });
          }
          if (data.step_details) {
            const idx = data.step_details.step;
            if (idx >= 0 && idx < steps.length) {
              steps[idx] = { ...steps[idx], ...data.step_details };
            }
          }
          return { pipelineSteps: steps, pipelineStatus: 'running' };
        });
      } else if (data.type === 'complete') {
        setPipelineStatus('complete');
      } else if (data.type === 'error') {
        setPipelineStatus('error');
      }
    },
    [setPipelineStatus],
  );

  useWebSocket(caseId, handleMessage);
}
