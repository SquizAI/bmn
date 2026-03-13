import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { ROUTES } from '@/lib/constants';

// ------ Request Reset Form Schema ------

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetForm = z.infer<typeof resetSchema>;

// ------ Set New Password Schema ------

const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type NewPasswordForm = z.infer<typeof newPasswordSchema>;

// ------ Set New Password Component ------

function SetNewPasswordForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
  });

  const onSubmit = async (data: NewPasswordForm) => {
    try {
      setError(null);
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.LOGIN), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update password. Please try again.',
      );
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-text">Password updated</h2>
          <p className="mt-3 text-sm text-text-muted">
            Your password has been reset successfully. Redirecting to login...
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="light" className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <Link
            to={ROUTES.LOGIN}
            className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-text">Set new password</h2>
          <p className="mt-2 text-sm text-text-muted">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-error-border bg-error-bg px-4 py-3 text-[13px] text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Input
            label="New Password"
            type="password"
            placeholder="Enter new password"
            leftAddon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Confirm new password"
            leftAddon={<Lock className="h-4 w-4" />}
            error={errors.confirmPassword?.message}
            required
            {...register('confirmPassword')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Set New Password
          </Button>
        </form>
      </div>
    </div>
  );
}

// ------ Main Page ------

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const isRecovery = searchParams.get('type') === 'recovery';

  // If URL has ?type=recovery, show the "Set New Password" form
  if (isRecovery) {
    return <SetNewPasswordForm />;
  }

  return <RequestResetForm />;
}

// ------ Request Reset Form (original) ------

function RequestResetForm() {
  const { resetPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetForm) => {
    try {
      setError(null);
      await resetPassword(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-text">Check your email</h2>
          <p className="mt-3 text-sm text-text-muted">
            If an account exists with that email, we sent a password reset link.
            Check your inbox and follow the instructions.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="light" className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <Link
            to={ROUTES.LOGIN}
            className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-text">Reset your password</h2>
          <p className="mt-2 text-sm text-text-muted">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-error-border bg-error-bg px-4 py-3 text-[13px] text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            leftAddon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            required
            {...register('email')}
          />

          <Button type="submit" fullWidth loading={isSubmitting}>
            Send Reset Link
          </Button>
        </form>
      </div>
    </div>
  );
}
