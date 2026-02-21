import { Outlet } from 'react-router';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileFooterNav } from '@/components/layout/mobile-footer-nav';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface AppShellProps {
  /** Whether to show the sidebar. Wizard pages may hide it. */
  showSidebar?: boolean;
}

/**
 * Application shell with header, optional sidebar, chat sidebar, and main content area.
 * Used for dashboard and admin layouts.
 */
function AppShell({ showSidebar = true }: AppShellProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const chatOpen = useUIStore((s) => s.chatOpen);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {showSidebar && <Sidebar />}
      <main
        className={cn(
          'pt-(--bmn-header-height) transition-[margin] duration-300',
          showSidebar
            ? sidebarCollapsed
              ? 'md:ml-(--bmn-sidebar-collapsed-width)'
              : 'md:ml-(--bmn-sidebar-width)'
            : 'ml-0',
          chatOpen
            ? 'md:mr-[var(--bmn-chat-sidebar-width)]'
            : 'mr-0',
          showSidebar && 'pb-[calc(var(--bmn-mobile-footer-height)+env(safe-area-inset-bottom))] md:pb-0',
        )}
      >
        <div className="mx-auto max-w-[var(--bmn-max-width-content)] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      {showSidebar && <MobileFooterNav />}
      <ChatSidebar />
    </div>
  );
}

export { AppShell };
