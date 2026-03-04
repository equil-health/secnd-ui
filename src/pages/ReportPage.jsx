import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReport } from '../utils/api';
import ReportViewer from '../components/ReportViewer';
import SkeletonReport from '../components/SkeletonReport';
import UserBadge from '../components/UserBadge';

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getReport(id)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Home
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">Report</h1>
        <div className="ml-auto"><UserBadge /></div>
      </header>

      <main className="p-6">
        {loading && <SkeletonReport />}
        {error && (
          <p className="text-sm text-red-600">Error: {error}</p>
        )}
        {report && <ReportViewer report={report} caseId={id} />}
      </main>
    </div>
  );
}
