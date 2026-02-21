import { motion } from 'motion/react';
import { Wrench, Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ChatToolCardProps {
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: Record<string, unknown>;
  error?: string;
}

/** Human-readable tool name mapping */
const TOOL_LABELS: Record<string, string> = {
  listUserBrands: 'Listing brands',
  getBrandSummary: 'Fetching brand summary',
  getBrandIdentity: 'Reading brand identity',
  getBrandAssets: 'Loading brand assets',
  getBrandProducts: 'Loading products',
  getBrandBundles: 'Loading bundles',
  getSocialAnalysis: 'Reading social analysis',
  searchProductCatalog: 'Searching product catalog',
  updateBrandIdentity: 'Updating brand identity',
  updateBrandName: 'Renaming brand',
  updateBrandColors: 'Updating color palette',
  addProductToBrand: 'Adding product',
  removeProductFromBrand: 'Removing product',
  createBundle: 'Creating bundle',
  updateBundleConfig: 'Updating bundle',
  regenerateLogos: 'Generating logos',
  regenerateMockup: 'Generating mockup',
  generateTaglines: 'Generating taglines',
  generateBrandContent: 'Creating content',
  getMyProfile: 'Loading profile',
  getCreditBalance: 'Checking credits',
  getSubscriptionInfo: 'Loading subscription',
  getOrganization: 'Loading organization',
  listOrgMembers: 'Listing team members',
  listOrgBrands: 'Listing org brands',
  inviteOrgMember: 'Sending invite',
  removeOrgMember: 'Removing member',
  updateOrgSettings: 'Updating org settings',
  adminListUsers: 'Listing all users',
  adminListAllBrands: 'Listing all brands',
  adminGetSystemMetrics: 'Loading system metrics',
  adminGrantCredits: 'Granting credits',
};

function ChatToolCard({ name, status, input, error }: ChatToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[name] || name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 my-1.5"
    >
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          status === 'running' && 'border-info/30 bg-info-bg',
          status === 'complete' && 'border-success/30 bg-success-bg',
          status === 'error' && 'border-error/30 bg-error-bg',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-info" />}
            {status === 'complete' && <Check className="h-3.5 w-3.5 text-success" />}
            {status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-error" />}
            <Wrench className="h-3 w-3 text-text-muted" />
            <span className="font-medium text-text">{label}</span>
          </div>
          {(input || error) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 overflow-hidden border-t border-border/50 pt-2"
          >
            {error && (
              <p className="text-error">{error}</p>
            )}
            {input && !error && (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-text-muted">
                {JSON.stringify(input, null, 2)}
              </pre>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export { ChatToolCard };
