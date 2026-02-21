import { useState, useEffect, useRef } from "react";

const SCENARIOS = [
  {
    id: "SCN-001",
    avatar: "👨🏽",
    age: 54, sex: "M", bmi: 23.5,
    specialty: "Cardiology",
    lang: "EN",
    referring: "Exertional dyspnea & chest pain in athlete",
    summary: "Physically fit 54yo male athlete with progressive exertional dyspnea and chest pain. JVD elevated at rest. Kussmaul's sign positive — paradoxical rise in JVP on inspiration. Athletic build, no deconditioning. Presentation initially attributed to CAD/HCM but exam findings inconsistent. Presented at MGH Cardiology Grand Rounds.",
    color: "#dc2626",
    tags: ["Kussmaul's sign", "JVD", "Athlete", "Diagnostic challenge"],
  },
  {
    id: "SCN-002",
    avatar: "👨🏻",
    age: 46, sex: "M", bmi: 24.8,
    specialty: "General Medicine",
    lang: "EN",
    referring: "Post-COVID joint pain & systemic symptoms",
    summary: "46yo male with wrist pain/swelling 1 week after mild COVID-19 following Caribbean travel. Progressive polyarthritis over 14 weeks. Lightheadedness episodes, tachycardia (109 bpm). Scalp alopecia, nasal crusting, oral ulcer, hyperpigmented scaling rash on trunk/legs. Elevated ESR. CT-PA negative for PE.",
    color: "#7c3aed",
    tags: ["Post-COVID", "Polyarthritis", "Skin rash", "Travel history"],
  },
  {
    id: "SCN-003",
    avatar: "👩🏼",
    age: 30, sex: "F", bmi: 22.0,
    specialty: "Neurology",
    lang: "EN",
    referring: "Back pain, leg stiffness & falls — 3yr history",
    summary: "30yo woman with 3-year waxing/waning leg stiffness and back pain. Knees feel 'locked up' intermittently. Nocturnal jerking, exaggerated startle response. Gait normalized on lorazepam. Hx of vitiligo, Graves' disease, ITP — multiple autoimmune conditions. Increased leg tone, hyperreflexia, no weakness or sensory loss. MRI shows exaggerated lumbar lordosis.",
    color: "#0891b2",
    tags: ["Stiffness", "Autoimmune cluster", "Startle response", "Lorazepam-responsive"],
  },
  {
    id: "SCN-004",
    avatar: "👨🏽",
    age: 47, sex: "M", bmi: 21.3,
    specialty: "Hepatology",
    lang: "EN",
    referring: "Suspected HCC",
    summary: "Progressive weight loss 9kg/4mo, fatigue, RUQ pain. Liver lesions on CT. ANA 1:320, ASMA+, IgG 2800. AFP mildly elevated at 38.",
    color: "#0d9488",
    tags: ["Autoimmune markers", "Liver lesions", "Weight loss"],
  },
  {
    id: "SCN-005",
    avatar: "👩🏻",
    age: 72, sex: "F", bmi: 25.9,
    specialty: "Cardiology",
    lang: "FR",
    referring: "LAD stenosis management",
    summary: "Post-coronarography follow-up for LAD stenosis. Fibromyalgia comorbidity. Echocardiogram shows preserved EF 55%. On dual antiplatelet therapy.",
    color: "#dc2626",
    tags: ["Post-cath", "Stenosis", "Comorbid pain"],
  },
  {
    id: "SCN-006",
    avatar: "👩🏼",
    age: 48, sex: "F", bmi: 33.1,
    specialty: "Cardiology",
    lang: "EN",
    referring: "Pre-op cardiac clearance",
    summary: "Pre-operative cardiac clearance for gastric bypass. History of PVCs. Echocardiogram shows mild LVH. Stress test equivocal. BMI 33.1.",
    color: "#7c3aed",
    tags: ["Pre-operative", "Obesity", "Arrhythmia"],
  },
  {
    id: "SCN-007",
    avatar: "👨🏻‍🦳",
    age: 68, sex: "M", bmi: 26.8,
    specialty: "Endocrinology",
    lang: "EN",
    referring: "Uncontrolled T2DM",
    summary: "HbA1c 9.2% despite triple oral therapy. Recurrent hypoglycemia episodes. Declining eGFR 48. Weight gain 6kg in 3 months on sulfonylurea.",
    color: "#d97706",
    tags: ["Diabetes", "Renal decline", "Hypoglycemia"],
  },
  {
    id: "SCN-008",
    avatar: "👩🏾",
    age: 35, sex: "F", bmi: 22.4,
    specialty: "Pulmonology",
    lang: "EN",
    referring: "Chronic cough, ?asthma",
    summary: "Persistent dry cough 6 months. Normal CXR, spirometry borderline obstructive. No wheeze on exam. ACE inhibitor started 8 months ago. Eosinophils 6%.",
    color: "#0891b2",
    tags: ["Chronic cough", "Drug-related?", "Eosinophilia"],
  },
  {
    id: "SCN-009",
    avatar: "👨🏽‍🦱",
    age: 55, sex: "M", bmi: 29.5,
    specialty: "Gastroenterology",
    lang: "FR",
    referring: "Recurrent pancreatitis",
    summary: "Third episode of acute pancreatitis in 18 months. Triglycerides 890. IgG4 mildly elevated. MRCP shows pancreatic duct irregularity. Social drinker.",
    color: "#059669",
    tags: ["Recurrent episodes", "Hypertriglyceridemia", "IgG4?"],
  },
];

