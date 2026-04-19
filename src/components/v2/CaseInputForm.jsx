import { useState, useRef, useCallback } from 'react';
import useMedASR from '../../hooks/useMedASR';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export default function CaseInputForm({ onSubmit, disabled }) {
  const [caseText, setCaseText] = useState('');
  const [mode, setMode] = useState('standard');
  const [images, setImages] = useState([]); // [{ file, preview }]
  const [error, setError] = useState(null);
  const [showContext, setShowContext] = useState(false);
  const [patientContext, setPatientContext] = useState({
    age: '', sex: '', comorbidities: '', medications: '', labs: '',
  });
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    isModelReady, isModelError, modelStatus,
    isRecording, isTranscribing, recordingDuration,
    startRecording, stopAndTranscribe,
  } = useMedASR({
    onError: (err) => setError(err.message),
  });

  // Voice toggle
  async function handleMicClick() {
    if (isRecording) {
      try {
        const { text } = await stopAndTranscribe();
        if (text) {
          setCaseText((prev) => prev ? `${prev} ${text}` : text);
          textareaRef.current?.focus();
        }
      } catch (err) {
        setError(`Transcription failed: ${err.message}`);
      }
    } else {
      setError(null);
      startRecording();
    }
  }

  // Image handling
  const addImages = useCallback((files) => {
    setError(null);
    const valid = [];
    for (const f of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        setError(`Unsupported image format: ${f.name}. Use JPG or PNG.`);
        return;
      }
      if (f.size > MAX_IMAGE_SIZE) {
        setError(`Image too large: ${f.name}. Max 10 MB.`);
        return;
      }
      valid.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setImages((prev) => [...prev, ...valid]);
  }, []);

  function removeImage(idx) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // Submit
  async function handleSubmit(e) {
    e.preventDefault();
    if (!caseText.trim()) return;

    // Convert images to base64
    const imageData = await Promise.all(
      images.map(async ({ file }) => {
        const buf = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        return { filename: file.name, mime_type: file.type, base64 };
      })
    );

    // Build patient context
    const ctx = showContext ? {
      age: patientContext.age ? Number(patientContext.age) : undefined,
      sex: patientContext.sex || undefined,
      comorbidities: patientContext.comorbidities
        ? patientContext.comorbidities.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      current_medications: patientContext.medications
        ? patientContext.medications.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      labs: patientContext.labs ? parseLabs(patientContext.labs) : undefined,
    } : undefined;

    onSubmit({
      caseText: caseText.trim(),
      mode,
      patientContext: ctx,
      images: imageData.length > 0 ? imageData : undefined,
    });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }

  const inputBase = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Case text — primary field */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Clinical Narrative
          </label>
          <span className="text-[10px] text-slate-400">
            {caseText.length} chars
          </span>
        </div>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
            placeholder="Describe the clinical case — include presenting symptoms, relevant history, lab values, and imaging findings..."
            rows={7}
            disabled={disabled}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition resize-y disabled:bg-slate-50 disabled:text-slate-400"
          />
          <div className="absolute bottom-2 right-2">
            {isTranscribing ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Transcribing
              </div>
            ) : !isModelReady && !isModelError ? (
              <div className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono">
                {modelStatus.stage === 'model' ? `ASR ${modelStatus.pct}%` : 'ASR loading'}
              </div>
            ) : isModelError ? null : (
              <button
                type="button"
                onClick={handleMicClick}
                disabled={disabled}
                className={`p-1.5 rounded-md transition ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                } disabled:opacity-30`}
                title={isRecording ? `Recording ${formatTime(recordingDuration)}` : 'Voice input'}
              >
                {isRecording ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-mono font-semibold">{formatTime(recordingDuration)}</span>
                  </div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Imaging
          </label>
          <span className="text-[10px] text-slate-400">
            Optional · JPG / PNG · 10 MB each
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-100 group">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0 right-0 w-4 h-4 bg-slate-900 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-16 h-16 rounded-md border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 hover:border-slate-900 hover:text-slate-900 hover:bg-white transition disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => { if (e.target.files.length) addImages([...e.target.files]); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* Patient context — collapsible */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
        >
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Patient Context
            </span>
            <span className="text-[10px] text-slate-400">optional</span>
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showContext ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        {showContext && (
          <div className="grid grid-cols-2 gap-3 p-4 border-t border-slate-200 bg-slate-50/50">
            <input
              type="number"
              placeholder="Age"
              value={patientContext.age}
              onChange={(e) => setPatientContext((p) => ({ ...p, age: e.target.value }))}
              className={inputBase}
            />
            <select
              value={patientContext.sex}
              onChange={(e) => setPatientContext((p) => ({ ...p, sex: e.target.value }))}
              className={inputBase}
            >
              <option value="">Sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input
              placeholder="Comorbidities (comma-separated)"
              value={patientContext.comorbidities}
              onChange={(e) => setPatientContext((p) => ({ ...p, comorbidities: e.target.value }))}
              className={`col-span-2 ${inputBase}`}
            />
            <input
              placeholder="Current medications (comma-separated)"
              value={patientContext.medications}
              onChange={(e) => setPatientContext((p) => ({ ...p, medications: e.target.value }))}
              className={`col-span-2 ${inputBase}`}
            />
            <textarea
              placeholder="Lab values, e.g.: AFP 38 ng/mL, CRP 42 mg/L"
              value={patientContext.labs}
              onChange={(e) => setPatientContext((p) => ({ ...p, labs: e.target.value }))}
              rows={2}
              className={`col-span-2 ${inputBase} resize-none`}
            />
          </div>
        )}
      </div>

      {/* Mode toggle — segmented */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2">
          Analysis Mode
        </label>
        <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          {[
            { id: 'standard', label: 'Standard', desc: 'Evidence-backed verification' },
            { id: 'zebra', label: 'Think Zebra', desc: 'Rare disease focus' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === m.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h-14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled || !caseText.trim()}
        className="group w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 disabled:shadow-none"
      >
        <span>Generate Verified Second Opinion</span>
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </form>
  );
}

// Parse free-text labs into structured array
function parseLabs(text) {
  const labs = [];
  // Match patterns like "AFP 38 ng/mL" or "CRP: 42 mg/L"
  const regex = /([A-Za-z][A-Za-z0-9 .-]*?)\s*[:\s]+\s*([\d.]+)\s*([a-zA-Z/%]+(?:\/[a-zA-Z]+)?)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    labs.push({ name: match[1].trim(), value: parseFloat(match[2]), unit: match[3] });
  }
  return labs.length > 0 ? labs : undefined;
}
