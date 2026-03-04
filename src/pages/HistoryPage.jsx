import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCases } from '../utils/api';
import useSimulation from '../hooks/useSimulation';
import UserBadge from '../components/UserBadge';
import SkeletonTable from '../components/SkeletonTable';

const STATUS_BADGE = {
  submitted: 'bg-blue-100 text-blue-700',
  running: 'bg-indigo-100 text-indigo-700',
  complete: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function HistoryPage() {
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 20;
  const navigate = useNavigate();
  const { runSimulation } = useSimulation();

  useEffect(() => {
    setLoading(true);
    listCases(page, perPage)
      .then((res) => {
        setCases(res.cases);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / perPage);

  const handleRunSim = (e, caseItem) => {
    e.preventDefault();
    e.stopPropagation();
    runSimulation(caseItem.id);
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Home
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">Case History</h1>
        <span className="text-sm text-gray-400 ml-auto mr-4">{total} cases</span>
        <UserBadge />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : cases.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No cases yet</p>
            <Link to="/" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
              Submit your first case
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cases.map((c) => {
                const isComplete = c.status === 'complete' || c.status === 'completed';
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between bg-white border rounded-lg px-4 py-3 hover:border-indigo-300 transition-colors"
                  >
                    <Link
                      to={`/report/${c.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {c.presenting_complaint || 'Untitled case'}
                        </p>
                        {c.diagnosis_mode === 'zebra' && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded">
                            Zebra
                          </span>
                        )}
                      </div>
                      {c.primary_diagnosis && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Dx: {c.primary_diagnosis}
                        </p>
                      )}
                    </Link>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {isComplete && (
                        <button
                          onClick={(e) => handleRunSim(e, c)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          Run Sim
                        </button>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
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
