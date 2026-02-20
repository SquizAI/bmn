import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  chatOpen: boolean;
  toasts: ToastItem[];

  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setChatOpen: (open: boolean) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'system',
        sidebarOpen: true,
        chatOpen: false,
        toasts: [],

        setTheme: (theme) => {
          set({ theme }, false, 'setTheme');
          // Apply via data-theme attribute (matches design-tokens.css [data-theme="dark"])
          let resolved: 'light' | 'dark';
          if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          } else {
            resolved = theme;
          }
          document.documentElement.setAttribute('data-theme', resolved);
        },

        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'setSidebarOpen'),

        toggleSidebar: () =>
          set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'toggleSidebar'),

        setChatOpen: (open) => set({ chatOpen: open }, false, 'setChatOpen'),

        addToast: (toast) => {
          const id = crypto.randomUUID();
          set(
            (state) => ({ toasts: [...state.toasts, { ...toast, id }] }),
            false,
            'addToast',
          );
          setTimeout(() => get().removeToast(id), toast.duration || 5000);
        },

        removeToast: (id) =>
          set(
            (state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }),
            false,
            'removeToast',
          ),
      }),
      {
        name: 'bmn-ui',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      },
    ),
    { name: 'UIStore' },
  ),
);
