import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

const ROLE_STYLES = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  demo: 'bg-amber-100 text-amber-700 border-amber-200',
  user: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function UserBadge() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const roleKey = user.role === 'admin' ? 'admin' : user.is_demo ? 'demo' : 'user';
  const roleLabel = user.role === 'admin' ? 'Admin' : user.is_demo ? 'Demo' : 'User';
  const roleStyle = ROLE_STYLES[roleKey];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex items-center gap-3">
      {/* Name + role */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
          {user.full_name}
        </span>
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${roleStyle}`}>
          {roleLabel}
        </span>
      </div>

      {/* Demo usage indicator */}
      {user.is_demo && user.max_reports != null && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                user.reports_used >= user.max_reports
                  ? 'bg-red-500'
                  : user.reports_used >= user.max_reports * 0.8
                    ? 'bg-amber-500'
                    : 'bg-teal-500'
              }`}
              style={{ width: `${Math.min(100, (user.reports_used / user.max_reports) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500">
            {user.reports_used}/{user.max_reports}
          </span>
        </div>
      )}

      {/* Admin link */}
      {user.role === 'admin' && (
        <Link
          to="/admin"
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          Admin
        </Link>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
