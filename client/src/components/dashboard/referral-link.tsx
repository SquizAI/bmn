import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ReferralLinkProps {
  referralUrl: string;
  referralCode: string;
  className?: string;
}

function ReferralLink({ referralUrl, referralCode, className }: ReferralLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="h-4 w-4 text-accent" />
        <CardTitle className="text-[13px]">Your Referral Link</CardTitle>
      </div>

      <p className="mb-3 text-[12px] text-text-secondary">
        Share your unique link and earn commissions on every successful referral.
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-surface-hover px-3 py-2">
          <p className="truncate text-[12px] font-mono text-text">
            {referralUrl}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          leftIcon={
            copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-text-muted">
        Code: <span className="font-mono font-medium text-text">{referralCode}</span>
      </p>
    </Card>
  );
}

export { ReferralLink };
