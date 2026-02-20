import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/constants';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      await signInWithEmail(data.email, data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — Editorial branding */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#0a0a0a] lg:flex lg:flex-col lg:justify-between">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Gradient orb */}
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-gradient-to-br from-[#B8956A]/30 to-transparent blur-3xl" />
        <div className="absolute -left-16 bottom-1/4 h-64 w-64 rounded-full bg-gradient-to-tr from-white/5 to-transparent blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          {/* Logo */}
          <div>
            <span className="text-lg font-bold tracking-tight text-white">PRZNL</span>
          </div>

          {/* Hero text */}
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-white">
              Your brand,
              <br />
              <span className="text-[#B8956A]">engineered</span>
              <br />
              by AI.
            </h1>
            <p className="mt-6 text-base leading-relaxed text-white/50">
              From social presence to complete brand identity — logos, mockups,
              and revenue projections — in minutes.
            </p>
          </div>

          {/* Testimonial / social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#1a1a1a] text-[10px] font-medium text-white/60"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-white/40">
              Trusted by <span className="text-white/60 font-medium">2,000+</span> creators
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — Login form (force light mode so semantic tokens resolve correctly) */}
      <div data-theme="light" className="flex w-full flex-col justify-center bg-white px-6 lg:w-1/2 lg:px-20">
        {/* Mobile logo */}
        <div className="mb-12 lg:hidden">
          <span className="text-lg font-bold tracking-tight text-text">PRZNL</span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-text">Welcome back</h2>
            <p className="mt-2 text-sm text-text-muted">
              Sign in to continue building your brand.
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
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              leftAddon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <div className="flex justify-end">
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth loading={isSubmitting} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            fullWidth
            onClick={handleGoogleLogin}
            leftIcon={
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            }
          >
            Continue with Google
          </Button>

          <p className="mt-8 text-center text-[13px] text-text-muted">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.SIGNUP} className="font-medium text-text hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
