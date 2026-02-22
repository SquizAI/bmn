import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Home, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-accent/20"
        >
          <span className="text-4xl font-bold text-primary">404</span>
        </motion.div>

        <h1 className="text-2xl font-bold text-text">Page not found</h1>
        <p className="mt-2 text-text-secondary">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            leftIcon={<Home className="h-4 w-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Brand Me Now</span>
        </div>
      </motion.div>
    </div>
  );
}
