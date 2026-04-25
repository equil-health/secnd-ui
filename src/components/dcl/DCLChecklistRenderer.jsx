// DCL v1 — six-zone checklist renderer.
//
// Reads the contract defined in
// differential-app/docs/DCL_v1_GPU_Pod_Implementation.md §6 (and mirrored
// in src/utils/dclApi.js mocks). Each zone hides itself when its source
// array is empty, except Zone 3 and Zone 5, which always render
// (per spec §6.2 — ranked_differential and next_steps are required zones).
//
// Dev-mode refusal short-circuits all zones — checklist data must never
// reach a clinical user when the case ran with safety bypasses.
//
// Confidence dots: 1–5 filled circles. No verbal label per spec §4.6.
// Checkbox state for next_steps persists to localStorage so the page
// can be reloaded without losing the trainee's tick marks.

import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'dcl:case:';

export default function DCLChecklistRenderer({ checklist, onNewCase }) {
  if (!checklist) return null;

  if (checklist.dev_mode_stamp) {
    return <DevModeRefusal onNewCase={onNewCase} />;
  }

  const {
    case_id,
    case_meta,
    verification,
    safety_alerts,
    treatment_holds,
    ranked_differential,
    completeness_additions,
    next_steps,
    generated_at,
    pipeline_version,
  } = checklist;

  const hasSafety = Array.isArray(safety_alerts) && safety_alerts.length > 0;
  const hasHolds = Array.isArray(treatment_holds) && treatment_holds.length > 0;
  const hasAlsoConsider = Array.isArray(completeness_additions) && completeness_additions.length > 0;

  return (
    <div className="space-y-5">
      <CaseStrip caseMeta={case_meta} />

      {verification && verification.complete === false && (
        <VerificationCaveat skipped={verification.skipped_stages || []} />
      )}

      {hasSafety && <ZoneSafetyAlerts alerts={safety_alerts} />}
      {hasHolds && <ZoneTreatmentHolds holds={treatment_holds} />}

      <ZoneRankedDifferential entries={ranked_differential || []} />

      {hasAlsoConsider && <ZoneAlsoConsider entries={completeness_additions} />}

      <ZoneNextSteps caseId={case_id} steps={next_steps || []} />

      <ZoneNavigation
        onNewCase={onNewCase}
        generatedAt={generated_at}
        pipelineVersion={pipeline_version}
      />
    </div>
  );
}

// ─── Header strip ─────────────────────────────────────────────────────

function CaseStrip({ caseMeta }) {
  if (!caseMeta) return null;
  const { case_text_preview, age, sex, submitted_at } = caseMeta;
  const submittedLabel = formatDateTime(submitted_at);
  const demographic = [
    age != null ? `${age} y/o` : null,
    sex || null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
        Case
      </p>
      <p className="mt-1.5 text-sm text-slate-800 leading-relaxed">
        {case_text_preview || '(no preview available)'}
      </p>
      {(demographic || submittedLabel) && (
        <p className="mt-2 text-[11px] text-slate-500 font-mono">
          {demographic || '— · —'}
          {submittedLabel ? ` · ${submittedLabel}` : ''}
        </p>
      )}
    </div>
  );
}

function VerificationCaveat({ skipped }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 items-start">
      <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.375h.007M11.249 4.501l-9.247 16.005A1.498 1.498 0 003.247 22.502h17.506a1.498 1.498 0 001.245-2.001l-9.247-16.005a1.498 1.498 0 00-2.502 0z" />
      </svg>
      <div className="text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">Verification incomplete</p>
        <p className="mt-0.5 text-amber-800">
          Some pipeline stages did not run for this case
          {skipped.length > 0 && (
            <>: <span className="font-mono text-[11px]">{skipped.join(', ')}</span></>
          )}.
          Treat results with extra caution.
        </p>
      </div>
    </div>
  );
}

// ─── Zone 1: Safety alerts ───────────────────────────────────────────

