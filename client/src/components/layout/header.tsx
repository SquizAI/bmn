import { Link } from 'react-router';
import { Menu, LogOut, Settings, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

function Header({ className }: HeaderProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header
      className={cn(
        'sticky top-0 z-[var(--bmn-z-sticky)] flex h-[var(--bmn-header-height)] items-center justify-between',
        'border-b border-border bg-surface px-4 md:px-6',
        className,
      )}
    >
      {/* Left: Menu toggle + Logo */}
      <div className="flex items-center gap-3">
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2 text-lg font-bold text-text">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">Brand Me Now</span>
        </Link>
      </div>

      {/* Right: User actions */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <Link to={ROUTES.DASHBOARD_SETTINGS}>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <User className="h-4 w-4 text-text-muted" />
              <span className="hidden text-sm text-text-secondary md:inline">
                {user?.email}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link to={ROUTES.LOGIN}>
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to={ROUTES.SIGNUP}>
              <Button variant="primary" size="sm">
                Sign up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export { Header };
