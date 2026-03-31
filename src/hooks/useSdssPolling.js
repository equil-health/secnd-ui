import { useState, useEffect, useRef, useCallback } from 'react';
import { sdssGetTask } from '../utils/api';

export default function useSdssPolling(taskId, intervalMs = 5000) {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(null);
    setResult(null);
    setError(null);
    setElapsed(0);
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (!taskId) return;
    let active = true;

    const poll = async () => {
      try {
        const data = await sdssGetTask(taskId);
        if (!active) return;

        setStatus(data.status);
        setElapsed(data.elapsed_seconds || 0);

        if (data.status === 'complete') {
          setResult(data.result);
          clearInterval(timerRef.current);
          timerRef.current = null;
        } else if (data.status === 'failed') {
          setError(data.error || 'Analysis failed');
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {
        // Swallow poll errors — will retry next interval
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      active = false;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [taskId, intervalMs]);

  return { status, result, error, elapsed, reset };
}
