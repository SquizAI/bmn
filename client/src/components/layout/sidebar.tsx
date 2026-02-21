import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { dashboardNav, adminNav, adminLinkItem } from './nav-items';

function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith('/admin');

  const navItems = isAdminSection ? adminNav : dashboardNav;

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--bmn-z-sticky)-1)] bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-(--bmn-header-height) z-(--bmn-z-sticky)',
          'h-[calc(100dvh-var(--bmn-header-height))]',
          'border-r border-border bg-surface',
          'transition-all duration-300',
          // Mobile: always full sidebar width, slide in/out
          'w-(--bmn-sidebar-width)',
          'md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: dynamic width based on collapsed state
          sidebarCollapsed
            ? 'md:w-(--bmn-sidebar-collapsed-width)'
            : 'md:w-(--bmn-sidebar-width)',
        )}
      >
        <nav className="flex h-full flex-col gap-0.5 p-3">
          {/* Section label */}
          <div
            className={cn(
              'mb-3 px-3 text-xs sm:text-[11px] font-medium uppercase tracking-widest text-text-muted',
              'transition-opacity duration-200',
              sidebarCollapsed && 'md:hidden',
            )}
          >
            {isAdminSection ? 'Admin' : 'Navigation'}
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ROUTES.DASHBOARD_BRANDS}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-md px-3 py-3 sm:py-2 text-sm sm:text-[13px] font-medium transition-colors',
                  sidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-3',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                )
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span
                className={cn(
                  'transition-opacity duration-200',
                  sidebarCollapsed && 'md:hidden',
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}

          {/* Admin link for admin users when on dashboard */}
          {isAdmin && !isAdminSection && (
            <>
              <div className="my-3 border-t border-border" />
              <div
                className={cn(
                  'mb-3 px-3 text-xs sm:text-[11px] font-medium uppercase tracking-widest text-text-muted',
                  'transition-opacity duration-200',
                  sidebarCollapsed && 'md:hidden',
                )}
              >
                Admin
              </div>
              <NavLink
                to={adminLinkItem.path}
                title={sidebarCollapsed ? adminLinkItem.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-md px-3 py-3 sm:py-2 text-sm sm:text-[13px] font-medium transition-colors',
                    sidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-3',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                  )
                }
              >
                <span className="shrink-0">{adminLinkItem.icon}</span>
                <span
                  className={cn(
                    'transition-opacity duration-200',
                    sidebarCollapsed && 'md:hidden',
                  )}
                >
                  {adminLinkItem.label}
                </span>
              </NavLink>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Collapse/expand toggle — desktop only */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={cn(
              'hidden md:flex items-center rounded-md px-3 py-2 text-[13px] font-medium',
              'text-text-muted hover:bg-surface-hover hover:text-text transition-colors',
              sidebarCollapsed ? 'justify-center px-0' : 'gap-3',
            )}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </nav>
      </aside>
    </>
  );
}

export { Sidebar };
