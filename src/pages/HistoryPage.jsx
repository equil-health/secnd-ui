import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../utils/api';

const STATUS_BADGE = {
  submitted: 'bg-blue-100 text-blue-700',
  running: 'bg-indigo-100 text-indigo-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function HistoryPage() {
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 20;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Home
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">Case History</h1>
        <span className="text-sm text-gray-400 ml-auto">{total} cases</span>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
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
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to={`/report/${c.id}`}
                  className="flex items-center justify-between bg-white border rounded-lg px-4 py-3 hover:border-indigo-300 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.presenting_complaint || 'Untitled case'}
                    </p>
                    {c.primary_diagnosis && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Dx: {c.primary_diagnosis}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
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
                </Link>
              ))}
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
