import { NavLink, useLocation } from 'react-router';
import { LayoutDashboard, Palette, Settings, ShieldCheck, Users, Package, Activity, Eye } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const dashboardNav: NavItem[] = [
  { label: 'My Brands', path: ROUTES.DASHBOARD_BRANDS, icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Create Brand', path: ROUTES.WIZARD, icon: <Palette className="h-5 w-5" /> },
  { label: 'Settings', path: ROUTES.DASHBOARD_SETTINGS, icon: <Settings className="h-5 w-5" /> },
];

const adminNav: NavItem[] = [
  { label: 'Users', path: ROUTES.ADMIN_USERS, icon: <Users className="h-5 w-5" /> },
  { label: 'Products', path: ROUTES.ADMIN_PRODUCTS, icon: <Package className="h-5 w-5" /> },
  { label: 'Jobs', path: ROUTES.ADMIN_JOBS, icon: <Activity className="h-5 w-5" /> },
  { label: 'Moderation', path: ROUTES.ADMIN_MODERATION, icon: <Eye className="h-5 w-5" /> },
  { label: 'Health', path: ROUTES.ADMIN_HEALTH, icon: <ShieldCheck className="h-5 w-5" /> },
];

function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const location = useLocation();
  const isAdminSection = location.pathname.startsWith('/admin');

  const navItems = isAdminSection ? adminNav : dashboardNav;

  return (
    <aside
      className={cn(
        'fixed left-0 top-[var(--bmn-header-height)] z-[var(--bmn-z-sticky)] h-[calc(100dvh-var(--bmn-header-height))]',
        'w-[var(--bmn-sidebar-width)] border-r border-border bg-surface transition-transform duration-300',
        'md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <nav className="flex flex-col gap-1 p-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {isAdminSection ? 'Admin' : 'Navigation'}
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.DASHBOARD_BRANDS}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text',
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Admin link for admin users when on dashboard */}
        {isAdmin && !isAdminSection && (
          <>
            <div className="my-3 border-t border-border" />
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Admin
            </div>
            <NavLink
              to={ROUTES.ADMIN}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                )
              }
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Admin Panel</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

export { Sidebar };
