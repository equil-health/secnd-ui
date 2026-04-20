import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('secnd_token') || null,
  user: JSON.parse(localStorage.getItem('secnd_user') || 'null'),

  setAuth: (token, user) => {
    localStorage.setItem('secnd_token', token);
    localStorage.setItem('secnd_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('secnd_token');
    localStorage.removeItem('secnd_user');
    set({ token: null, user: null });
  },

  updateUser: (user) => {
    localStorage.setItem('secnd_user', JSON.stringify(user));
    set({ user });
  },

  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'admin',
  isDemo: () => get().user?.is_demo === true,
}));

// Keep in-memory state in sync with silent refreshes from utils/api.js.
// api.js dispatches `secnd:token-refreshed` after a successful renewal so
// the store reflects the new token + user without forcing a reload.
if (typeof window !== 'undefined') {
  window.addEventListener('secnd:token-refreshed', (e) => {
    const { token, user } = e.detail || {};
    if (token) useAuthStore.setState({ token, user: user || useAuthStore.getState().user });
  });

  // Cross-tab sync: if another tab refreshes the token, pick it up here.
  window.addEventListener('storage', (e) => {
    if (e.key === 'secnd_token') {
      useAuthStore.setState({
        token: e.newValue || null,
        user: e.newValue
          ? JSON.parse(localStorage.getItem('secnd_user') || 'null')
          : null,
      });
    }
  });
}

export default useAuthStore;
