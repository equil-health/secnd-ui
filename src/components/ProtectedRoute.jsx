import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