const SPECIALTIES = ["All", "Cardiology", "General Medicine", "Neurology", "Hepatology", "Endocrinology", "Pulmonology", "Gastroenterology", "Oncology"];

const PIPELINE_STEPS = [
  { icon: "📋", label: "Case received", duration: 800 },
  { icon: "🧬", label: "MedGemma analyzing", duration: 3000 },
  { icon: "🧹", label: "Cleaning output", duration: 600 },
  { icon: "🔍", label: "Checking for hallucinations", duration: 1500 },
  { icon: "📑", label: "Extracting claims", duration: 1200 },
  { icon: "🔎", label: "Searching medical literature", duration: 2500 },
  { icon: "⚖️", label: "Verifying against evidence", duration: 2000 },
  { icon: "🌩️", label: "STORM deep research", duration: 4000 },
  { icon: "📝", label: "Compiling report", duration: 1000 },
  { icon: "✅", label: "Report ready", duration: 500 },
];

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileIcon({ type }) {
  const colors = { pdf: "#dc2626", doc: "#2563eb", img: "#059669", csv: "#d97706", other: "#6b7280" };
  const labels = { pdf: "PDF", doc: "DOC", img: "IMG", csv: "CSV", other: "FILE" };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: colors[type] + "18", color: colors[type],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em"
    }}>
      {labels[type]}
    </div>
  );
}

function getFileType(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return "doc";
  if (["jpg", "jpeg", "png", "gif", "webp", "dicom", "dcm"].includes(ext)) return "img";
  if (["csv", "xlsx", "xls"].includes(ext)) return "csv";
  return "other";
}

