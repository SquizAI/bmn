import { NavLink, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { dashboardNav, adminNav } from './nav-items';

/**
 * Sticky bottom tab bar for mobile screens (< md: breakpoint).
 * Mirrors the sidebar navigation items.
 * Hidden on desktop and wizard pages (controlled by parent rendering).
 */
function MobileFooterNav() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith('/admin');

  const navItems = isAdminSection ? adminNav : dashboardNav;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-(--bmn-z-sticky)',
        'flex items-center justify-around',
        'h-[var(--bmn-mobile-footer-height)] border-t border-border',
        'bg-surface/95 backdrop-blur-md',
        'pb-[env(safe-area-inset-bottom)]',
        'md:hidden',
      )}
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === ROUTES.DASHBOARD_BRANDS}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-1',
              'text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-text-muted',
            )
          }
        >
          <span className="flex h-6 w-6 items-center justify-center">
            {item.icon}
          </span>
          <span className="leading-none">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export { MobileFooterNav };
