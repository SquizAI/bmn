import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import { Menu, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toggleTheme, getResolvedTheme } from '@/lib/theme';

interface HeaderProps {
  className?: string;
}

function Header({ className }: HeaderProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [isDark, setIsDark] = useState(() => getResolvedTheme() === 'dark');

  const handleToggleTheme = () => {
    toggleTheme();
    setIsDark(getResolvedTheme() === 'dark');
  };

  // Sync on mount in case it changed externally
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-(--bmn-z-sticky) flex h-(--bmn-header-height) items-center justify-between',
        'border-b border-border bg-surface/80 backdrop-blur-lg px-5 md:px-8',
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
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-0">
          <span className="text-base font-bold tracking-tight text-text">brand</span>
          <span className="text-base font-light tracking-tight text-text-muted">me</span>
          <span className="text-base font-bold tracking-tight text-text">now</span>
        </Link>
      </div>

      {/* Right: User actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {isAuthenticated ? (
          <>
            <Link to={ROUTES.DASHBOARD_SETTINGS}>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <div className="ml-1 flex items-center gap-2 rounded-md px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <span className="hidden text-sm text-text-secondary md:inline">
                {user?.email}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-3">
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
