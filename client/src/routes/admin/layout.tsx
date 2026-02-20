import { AppShell } from '@/components/layout/app-shell';

/**
 * Admin layout shell.
 * Wraps admin pages with header + admin sidebar (sidebar content
 * is driven by the Sidebar component which detects /admin path).
 */
export default function AdminLayout() {
  return <AppShell showSidebar />;
}
