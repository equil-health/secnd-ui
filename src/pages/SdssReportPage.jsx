import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sdssGetTask, sdssGetAudit } from '../utils/api';
import SecondOpinionPanel from '../components/SecondOpinionPanel';
import AuditReportViewer from '../components/AuditReportViewer';
import UserBadge from '../components/UserBadge';
import { exportSdssPDF, exportSdssDOCX, exportSdssHTML } from '../utils/sdssExport';

const TABS = [
  { key: 'report', label: 'Report' },
  { key: 'audit', label: 'Audit Trail' },
];

export default function SdssReportPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('report');
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    sdssGetTask(taskId)
      .then((res) => {
        setTask(res);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [taskId]);

  // Lazy-load audit when tab is clicked
  useEffect(() => {
    if (activeTab === 'audit' && !audit && !auditLoading) {
      setAuditLoading(true);
      sdssGetAudit(taskId)
        .then((res) => setAudit(res.audit_report))
        .catch(() => setAudit(null))
        .finally(() => setAuditLoading(false));
    }
  }, [activeTab, taskId, audit, auditLoading]);

  const result = task?.result;
  const mode = result?.mode || 'standard';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/second-opinion/history" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Archive
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">
          {result?.top_diagnosis || result?.primary_diagnosis || 'Second Opinion Report'}
        </h1>
        <span className="text-sm text-gray-400 ml-auto mr-4">
          {task?.created_at ? new Date(task.created_at).toLocaleString() : ''}
        </span>
        <UserBadge />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading report...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        ) : !result ? (
          <div className="text-center py-16 text-gray-400">
            <p>This analysis has no results yet.</p>
            <p className="text-xs mt-1">Status: {task?.status}</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b mb-6">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Export buttons */}
              <div className="ml-auto flex items-center gap-2">
                {activeTab === 'report' && (
                  <>
                    <ExportBtn label="PDF" onClick={() => exportSdssPDF(result, mode)} />
                    <ExportBtn label="DOCX" onClick={() => exportSdssDOCX(result, mode)} />
                    <ExportBtn label="HTML" onClick={() => exportSdssHTML(result, mode)} />
                  </>
                )}
                {activeTab === 'audit' && audit && (
                  <ExportBtn label="JSON" onClick={() => exportAuditJSON(audit, taskId)} />
                )}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'report' && (
              <SecondOpinionPanel loading={false} result={result} error={null} />
            )}

            {activeTab === 'audit' && (
              auditLoading ? (
                <div className="text-center py-12">
                  <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Loading audit data...</p>
                </div>
              ) : (
                <AuditReportViewer audit={audit} />
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ExportBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 text-gray-600 transition-colors"
    >
      {label}
    </button>
  );
}

function exportAuditJSON(audit, taskId) {
  const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_${taskId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
