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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Case text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Case</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
            placeholder="Describe the clinical case — include presenting symptoms, relevant history, lab values, and imaging findings..."
            rows={6}
            disabled={disabled}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-y disabled:bg-gray-50 disabled:text-gray-400"
          />
          {/* Mic button in textarea corner */}
          <div className="absolute bottom-2 right-2">
            {isTranscribing ? (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-600 text-xs">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Transcribing...
              </div>
            ) : !isModelReady && !isModelError ? (
              <div className="px-2 py-1 rounded-full bg-gray-100 text-gray-400 text-[10px]">
                {modelStatus.stage === 'model' ? `ASR ${modelStatus.pct}%` : 'Loading ASR...'}
              </div>
            ) : isModelError ? null : (
              <button
                type="button"
                onClick={handleMicClick}
                disabled={disabled}
                className={`p-1.5 rounded-full transition ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                } disabled:opacity-30`}
                title={isRecording ? `Recording ${formatTime(recordingDuration)}` : 'Voice input'}
              >
                {isRecording ? (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-mono">{formatTime(recordingDuration)}</span>
                  </div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium text-gray-700">Images</label>
          <span className="text-[10px] text-gray-400">Optional — X-rays, scans, lab printouts</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-bl-lg flex items-center justify-center text-[10px] hover:bg-red-600"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

      {/* Patient context toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          className="text-sm text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
        >
          <svg className={`w-3.5 h-3.5 transition ${showContext ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Patient context {showContext ? '(hide)' : '(optional)'}
        </button>
        {showContext && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Age"
              value={patientContext.age}
              onChange={(e) => setPatientContext((p) => ({ ...p, age: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            />
            <select
              value={patientContext.sex}
              onChange={(e) => setPatientContext((p) => ({ ...p, sex: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            >
              <option value="">Sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input
              placeholder="Comorbidities (comma-separated)"
              value={patientContext.comorbidities}
              onChange={(e) => setPatientContext((p) => ({ ...p, comorbidities: e.target.value }))}
              className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            />
            <input
              placeholder="Current medications (comma-separated)"
              value={patientContext.medications}
              onChange={(e) => setPatientContext((p) => ({ ...p, medications: e.target.value }))}
              className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            />
            <textarea
              placeholder="Lab values, e.g.: AFP 38 ng/mL, CRP 42 mg/L"
              value={patientContext.labs}
              onChange={(e) => setPatientContext((p) => ({ ...p, labs: e.target.value }))}
              rows={2}
              className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 resize-none"
            />
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Mode:</span>
        {[
          { id: 'standard', label: 'Standard', desc: 'Evidence-backed verification' },
          { id: 'zebra', label: 'Think Zebra', desc: 'Rare disease focus' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === m.id
                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled || !caseText.trim()}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        Generate Verified Second Opinion
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