// === DIALOG COMPONENT ===
function Dialog({ scenario, onClose, onSubmit }) {
  const [action, setAction] = useState(null);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showReport, setShowReport] = useState(false);

  const startPipeline = () => {
    setAction("second-opinion");
    setRunning(true);
    setCurrentStep(0);
    setCompletedSteps([]);

    let step = 0;
    const runStep = () => {
      if (step >= PIPELINE_STEPS.length) {
        setRunning(false);
        setShowReport(true);
        return;
      }
      setCurrentStep(step);
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, step]);
        step++;
        runStep();
      }, PIPELINE_STEPS[step].duration);
    };
    runStep();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      animation: "fadeIn 0.2s ease"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: showReport ? 700 : 480,
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        animation: "slideUp 0.3s ease"
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px", borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: scenario.color + "12", border: `2px solid ${scenario.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28
            }}>
              {scenario.avatar}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: scenario.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {scenario.id} · {scenario.specialty}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                {scenario.age}{scenario.sex} · BMI {scenario.bmi}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f1f5f9", border: "none", borderRadius: 10,
            width: 36, height: 36, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#64748b"
          }}><XIcon /></button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 28px 28px" }}>
          {!action && !showReport && (
            <>
              <div style={{
                background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 20,
                fontSize: 13.5, lineHeight: 1.6, color: "#334155"
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Referring Diagnosis
                </div>
                <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>{scenario.referring}</div>
                {scenario.summary}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                {scenario.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                    background: scenario.color + "12", color: scenario.color, fontWeight: 500
                  }}>{t}</span>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 12 }}>
                What would you like to do?
              </div>
              <button onClick={startPipeline} style={{
                width: "100%", padding: "14px 20px",
                background: `linear-gradient(135deg, ${scenario.color}, ${scenario.color}dd)`,
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: `0 4px 14px ${scenario.color}40`,
                transition: "transform 0.15s, box-shadow 0.15s"
              }}
                onMouseOver={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = `0 6px 20px ${scenario.color}50`; }}
                onMouseOut={e => { e.target.style.transform = ""; e.target.style.boxShadow = `0 4px 14px ${scenario.color}40`; }}
              >
                <span style={{ fontSize: 18 }}>🔬</span>
                Get a Second Opinion
              </button>
              <button style={{
                width: "100%", padding: "12px 20px", marginTop: 10,
                background: "#f8fafc", color: "#475569",
                border: "1px solid #e2e8f0", borderRadius: 12,
                fontSize: 13, fontWeight: 500, cursor: "pointer"
              }}>
                📊 Just analyze the labs
              </button>
            </>
          )}

          {action && !showReport && (
            <div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 8
              }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: "#10b981", animation: "pulse 1.5s infinite"
                }} />
                Pipeline running...
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {PIPELINE_STEPS.map((step, i) => {
                  const done = completedSteps.includes(i);
                  const active = currentStep === i && !done;
                  const waiting = i > currentStep;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "8px 12px", borderRadius: 10,
                      background: active ? scenario.color + "08" : "transparent",
                      transition: "all 0.3s ease",
                      opacity: waiting ? 0.35 : 1
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15,
                        background: done ? "#10b98118" : active ? scenario.color + "15" : "#f1f5f9",
                        transition: "all 0.3s"
                      }}>
                        {done ? "✓" : step.icon}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: done ? "#10b981" : active ? scenario.color : "#94a3b8",
                        flex: 1
                      }}>
                        {step.label}
                      </span>
                      {active && (
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          border: `2px solid ${scenario.color}`,
                          borderTopColor: "transparent",
                          animation: "spin 0.8s linear infinite"
                        }} />
                      )}
                      {done && (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {(PIPELINE_STEPS[i].duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showReport && (
            <div>
              <div style={{
                background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                borderRadius: 12, padding: 16, marginBottom: 16,
                border: "1px solid #bbf7d0"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>
                    Second Opinion Complete
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#15803d", lineHeight: 1.6 }}>
                  Analysis found <strong>Autoimmune Hepatitis (AIH)</strong> as the primary diagnosis, 
                  challenging the referring HCC diagnosis. 9 claims verified against 41 medical sources.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Sources", value: "41" },
                  { label: "Claims", value: "9/9" },
                  { label: "Time", value: "2m 18s" },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, textAlign: "center", padding: "10px 8px",
                    background: "#f8fafc", borderRadius: 10
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "#f8fafc", borderRadius: 12, padding: 16,
                fontSize: 13, lineHeight: 1.7, color: "#334155", marginBottom: 16
              }}>
                <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Executive Summary</div>
                The referring physician's suspected HCC diagnosis is unlikely given the absence of classic risk factors 
                and atypical imaging. The constellation of strongly positive autoimmune markers (ANA 1:320, ASMA+), 
                markedly elevated IgG (2,800), and a calculated globulin gap of 5.9 g/dL strongly suggests 
                autoimmune hepatitis as the primary diagnosis. A liver biopsy is still recommended, but pathology 
                should specifically evaluate for interface hepatitis and plasma cell infiltration characteristic of AIH.
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{
                  flex: 1, padding: "12px 16px",
                  background: scenario.color, color: "#fff",
                  border: "none", borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}>
                  View Full Report →
                </button>
                <button style={{
                  padding: "12px 16px",
                  background: "#f1f5f9", color: "#475569",
                  border: "none", borderRadius: 10,
                  fontSize: 13, fontWeight: 500, cursor: "pointer"
                }}>
                  PDF ↓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// === UPLOAD PANEL ===
function UploadPanel({ onClose }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [context, setContext] = useState("");
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      animation: "fadeIn 0.2s ease"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540,
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        animation: "slideUp 0.3s ease"
      }}>
        <div style={{
          padding: "24px 28px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Upload Patient Files</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              PDFs, images, lab reports, discharge summaries, DICOM
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f1f5f9", border: "none", borderRadius: 10,
            width: 36, height: 36, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b"
          }}><XIcon /></button>
        </div>

        <div style={{ padding: "0 28px 24px" }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#0d9488" : "#e2e8f0"}`,
              borderRadius: 14, padding: "32px 20px",
              textAlign: "center", cursor: "pointer",
              background: dragging ? "#f0fdfa" : "#fafbfc",
              transition: "all 0.2s"
            }}
          >
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.csv,.xlsx,.dicom,.dcm" />
            <div style={{ color: dragging ? "#0d9488" : "#94a3b8", marginBottom: 8, display: "flex", justifyContent: "center" }}>
              <UploadIcon />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
              Drop files here or click to browse
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              PDF, DOC, images, DICOM, lab CSVs — up to 50MB each
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {files.map((file, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "#f8fafc", marginBottom: 6
                }}>
                  <FileIcon type={getFileType(file.name)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#94a3b8", fontSize: 16, padding: 4
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Context */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
              What's your question? <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
            </div>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g., Is this truly HCC or could there be an autoimmune cause?"
              style={{
                width: "100%", padding: "12px 14px",
                border: "1px solid #e2e8f0", borderRadius: 10,
                fontSize: 13, fontFamily: "inherit", resize: "vertical",
                minHeight: 60, outline: "none", color: "#334155",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#0d9488"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          {/* PII notice */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 14px", borderRadius: 10,
            background: "#fefce8", border: "1px solid #fef08a",
            marginTop: 14, fontSize: 12, lineHeight: 1.5, color: "#854d0e"
          }}>
            <span style={{ marginTop: 1 }}><ShieldIcon /></span>
            <div>
              <strong>Privacy:</strong> Patient names, dates of birth, and identifiers are 
              automatically stripped before analysis. No PHI is stored or sent to AI models.
            </div>
          </div>

          {/* Submit */}
          <button disabled={files.length === 0} style={{
            width: "100%", padding: "14px 20px", marginTop: 16,
            background: files.length > 0 ? "linear-gradient(135deg, #0d9488, #0f766e)" : "#e2e8f0",
            color: files.length > 0 ? "#fff" : "#94a3b8",
            border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 600,
            cursor: files.length > 0 ? "pointer" : "not-allowed",
            boxShadow: files.length > 0 ? "0 4px 14px rgba(13,148,136,0.3)" : "none",
            transition: "all 0.2s"
          }}>
            🔬 Analyze {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// === MAIN APP ===
export default function DemoPage() {
  const [mode, setMode] = useState("demo"); // demo | upload
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [activeSpecialty, setActiveSpecialty] = useState("All");
  const [hoveredCard, setHoveredCard] = useState(null);

  const filtered = activeSpecialty === "All"
    ? SCENARIOS
    : SCENARIOS.filter(s => s.specialty === activeSpecialty);

  const specialtyCounts = {};
  SCENARIOS.forEach(s => { specialtyCounts[s.specialty] = (specialtyCounts[s.specialty] || 0) + 1; });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f8fafb 0%, #f1f5f9 100%)",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #e8ecf0",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #0d9488, #14b8a6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 700
          }}>M</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
            MedSecondOpinion
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#0d9488",
            background: "#f0fdfa", padding: "2px 8px", borderRadius: 4,
            textTransform: "uppercase", letterSpacing: "0.06em"
          }}>Beta</span>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3
        }}>
          {[
            { key: "demo", label: "Demo Cases" },
            { key: "upload", label: "Upload Files" }
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: mode === m.key ? "#fff" : "transparent",
              color: mode === m.key ? "#0f172a" : "#94a3b8",
              boxShadow: mode === m.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s"
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 60px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            fontSize: 32, fontWeight: 700, color: "#0f172a",
            letterSpacing: "-0.03em", lineHeight: 1.2
          }}>
            {mode === "demo" ? "Select a Scenario" : "Upload Patient Files"}
          </div>
          <div style={{ fontSize: 15, color: "#64748b", marginTop: 10, maxWidth: 520, margin: "10px auto 0", lineHeight: 1.6 }}>
            {mode === "demo"
              ? "Each scenario loads realistic clinical data. Pick a case and get an AI-powered second opinion backed by medical literature."
              : "Drop lab reports, imaging, discharge summaries, or any clinical documents. We'll extract the data, strip identifiers, and analyze."}
          </div>
        </div>

        {mode === "demo" && (
          <>
            {/* Specialty filter */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6,
              justifyContent: "center", marginBottom: 32
            }}>
              {SPECIALTIES.map(sp => {
                const count = sp === "All" ? SCENARIOS.length : (specialtyCounts[sp] || 0);
                const active = activeSpecialty === sp;
                const hasItems = count > 0;
                return (
                  <button key={sp} onClick={() => hasItems && setActiveSpecialty(sp)} style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: active ? "1.5px solid #0d9488" : "1.5px solid #e8ecf0",
                    background: active ? "#f0fdfa" : "transparent",
                    fontSize: 12.5, fontWeight: active ? 600 : 400,
                    color: active ? "#0d9488" : hasItems ? "#475569" : "#cbd5e1",
                    cursor: hasItems ? "pointer" : "default",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: 5
                  }}>
                    {sp}
                    {count > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        background: active ? "#0d948820" : "#f1f5f9",
                        color: active ? "#0d9488" : "#94a3b8",
                        padding: "1px 6px", borderRadius: 4,
                        fontFamily: "'DM Mono', monospace"
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scenario cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16
            }}>
              {filtered.map((sc, i) => (
                <div key={sc.id}
                  onMouseEnter={() => setHoveredCard(sc.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => setSelectedScenario(sc)}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: `1.5px solid ${hoveredCard === sc.id ? sc.color + "60" : "#e8ecf0"}`,
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                    transform: hoveredCard === sc.id ? "translateY(-3px)" : "",
                    boxShadow: hoveredCard === sc.id
                      ? `0 12px 32px ${sc.color}18, 0 4px 12px rgba(0,0,0,0.06)`
                      : "0 1px 3px rgba(0,0,0,0.04)",
                    animation: `cardIn 0.4s ease ${i * 0.06}s both`,
                    overflow: "hidden"
                  }}
                >
                  {/* Card top bar */}
                  <div style={{
                    height: 4,
                    background: `linear-gradient(90deg, ${sc.color}, ${sc.color}88)`,
                    opacity: hoveredCard === sc.id ? 1 : 0.4,
                    transition: "opacity 0.25s"
                  }} />

                  <div style={{ padding: "20px 22px" }}>
                    {/* Avatar + meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: sc.color + "10",
                        border: `2px solid ${sc.color}25`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 28, flexShrink: 0
                      }}>
                        {sc.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            fontFamily: "'DM Mono', monospace",
                            color: sc.color, letterSpacing: "0.04em"
                          }}>{sc.id}</span>
                          <span style={{
                            fontSize: 10, padding: "2px 7px", borderRadius: 4,
                            background: "#f1f5f9", color: "#64748b", fontWeight: 500
                          }}>{sc.lang}</span>
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 3
                        }}>
                          {sc.age}{sc.sex} · BMI {sc.bmi}
                        </div>
                      </div>
                      <div style={{
                        padding: "5px 10px", borderRadius: 8,
                        background: sc.color + "10", color: sc.color,
                        fontSize: 11, fontWeight: 600
                      }}>
                        {sc.specialty}
                      </div>
                    </div>

                    {/* Referring dx */}
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "#94a3b8",
                      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4
                    }}>
                      Referring Diagnosis
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
                      {sc.referring}
                    </div>

                    {/* Summary */}
                    <div style={{
                      fontSize: 12.5, color: "#64748b", lineHeight: 1.6,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden"
                    }}>
                      {sc.summary}
                    </div>

                    {/* Tags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                      {sc.tags.map(t => (
                        <span key={t} style={{
                          fontSize: 10.5, padding: "3px 8px", borderRadius: 5,
                          background: "#f1f5f9", color: "#64748b", fontWeight: 500
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div style={{
              textAlign: "center", marginTop: 32,
              fontSize: 12, color: "#94a3b8", lineHeight: 1.6
            }}>
              All scenarios are synthetic. No real patient data is used. Clinical details span
              hepatology, cardiology, endocrinology, pulmonology, and gastroenterology.
            </div>
          </>
        )}

        {mode === "upload" && (
          <div style={{ maxWidth: 580, margin: "0 auto" }}>
            {/* Upload area */}
            <div
              onClick={() => setShowUpload(true)}
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: 20, padding: "60px 40px",
                textAlign: "center", cursor: "pointer",
                background: "#fff",
                transition: "all 0.2s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = "#0d9488";
                e.currentTarget.style.background = "#f0fdfa";
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.background = "#fff";
              }}
            >
              <div style={{ color: "#94a3b8", marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <UploadIcon />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#0f172a" }}>
                Drop patient files here
              </div>
              <div style={{ fontSize: 13.5, color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
                Lab reports, imaging studies, discharge summaries, referral letters, ECGs
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 20
              }}>
                {["PDF", "DOCX", "JPG/PNG", "DICOM", "CSV", "HL7"].map(f => (
                  <span key={f} style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 6,
                    background: "#f1f5f9", color: "#64748b", fontWeight: 500
                  }}>{f}</span>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>
                How it works
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "📄", title: "Upload", desc: "Drop any clinical document — PDFs, scans, lab CSVs, DICOM imaging" },
                  { icon: "🛡️", title: "De-identify", desc: "Names, DOB, MRN, and all PHI are stripped automatically before analysis" },
                  { icon: "🧬", title: "Analyze", desc: "MedGemma reads the case. Gemini verifies claims against 40+ real sources" },
                  { icon: "📋", title: "Report", desc: "Receive a cited second opinion in 2-3 minutes with evidence verdicts" },
                ].map((step, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 18px", background: "#fff", borderRadius: 14,
                    border: "1px solid #f1f5f9"
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: "#f8fafc",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, flexShrink: 0
                    }}>{step.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{step.title}</div>
                      <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginTop: 2 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 18px", borderRadius: 12,
              background: "#fefce8", border: "1px solid #fef08a",
              marginTop: 24, fontSize: 12.5, color: "#854d0e", lineHeight: 1.5
            }}>
              <span style={{ flexShrink: 0 }}><ShieldIcon /></span>
              <div>
                <strong>Zero PHI exposure.</strong> All patient identifiers are removed client-side before 
                any data reaches AI models. Files are not stored after analysis.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedScenario && (
        <Dialog
          scenario={selectedScenario}
          onClose={() => setSelectedScenario(null)}
        />
      )}
      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} />}
    </div>
  );
}
