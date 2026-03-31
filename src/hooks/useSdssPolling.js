import { useState, useEffect, useRef, useCallback } from 'react';
import { sdssGetTask } from '../utils/api';
import useWebSocket from './useWebSocket';

/**
 * Subscribes to SDSS task status via WebSocket (primary) with
 * HTTP polling fallback every 10s in case WebSocket fails.
 */
export default function useSdssPolling(taskId) {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const doneRef = useRef(false);

  const reset = useCallback(() => {
    setStatus(null);
    setResult(null);
    setError(null);
    setElapsed(0);
    doneRef.current = false;
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // ── WebSocket handler (primary) ──────────────────────────────
  const handleMessage = useCallback((data) => {
    if (data.type === 'complete') {
      doneRef.current = true;
      setStatus('complete');
      setResult(data.result);
      clearInterval(pollRef.current);
      pollRef.current = null;
    } else if (data.type === 'error') {
      doneRef.current = true;
      setStatus('failed');
      setError(data.error || 'Analysis failed');
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useWebSocket(taskId, handleMessage, 'sdss');

  // ── Polling fallback ─────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;
    doneRef.current = false;

    const poll = async () => {
      if (doneRef.current) return;
      try {
        const data = await sdssGetTask(taskId);
        if (doneRef.current) return;

        setElapsed(data.elapsed_seconds || 0);

        if (data.status === 'complete') {
          doneRef.current = true;
          setStatus('complete');
          setResult(data.result);
          clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === 'failed') {
          doneRef.current = true;
          setStatus('failed');
          setError(data.error || 'Analysis failed');
          clearInterval(pollRef.current);
          pollRef.current = null;
        } else {
          setStatus(data.status);
        }
      } catch {
        // Swallow poll errors — WebSocket or next poll will catch up
      }
    };

    // Start polling after a delay (give WebSocket a chance to connect first)
    const startTimer = setTimeout(() => {
      poll();
      pollRef.current = setInterval(poll, 10000);
    }, 5000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [taskId]);

  return { status, result, error, elapsed, reset };
}
