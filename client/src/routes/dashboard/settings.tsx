import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import {
  User,
  CreditCard,
  Shield,
  ExternalLink,
  Mail,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { SUBSCRIPTION_TIERS } from '@/lib/constants';
import { useMutation, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';
import { formatCurrency, cn } from '@/lib/utils';

// ------ Schema ------

const profileSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
});

type ProfileForm = z.infer<typeof profileSchema>;

// ------ Types ------

interface UserProfile {
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

interface UserSubscription {
  tier: string;
  status: string;
  currentPeriodEnd: string;
  usage: {
    brands: number;
    brandsLimit: number;
    logoGens: number;
    logoGensLimit: number;
    mockupGens: number;
    mockupGensLimit: number;
  };
}

// ------ Component ------

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: QUERY_KEYS.userProfile(),
    queryFn: () => apiClient.get<UserProfile>('/api/v1/auth/me'),
  });

  // Fetch subscription
  const { data: subscription } = useQuery({
    queryKey: QUERY_KEYS.userSubscription(),
    queryFn: () => apiClient.get<UserSubscription>('/api/v1/payments/subscription'),
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) =>
      apiClient.put('/api/v1/auth/me', data),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Profile updated!' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to update profile' });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: profile?.fullName || user?.user_metadata?.full_name || '',
      email: profile?.email || user?.email || '',
    },
  });

  const onSubmit = (data: ProfileForm) => {
    updateProfile.mutate(data);
  };

  const handleOpenBillingPortal = async () => {
    try {
      const data = await apiClient.post<{ url: string }>('/api/v1/payments/portal');
      window.open(data.url, '_blank');
    } catch {
      addToast({ type: 'error', title: 'Failed to open billing portal' });
    }
  };

  // Find current tier info
  const currentTier = subscription
    ? Object.values(SUBSCRIPTION_TIERS).find(
        (t) => t.key === subscription.tier,
      ) || SUBSCRIPTION_TIERS.FREE
    : SUBSCRIPTION_TIERS.FREE;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your profile, subscription, and account settings.
        </p>
      </div>

      {/* Profile Section */}
      <Card variant="outlined" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <User className="h-5 w-5 text-primary" />
          <CardTitle>Profile</CardTitle>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              placeholder="Your name"
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              leftAddon={<Mail className="h-4 w-4" />}
              {...register('email')}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty}
              loading={updateProfile.isPending}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Subscription Section */}
      <Card variant="outlined" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Subscription</CardTitle>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Current plan */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Current Plan
            </p>
            <p className="mt-1 text-xl font-bold text-text">{currentTier.name}</p>
            <p className="text-sm text-text-secondary">
              {currentTier.price === 0
                ? 'Free'
                : `${formatCurrency(currentTier.price)}/month`}
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-text-muted">
                {subscription.status === 'active'
                  ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Expires ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            )}
          </div>

          {/* Usage */}
          {subscription?.usage && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Usage This Month
              </p>
              <UsageBar
                label="Brands"
                used={subscription.usage.brands}
                limit={subscription.usage.brandsLimit}
              />
              <UsageBar
                label="Logo Generations"
                used={subscription.usage.logoGens}
                limit={subscription.usage.logoGensLimit}
              />
              <UsageBar
                label="Mockup Generations"
                used={subscription.usage.mockupGens}
                limit={subscription.usage.mockupGensLimit}
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleOpenBillingPortal}
            leftIcon={<ExternalLink className="h-4 w-4" />}
          >
            Manage Billing
          </Button>
          {currentTier.key !== 'agency' && (
            <Button
              variant="primary"
              onClick={handleOpenBillingPortal}
            >
              Upgrade Plan
            </Button>
          )}
        </div>
      </Card>

      {/* Security Section */}
      <Card variant="outlined" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Security</CardTitle>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Password</p>
              <p className="text-xs text-text-secondary">
                Change your password via Supabase Auth
              </p>
            </div>
            <Button variant="outline" size="sm">
              Change Password
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-error">Delete Account</p>
                <p className="text-xs text-text-secondary">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="danger" size="sm">
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ------ Usage Bar ------

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div className="w-56">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={cn('font-medium', isNearLimit ? 'text-warning' : 'text-text')}>
          {used} / {isUnlimited ? 'Unlimited' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isNearLimit ? 'bg-warning' : 'bg-primary',
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