function ZoneSafetyAlerts({ alerts }) {
  return (
    <ZoneShell
      eyebrow="Zone 1"
      title="Safety alerts"
      accent="red"
      countLabel={`${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'}`}
    >
      <div className="space-y-3">
        {alerts.map((a, i) => (
          <div
            key={`${a.source_rule_id || 'alert'}-${i}`}
            className="relative overflow-hidden rounded-lg bg-red-50 border border-red-200"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
            <div className="p-4 pl-5">
              <p className="text-sm font-semibold text-red-900">{a.title || 'Safety alert'}</p>
              {a.description && (
                <p className="mt-1 text-xs text-red-800 leading-relaxed">{a.description}</p>
              )}
              {(a.source_rule_id || a.guideline_citation) && (
                <p className="mt-2 text-[10px] font-mono text-red-700/80">
                  {[a.source_rule_id, a.guideline_citation].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ZoneShell>
  );
}

// ─── Zone 2: Treatment holds ─────────────────────────────────────────

function ZoneTreatmentHolds({ holds }) {
  return (
    <ZoneShell
      eyebrow="Zone 2"
      title="Treatment holds"
      accent="amber"
      countLabel={`${holds.length} ${holds.length === 1 ? 'hold' : 'holds'}`}
    >
      <div className="space-y-3">
        {holds.map((h, i) => (
          <div
            key={`${h.source_rule_id || 'hold'}-${i}`}
            className="relative overflow-hidden rounded-lg bg-amber-50/70 border border-amber-200"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
            <div className="p-4 pl-5 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-amber-900">
                  Hold: <span className="font-bold">{h.treatment || '—'}</span>
                </p>
                {h.source_rule_id && (
                  <span className="text-[10px] font-mono text-amber-700/80 flex-shrink-0">
                    {h.source_rule_id}
                  </span>
                )}
              </div>
              {h.must_exclude_diagnosis && (
                <p className="text-xs text-amber-900">
                  Must first exclude: <span className="font-semibold">{h.must_exclude_diagnosis}</span>
                </p>
              )}
              {h.rationale && (
                <p className="text-xs text-amber-800 leading-relaxed italic">{h.rationale}</p>
              )}
              {Array.isArray(h.required_workup) && h.required_workup.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 mb-1">
                    Required workup
                  </p>
                  <ul className="space-y-1">
                    {h.required_workup.map((step, si) => (
                      <li key={si} className="text-xs text-amber-900 flex gap-2">
                        <span className="text-amber-500">▸</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ZoneShell>
  );
}

// ─── Zone 3: Ranked differential ─────────────────────────────────────

function ZoneRankedDifferential({ entries }) {
  // "Over-rejection" signal — the verifier marked every triplet False
  // for at least three out of five diagnoses. Almost always a verifier
  // distribution-gap problem, not a clinical refutation. Surface it so
  // the trainee doesn't take "0/N triplets verified" at face value.
  const refutedCount = entries.filter((e) => {
    const counts = e.kg_triplet_counts;
    return e.kg_verification_status === 'refuted'
      && counts && counts.total > 0 && counts.true === 0;
  }).length;
  const showOverRejectionWarning = entries.length >= 3 && refutedCount >= 3;

  return (
    <ZoneShell
      eyebrow="Zone 3"
      title="Ranked differential"
      accent="slate"
      countLabel={
        entries.length === 0
          ? 'no entries'
          : `${entries.length} ${entries.length === 1 ? 'diagnosis' : 'diagnoses'}`
      }
    >
      {showOverRejectionWarning && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex gap-2 items-start">
          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.375h.007M11.249 4.501l-9.247 16.005A1.498 1.498 0 003.247 22.502h17.506a1.498 1.498 0 001.245-2.001l-9.247-16.005a1.498 1.498 0 00-2.502 0z" />
          </svg>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            <span className="font-semibold">KG verifier rejected most triplets on this case.</span>
            {' '}This usually reflects a coverage gap in the verifier rather than a clinical refutation —
            treat the ranked diagnoses on their clinical merits and rely on your own judgement.
          </p>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No differential entries returned. The narrative may not have provided enough information for verification.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li
              key={`${e.diagnosis || 'dx'}-${i}`}
              className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-md bg-white border border-slate-300 flex items-center justify-center text-[12px] font-bold text-slate-700 font-mono">
                  {e.rank ?? i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {e.diagnosis || '(unnamed)'}
                    </p>
                    <KgVerificationBadge status={e.kg_verification_status} />
                  </div>
                  {e.supporting_evidence_summary && (
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {e.supporting_evidence_summary}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 pt-0.5">
                  <ConfidenceDots level={e.confidence_level} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ZoneShell>
  );
}

function ConfidenceDots({ level }) {
  const n = Math.max(0, Math.min(5, Number.isFinite(level) ? level : 0));
  return (
    <div className="flex gap-1" title={`Confidence ${n}/5`} aria-label={`Confidence ${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`block w-1.5 h-1.5 rounded-full ${
            i < n ? 'bg-slate-700' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function KgVerificationBadge({ status }) {
  const map = {
    verified:    { label: 'KG verified',     cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    unverified:  { label: 'KG partial',      cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    refuted:     { label: 'KG refuted',      cls: 'bg-rose-100 text-rose-800 border-rose-200' },
    not_checked: { label: 'KG not checked',  cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  };
  const entry = map[status] || map.not_checked;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

// ─── Zone 4: Also consider ───────────────────────────────────────────

function ZoneAlsoConsider({ entries }) {
  return (
    <ZoneShell
      eyebrow="Zone 4"
      title="Also consider"
      accent="sky"
      countLabel={`${entries.length} ${entries.length === 1 ? 'addition' : 'additions'}`}
    >
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div
            key={`${e.diagnosis || 'add'}-${i}`}
            className="rounded-lg bg-sky-50/60 border border-sky-200 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <span className="text-sky-500 mt-0.5">★</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{e.diagnosis || '—'}</p>
                {e.source_cluster && (
                  <p className="text-[10px] font-mono text-sky-700 mt-0.5">
                    Cluster: {e.source_cluster}
                  </p>
                )}
                {e.reasoning && (
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">{e.reasoning}</p>
                )}
                {Array.isArray(e.exclusion_workup) && e.exclusion_workup.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 mb-1">
                      Exclusion workup
                    </p>
                    <ul className="space-y-1">
                      {e.exclusion_workup.map((step, si) => (
                        <li key={si} className="text-xs text-slate-700 flex gap-2">
                          <span className="text-sky-400">▸</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ZoneShell>
  );
}

// ─── Zone 5: Next steps ──────────────────────────────────────────────

function ZoneNextSteps({ caseId, steps }) {
  const storageKey = caseId ? `${STORAGE_PREFIX}${caseId}:checkedSteps` : null;
  const [checked, setChecked] = useState({});

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw) || {});
    } catch {
      // localStorage unavailable / quota exceeded — ignore
    }
  }, [storageKey]);

  function toggle(idx) {
    setChecked((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }

  return (
    <ZoneShell
      eyebrow="Zone 5"
      title="Next steps"
      accent="emerald"
      countLabel={`${steps.length} ${steps.length === 1 ? 'item' : 'items'}`}
    >
      {steps.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No next-step recommendations were produced.</p>
      ) : (
        <ul className="space-y-2">
          {steps.map((s, i) => {
            const done = !!checked[i];
            return (
              <li
                key={i}
                className={`rounded-lg border px-4 py-3 transition ${
                  done
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(i)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? 'text-emerald-900 line-through decoration-emerald-300' : 'text-slate-900'}`}>
                      {s.step || '(missing step)'}
                    </p>
                    {s.why && (
                      <p className={`mt-0.5 text-xs leading-relaxed ${done ? 'text-emerald-700/80' : 'text-slate-500'}`}>
                        {s.why}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </ZoneShell>
  );
}

// ─── Zone 6: Navigation ──────────────────────────────────────────────

function ZoneNavigation({ onNewCase, generatedAt, pipelineVersion }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-[10px] font-mono text-slate-400">
        {pipelineVersion ? `pipeline ${pipelineVersion}` : ''}
        {generatedAt ? ` · generated ${formatDateTime(generatedAt) || generatedAt}` : ''}
      </div>
      <button
        onClick={onNewCase}
        className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md transition shadow-sm"
      >
        New case
      </button>
    </div>
  );
}

// ─── Dev-mode refusal ────────────────────────────────────────────────

function DevModeRefusal({ onNewCase }) {
  return (
    <div className="rounded-xl bg-white border border-slate-300 p-6 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Refused
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">
        Checklist not available for developer-mode cases.
      </h3>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        This case ran with one or more safety bypasses active. DCL output is
        withheld for any case stamped <span className="font-mono">dev_mode</span> to prevent
        unsafe outputs from reaching clinical use.
      </p>
      <button
        onClick={onNewCase}
        className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md transition"
      >
        New case
      </button>
    </div>
  );
}

// ─── Generic zone shell ──────────────────────────────────────────────

function ZoneShell({ eyebrow, title, accent = 'slate', countLabel, children }) {
  const accentMap = {
    red:     'text-red-600',
    amber:   'text-amber-700',
    slate:   'text-slate-600',
    sky:     'text-sky-700',
    emerald: 'text-emerald-700',
  };
  const eyebrowCls = accentMap[accent] || accentMap.slate;
  return (
    <section className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${eyebrowCls}`}>
            {eyebrow}
          </span>
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </div>
        {countLabel && (
          <span className="text-[10px] font-mono text-slate-400">{countLabel}</span>
        )}
      </header>
      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
