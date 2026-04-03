import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdssListTasks } from '../utils/api';
import UserBadge from '../components/UserBadge';
import SkeletonTable from '../components/SkeletonTable';

const STATUS_BADGE = {
  pending: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const MODE_BADGE = {
  standard: 'bg-gray-100 text-gray-600',
  zebra: 'bg-amber-100 text-amber-700 border border-amber-200',
};

export default function SdssHistoryPage() {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 20;
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    sdssListTasks(page, perPage)
      .then((res) => {
        setTasks(res.tasks || []);
        setTotal(res.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/second-opinion" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; New Analysis
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">Second Opinion Archive</h1>
        <span className="text-sm text-gray-400 ml-auto mr-4">{total} analyses</span>
        <UserBadge />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No second opinions yet</p>
            <Link to="/second-opinion" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
              Submit your first case
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.task_id}
                  onClick={() => t.status === 'complete' && navigate(`/second-opinion/${t.task_id}`)}
                  className={`flex items-center justify-between bg-white border rounded-lg px-4 py-3 transition-colors ${
                    t.status === 'complete' ? 'hover:border-indigo-300 cursor-pointer' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {t.top_diagnosis || t.primary_diagnosis || t.case_text_preview || 'Untitled case'}
                      </p>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        MODE_BADGE[t.mode] || MODE_BADGE.standard
                      }`}>
                        {t.mode === 'zebra' ? 'Zebra' : 'Standard'}
                      </span>
                    </div>
                    {t.case_text_preview && t.top_diagnosis && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.case_text_preview}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {t.has_critical_flags && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">
                        CRITICAL
                      </span>
                    )}
                    {t.has_audit && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded">
                        Audit
                      </span>
                    )}
                    {t.evidence_count > 0 && (
                      <span className="text-[10px] text-gray-400">{t.evidence_count} refs</span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
