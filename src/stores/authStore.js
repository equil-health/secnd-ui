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

export default useAuthStore;
