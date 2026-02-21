import { useEffect } from 'react';
import useAppStore from '../stores/appStore';
import usePipeline from '../hooks/usePipeline';
import { getReport } from '../utils/api';
import Chat from '../components/Chat';
import CaseForm from '../components/CaseForm';
import PipelineTracker from '../components/PipelineTracker';
import ReportViewer from '../components/ReportViewer';

export default function HomePage() {
  const { activeCase, pipelineStatus, report, setReport, addMessage } =
    useAppStore();

  // Connect to pipeline WebSocket when a case is active
  usePipeline(activeCase?.id);

  // Fetch report when pipeline completes
  useEffect(() => {
    if (pipelineStatus === 'complete' && activeCase?.id && !report) {
      getReport(activeCase.id)
        .then((r) => {
          setReport(r);
          addMessage({
            role: 'ai',
            content: 'Report is ready. You can view the full analysis below or ask follow-up questions.',
            ts: new Date().toISOString(),
          });
        })
        .catch((err) => {
          addMessage({
            role: 'ai',
            content: `Failed to load report: ${err.message}`,
            ts: new Date().toISOString(),
            error: true,
          });
        });
    }
  }, [pipelineStatus, activeCase, report, setReport, addMessage]);

  return (
    <div className="h-screen flex flex-col">
      {/* Chat area + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <Chat />
        </div>

        {/* Right: Pipeline tracker (when running) */}
        {activeCase && pipelineStatus !== 'complete' && (
          <aside className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
            <PipelineTracker />
          </aside>
        )}
      </div>

      {/* Report viewer (when available) */}
      {report && (
        <div className="border-t bg-white p-6 max-h-[60vh] overflow-y-auto">
          <ReportViewer report={report} caseId={activeCase?.id} />
        </div>
      )}

      {/* Case form modal */}
      <CaseForm />
    </div>
  );
}
