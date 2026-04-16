import { useState, useRef, useEffect, useCallback } from 'react';
import {
  prefetchMedasr,
  isMedasrReady,
  localChatTranscribe,
  disposeLocalMedasr,
} from '../utils/localMedasr';

/**
 * Reusable hook for client-side MedASR speech-to-text.
 *
 * Encapsulates: model prefetch, MediaRecorder lifecycle, ONNX inference,
 * progress reporting, and cleanup. Any component with a mic button can
 * import this hook and get full MedASR with zero setup.
 *
 * @param {object} [opts]
 * @param {(evt: {stage:string, pct:number, loaded?:number, total?:number, message?:string}) => void} [opts.onProgress]
 * @param {(err: Error) => void} [opts.onError]
 * @param {boolean} [opts.autoPrefetch=true] - Start model download on mount
 * @returns {object}
 */
export default function useMedASR({ onProgress, onError, autoPrefetch = true } = {}) {
  // ── Model loading state ───────────────────────────────────────
  const [modelStatus, setModelStatus] = useState(() =>
    isMedasrReady() ? { stage: 'ready', pct: 100 } : { stage: 'idle', pct: 0 }
  );

  // ── Recording state ───────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);
  const onProgressRef = useRef(onProgress);
  const onErrorRef = useRef(onError);
  const mountedRef = useRef(true);

  // Keep callback refs fresh without re-triggering effects
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(recordingTimerRef.current);
    };
  }, []);

  // ── Prefetch model on mount ───────────────────────────────────
  const prefetch = useCallback(() => {
    if (isMedasrReady()) {
      setModelStatus({ stage: 'ready', pct: 100 });
      return Promise.resolve();
    }
    setModelStatus((s) => (s.stage === 'ready' ? s : { stage: 'loading', pct: 0 }));
    return prefetchMedasr((evt) => {
      if (!mountedRef.current) return;
      const status = { stage: evt.stage, pct: evt.pct ?? 0, loaded: evt.loaded, total: evt.total };
      setModelStatus(status);
      onProgressRef.current?.(status);
    })
      .then(() => {
        if (mountedRef.current) setModelStatus({ stage: 'ready', pct: 100 });
      })
      .catch((err) => {
        if (mountedRef.current) setModelStatus({ stage: 'error', pct: 0, message: err.message });
        onErrorRef.current?.(err);
      });
  }, []);

  useEffect(() => {
    if (autoPrefetch) prefetch();
  }, [autoPrefetch, prefetch]);

  // ── Start recording ───────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        if (mountedRef.current) {
          setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);
    } catch (err) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access in your browser settings.'
          : `Could not access microphone: ${err.message}`;
      onErrorRef.current?.(new Error(message));
    }
  }, [isRecording]);

  // ── Stop + transcribe ─────────────────────────────────────────
  const stopAndTranscribe = useCallback(() => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve({ text: '', timings: null });
        return;
      }

      clearInterval(recordingTimerRef.current);
      setIsRecording(false);

      recorder.onstop = async () => {
        // Release mic
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        if (audioBlob.size < 1000) {
          resolve({ text: '', timings: null });
          return;
        }

        setIsTranscribing(true);
        try {
          const result = await localChatTranscribe(audioBlob);
          if (mountedRef.current) setIsTranscribing(false);
          resolve({ text: result.text?.trim() || '', timings: result.timings });
        } catch (err) {
          if (mountedRef.current) setIsTranscribing(false);
          onErrorRef.current?.(err);
          reject(err);
        }
      };

      recorder.stop();
    });
  }, []);

  // ── Cancel recording (discard audio) ──────────────────────────
  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // prevent transcription
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioChunksRef.current = [];
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  // ── Dispose worker ────────────────────────────────────────────
  const dispose = useCallback(() => {
    cancelRecording();
    disposeLocalMedasr();
    setModelStatus({ stage: 'idle', pct: 0 });
  }, [cancelRecording]);

  // ── Derived state ─────────────────────────────────────────────
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== 'undefined';

  return {
    isSupported,
    isModelReady: modelStatus.stage === 'ready',
    isModelError: modelStatus.stage === 'error',
    modelStatus,
    isRecording,
    isTranscribing,
    recordingDuration,
    prefetch,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
    dispose,
  };
}
