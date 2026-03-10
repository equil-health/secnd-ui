import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminGetStats,
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUsageSummary,
  adminGetUsageByModule,
  adminGetUsageErrors,
} from '../utils/api';
import UserBadge from '../components/UserBadge';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  expired: 'bg-red-100 text-red-700',
};

function getUserStatus(user) {
  if (!user.is_active) return 'inactive';
  if (user.is_demo && user.expires_at && new Date(user.expires_at) < new Date()) return 'expired';
  return 'active';
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');

  async function loadData() {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([adminGetStats(), adminListUsers()]);
      setStats(s);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleToggleActive(user) {
    await adminUpdateUser(user.id, { is_active: !user.is_active });
    loadData();
  }

  async function handleResetCounter(user) {
    await adminUpdateUser(user.id, { reset_reports_used: true });
    loadData();
  }

  async function handleDelete(user) {
    await adminDeleteUser(user.id);
    loadData();
  }

  function openCreateModal() {
    setEditUser(null);
    setModalOpen(true);
  }

  function openEditModal(user) {
    setEditUser(user);
    setModalOpen(true);
  }

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-indigo-700 hover:text-indigo-600">
              SECND
            </Link>
            <span className="text-sm text-gray-400">Admin Dashboard</span>
          </div>
          <UserBadge />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { id: 'users', label: 'Users' },
            { id: 'usage', label: 'Usage & Costs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'usage' && <UsageDashboard />}

        {activeTab === 'users' && loading ? (
          <AdminSkeleton />
        ) : activeTab === 'users' && error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : activeTab === 'users' ? (
          <>
            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Total Users"
                  value={stats.total_users}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  }
                  color="indigo"
                />
                <StatCard
                  label="Active Demos"
                  value={stats.active_demo_users}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  }
                  color="teal"
                />
                <StatCard
                  label="Total Cases"
                  value={stats.total_cases}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  }
                  color="amber"
                />
                <StatCard
                  label="Reports Generated"
                  value={stats.total_reports}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  }
                  color="purple"
                />
              </div>
            )}

            {/* User table header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">Users</h2>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                />
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Demo User
              </button>
            </div>

            {/* User table */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Reports</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u) => {
                    const status = getUserStatus(u);
                    const pct = u.max_reports ? Math.min(100, (u.reports_used / u.max_reports) * 100) : 0;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[status]}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${u.is_demo ? 'text-amber-600' : 'text-gray-500'}`}>
                            {u.is_demo ? 'Demo' : 'Regular'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.max_reports != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {u.reports_used}/{u.max_reports}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Unlimited</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {u.expires_at
                            ? new Date(u.expires_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(u)}
                              className="text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            {u.reports_used > 0 && (
                              <button
                                onClick={() => handleResetCounter(u)}
                                className="text-xs text-amber-600 hover:text-amber-800"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <UserModal
          user={editUser}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadData(); }}
        />
      )}
    </div>
  );
}

/* ── Usage Dashboard ───────────────────────────────────────────── */

function UsageDashboard() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('summary');

  async function loadUsage() {
    setLoading(true);
    try {
      const [s, b, e] = await Promise.all([
        adminGetUsageSummary(days),
        adminGetUsageByModule(days),
        adminGetUsageErrors(days, 20),
      ]);
      setSummary(s);
      setBreakdown(b);
      setErrors(e);
    } catch (err) {
      console.error('Usage load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsage(); }, [days]);

  if (loading) return <AdminSkeleton />;

  const totalCalls = summary?.services?.reduce((s, r) => s + r.total_calls, 0) || 0;
  const totalCost = summary?.services?.reduce((s, r) => s + parseFloat(r.total_cost_usd || 0), 0) || 0;
  const totalErrors = summary?.services?.reduce((s, r) => s + r.error_count, 0) || 0;
  const avgDuration = totalCalls
    ? Math.round(summary.services.reduce((s, r) => s + r.avg_duration_ms * r.total_calls, 0) / totalCalls)
    : 0;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Period:</span>
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition ${
              days === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d === 1 ? '24h' : `${d}d`}
          </button>
        ))}
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total API Calls" value={totalCalls.toLocaleString()} color="indigo"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
        />
        <StatCard label="Est. Cost (USD)" value={`$${totalCost.toFixed(4)}`} color="teal"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard label="Errors" value={totalErrors} color="amber"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
        />
        <StatCard label="Avg Duration" value={`${avgDuration}ms`} color="purple"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'summary', label: 'By Service' },
          { id: 'breakdown', label: 'By Operation' },
          { id: 'errors', label: 'Errors' },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              activeView === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* By Service table */}
      {activeView === 'summary' && summary?.services && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Success</th>
                <th className="px-4 py-3 text-right">Errors</th>
                <th className="px-4 py-3 text-right">Avg Duration</th>
                <th className="px-4 py-3 text-right">Input Tokens</th>
                <th className="px-4 py-3 text-right">Output Tokens</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.services.map((s) => (
                <tr key={s.service} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.service}</td>
                  <td className="px-4 py-3 text-right">{s.total_calls}</td>
                  <td className="px-4 py-3 text-right text-green-600">{s.success_count}</td>
                  <td className="px-4 py-3 text-right text-red-600">{s.error_count || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{s.avg_duration_ms}ms</td>
                  <td className="px-4 py-3 text-right text-gray-500">{(s.total_input_tokens || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{(s.total_output_tokens || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">${parseFloat(s.total_cost_usd || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By Operation table */}
      {activeView === 'breakdown' && breakdown?.breakdown && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Errors</th>
                <th className="px-4 py-3 text-right">Avg Duration</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdown.breakdown.map((b, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      b.module === 'pipeline' ? 'bg-indigo-50 text-indigo-700' :
                      b.module === 'breaking' ? 'bg-teal-50 text-teal-700' :
                      b.module === 'pulse' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {b.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.service}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.operation}</td>
                  <td className="px-4 py-3 text-right">{b.total_calls}</td>
                  <td className="px-4 py-3 text-right text-red-600">{b.errors || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{b.avg_duration_ms}ms</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">${parseFloat(b.total_cost_usd || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Errors table */}
      {activeView === 'errors' && errors && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          {errors.total_errors === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No errors in the last {days} day{days > 1 ? 's' : ''}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.errors.map((e, i) => (
                  <tr key={i} className="hover:bg-red-50/30">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">{e.module}</td>
                    <td className="px-4 py-3 text-xs">{e.service}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.operation}</td>
                    <td className="px-4 py-3 text-xs text-red-700 max-w-xs truncate" title={e.error_message}>
                      {e.error_message}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.duration_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
        </div>
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email || '',
    password: '',
    full_name: user?.full_name || '',
    expires_at: user?.expires_at ? user.expires_at.slice(0, 10) : '',
    max_reports: user?.max_reports ?? '',
    notes: user?.notes || '',
    reset_reports_used: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        const payload = {};
        if (form.full_name !== user.full_name) payload.full_name = form.full_name;
        if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
        if (form.max_reports !== '' && form.max_reports !== user.max_reports) {
          payload.max_reports = parseInt(form.max_reports);
        }
        if (form.notes !== (user.notes || '')) payload.notes = form.notes;
        if (form.reset_reports_used) payload.reset_reports_used = true;
        await adminUpdateUser(user.id, payload);
      } else {
        const payload = {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
        };
        if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
        if (form.max_reports !== '') payload.max_reports = parseInt(form.max_reports);
        if (form.notes) payload.notes = form.notes;
        await adminCreateUser(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {isEdit ? 'Edit User' : 'Create Demo User'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <>
              <Field label="Email" type="email" value={form.email} onChange={(v) => handleChange('email', v)} required />
              <Field label="Password" type="password" value={form.password} onChange={(v) => handleChange('password', v)} required />
            </>
          )}
          <Field label="Full Name" value={form.full_name} onChange={(v) => handleChange('full_name', v)} required />
          <Field label="Expires At" type="date" value={form.expires_at} onChange={(v) => handleChange('expires_at', v)} />
          <Field label="Max Reports" type="number" value={form.max_reports} onChange={(v) => handleChange('max_reports', v)} placeholder="Leave empty for unlimited" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.reset_reports_used}
                onChange={(e) => handleChange('reset_reports_used', e.target.checked)}
                className="rounded"
              />
              Reset usage counter to 0
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
