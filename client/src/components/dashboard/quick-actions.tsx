import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Sparkles,
  BarChart3,
  Package,
  Share2,
  Plug,
  FileText,
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const actions: QuickAction[] = [
  {
    label: 'Generate Content',
    description: 'AI social media posts',
    icon: <Sparkles className="h-5 w-5" />,
    href: '/dashboard/content',
    color: 'bg-accent-light text-accent',
  },
  {
    label: 'View Analytics',
    description: 'Customer insights',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/dashboard/analytics',
    color: 'bg-info-bg text-info',
  },
  {
    label: 'Create Brand',
    description: 'Start the wizard',
    icon: <Package className="h-5 w-5" />,
    href: ROUTES.WIZARD,
    color: 'bg-success-bg text-success',
  },
  {
    label: 'Referrals',
    description: 'Earn by sharing',
    icon: <Share2 className="h-5 w-5" />,
    href: '/dashboard/referrals',
    color: 'bg-warning-bg text-warning',
  },
  {
    label: 'Integrations',
    description: 'Connect stores',
    icon: <Plug className="h-5 w-5" />,
    href: '/dashboard/integrations',
    color: 'bg-primary-light text-primary',
  },
  {
    label: 'My Brands',
    description: 'Manage brands',
    icon: <FileText className="h-5 w-5" />,
    href: ROUTES.DASHBOARD_BRANDS,
    color: 'bg-secondary-light text-secondary',
  },
];

interface QuickActionsProps {
  className?: string;
}

function QuickActions({ className }: QuickActionsProps) {
  return (
    <Card variant="default" padding="md" className={className}>
      <CardTitle className="mb-4 text-[13px]">Quick Actions</CardTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((action, i) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
          >
            <Link
              to={action.href}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center transition-all hover:border-border-hover hover:shadow-sm"
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                  action.color,
                )}
              >
                {action.icon}
              </div>
              <div>
                <p className="text-[12px] font-medium text-text">{action.label}</p>
                <p className="text-[10px] text-text-muted">{action.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

export { QuickActions };
