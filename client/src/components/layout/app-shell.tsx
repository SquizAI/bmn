import { Outlet } from 'react-router';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface AppShellProps {
  /** Whether to show the sidebar. Wizard pages may hide it. */
  showSidebar?: boolean;
}

/**
 * Application shell with header, optional sidebar, and main content area.
 * Used for dashboard and admin layouts.
 */
function AppShell({ showSidebar = true }: AppShellProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {showSidebar && <Sidebar />}
      <main
        className={cn(
          'pt-0 transition-[margin] duration-300',
          showSidebar && sidebarOpen
            ? 'md:ml-[var(--bmn-sidebar-width)]'
            : 'ml-0',
        )}
      >
        <div className="mx-auto max-w-[var(--bmn-max-width-content)] p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export { AppShell };
