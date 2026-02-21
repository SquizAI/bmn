import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router';
import { LayoutDashboard, Palette, Settings, ShieldCheck, Users, Package, Activity, Building2, Layers } from 'lucide-react';
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
  { label: 'My Brands', path: ROUTES.DASHBOARD_BRANDS, icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Create Brand', path: ROUTES.WIZARD, icon: <Palette className="h-4 w-4" /> },
  { label: 'Organization', path: ROUTES.DASHBOARD_ORGANIZATION, icon: <Building2 className="h-4 w-4" /> },
  { label: 'Settings', path: ROUTES.DASHBOARD_SETTINGS, icon: <Settings className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { label: 'Users', path: ROUTES.ADMIN_USERS, icon: <Users className="h-4 w-4" /> },
  { label: 'Products', path: ROUTES.ADMIN_PRODUCTS, icon: <Package className="h-4 w-4" /> },
  { label: 'Templates', path: ROUTES.ADMIN_TEMPLATES, icon: <Layers className="h-4 w-4" /> },
  { label: 'Jobs', path: ROUTES.ADMIN_JOBS, icon: <Activity className="h-4 w-4" /> },
];

function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
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
          'fixed left-0 top-(--bmn-header-height) z-(--bmn-z-sticky) h-[calc(100dvh-var(--bmn-header-height))]',
          'w-(--bmn-sidebar-width) border-r border-border bg-surface transition-transform duration-300',
          'md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <nav className="flex flex-col gap-0.5 p-3">
          <div className="mb-3 px-3 text-xs sm:text-[11px] font-medium uppercase tracking-widest text-text-muted">
            {isAdminSection ? 'Admin' : 'Navigation'}
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ROUTES.DASHBOARD_BRANDS}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-3 sm:py-2 text-sm sm:text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
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
              <div className="mb-3 px-3 text-xs sm:text-[11px] font-medium uppercase tracking-widest text-text-muted">
                Admin
              </div>
              <NavLink
                to={ROUTES.ADMIN}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-3 sm:py-2 text-sm sm:text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Panel</span>
              </NavLink>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

export { Sidebar };
