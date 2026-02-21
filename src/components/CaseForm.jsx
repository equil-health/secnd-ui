import { useState } from 'react';
import useAppStore from '../stores/appStore';
import { submitCase, parseCase } from '../utils/api';

const EMPTY_STRUCTURED = {
  patient_age: '',
  patient_sex: '',
  patient_ethnicity: '',
  presenting_complaint: '',
  medical_history: '',
  medications: '',
  physical_exam: '',
  lab_results: [{ name: '', value: '', unit: '', flag: '', reference_range: '' }],
  imaging_reports: '',
  referring_diagnosis: '',
  specific_question: '',
};

export default function CaseForm() {
  const { isFormOpen, setFormOpen, setActiveCase, addMessage, resetCase } =
    useAppStore();
  const [tab, setTab] = useState('structured');
  const [form, setForm] = useState({ ...EMPTY_STRUCTURED });
  const [freeText, setFreeText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isFormOpen) return null;

  const updateField = (field, value) =>
    setForm((f) => ({ ...f, [field]: value }));

  const updateLab = (idx, field, value) =>
    setForm((f) => {
      const labs = [...f.lab_results];
      labs[idx] = { ...labs[idx], [field]: value };
      return { ...f, lab_results: labs };
    });

  const addLab = () =>
    setForm((f) => ({
      ...f,
      lab_results: [
        ...f.lab_results,
        { name: '', value: '', unit: '', flag: '', reference_range: '' },
      ],
    }));

  const removeLab = (idx) =>
    setForm((f) => ({
      ...f,
      lab_results: f.lab_results.filter((_, i) => i !== idx),
    }));

  const handleParse = async () => {
    if (freeText.length < 50) {
      setError('Free text must be at least 50 characters.');
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const res = await parseCase(freeText);
      setForm({ ...EMPTY_STRUCTURED, ...res.parsed });
      setTab('structured');
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        patient_age: form.patient_age ? Number(form.patient_age) : undefined,
        lab_results: form.lab_results
          .filter((l) => l.name && l.value)
          .map((l) => ({ ...l, value: Number(l.value) })),
      };
      // Remove empty optional fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });

      resetCase();
      const caseRes = await submitCase(payload);
      setActiveCase(caseRes);
      addMessage({
        role: 'ai',
        content: `Case submitted. Analyzing **${caseRes.presenting_complaint || 'your case'}**...`,
        ts: caseRes.created_at,
      });
      setFormOpen(false);
      setForm({ ...EMPTY_STRUCTURED });
      setFreeText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">New Case</h2>
          <button
            onClick={() => setFormOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b px-6">
          {['structured', 'freetext'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'structured' ? 'Structured' : 'Free Text'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {tab === 'structured' ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Age" type="number" value={form.patient_age} onChange={(v) => updateField('patient_age', v)} />
                <SelectField
                  label="Sex"
                  value={form.patient_sex}
                  onChange={(v) => updateField('patient_sex', v)}
                  options={['', 'Male', 'Female', 'Other']}
                />
                <Field label="Ethnicity" value={form.patient_ethnicity} onChange={(v) => updateField('patient_ethnicity', v)} />
              </div>
              <TextArea label="Presenting Complaint *" value={form.presenting_complaint} onChange={(v) => updateField('presenting_complaint', v)} rows={3} />
              <TextArea label="Medical History" value={form.medical_history} onChange={(v) => updateField('medical_history', v)} rows={2} />
              <TextArea label="Medications" value={form.medications} onChange={(v) => updateField('medications', v)} rows={2} />
              <TextArea label="Physical Exam" value={form.physical_exam} onChange={(v) => updateField('physical_exam', v)} rows={2} />

              {/* Lab results */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lab Results</label>
                {form.lab_results.map((lab, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input placeholder="Name" value={lab.name} onChange={(e) => updateLab(i, 'name', e.target.value)} className="flex-1 text-sm border rounded px-2 py-1" />
                    <input placeholder="Value" type="number" value={lab.value} onChange={(e) => updateLab(i, 'value', e.target.value)} className="w-20 text-sm border rounded px-2 py-1" />
                    <input placeholder="Unit" value={lab.unit} onChange={(e) => updateLab(i, 'unit', e.target.value)} className="w-20 text-sm border rounded px-2 py-1" />
                    <input placeholder="Flag" value={lab.flag} onChange={(e) => updateLab(i, 'flag', e.target.value)} className="w-16 text-sm border rounded px-2 py-1" />
                    <input placeholder="Ref range" value={lab.reference_range} onChange={(e) => updateLab(i, 'reference_range', e.target.value)} className="w-24 text-sm border rounded px-2 py-1" />
                    {form.lab_results.length > 1 && (
                      <button onClick={() => removeLab(i)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
                    )}
                  </div>
                ))}
                <button onClick={addLab} className="text-sm text-indigo-600 hover:text-indigo-800">+ Add lab result</button>
              </div>

              <TextArea label="Imaging Reports" value={form.imaging_reports} onChange={(v) => updateField('imaging_reports', v)} rows={2} />
              <Field label="Referring Diagnosis" value={form.referring_diagnosis} onChange={(v) => updateField('referring_diagnosis', v)} />
              <TextArea label="Specific Question" value={form.specific_question} onChange={(v) => updateField('specific_question', v)} rows={2} />
            </>
          ) : (
            <>
              <TextArea
                label="Paste or type the full clinical case"
                value={freeText}
                onChange={setFreeText}
                rows={10}
                placeholder="Include patient demographics, presenting complaint, history, labs, imaging, etc. (min 50 characters)"
              />
              <button
                onClick={handleParse}
                disabled={parsing}
                className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
              >
                {parsing ? 'Parsing...' : 'Parse into Structured Fields'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={() => setFormOpen(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (tab === 'structured' && !form.presenting_complaint)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Case'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || '— Select —'}</option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
