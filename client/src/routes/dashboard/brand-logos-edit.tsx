import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Image as ImageIcon,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ImageGallery, type GalleryImage } from '@/components/image-gallery';
import { useBrandDetail } from '@/hooks/use-brand-detail';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { ROUTES, QUERY_KEYS } from '@/lib/constants';

// ------ Progress Bar ------

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg bg-surface-hover p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text">{message || 'Generating logos...'}</p>
        <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
}

// ------ Main Component ------

export default function BrandLogosEditPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { data: brand, isLoading, error } = useBrandDetail(brandId);

  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const genProgress = useGenerationProgress(jobId);

  // Reset generation state when complete
  if (genProgress.isComplete && jobId) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId!) });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
  }

  if (genProgress.isError && jobId) {
    addToast({ type: 'error', title: genProgress.error || 'Logo generation failed' });
    setJobId(null);
    setGenerating(false);
    genProgress.reset();
  }

  const logos = brand?.logos ?? [];

  // Initialize selected IDs from logos that have 'selected' status
  const logoImages: GalleryImage[] = logos.map((logo, i) => ({
    id: logo.id,
    url: logo.url,
    thumbnailUrl: logo.thumbnailUrl,
    status: logo.status === 'selected' ? 'selected' : 'none',
    label: `Logo ${i + 1}`,
  }));

  const handleToggleSelect = useCallback(
    async (logoId: string) => {
      if (!brandId) return;

      const newSelected = new Set(selectedIds);
      if (newSelected.has(logoId)) {
        newSelected.delete(logoId);
      } else {
        newSelected.add(logoId);
      }
      setSelectedIds(newSelected);

      // Persist selection to the API
      try {
        await apiClient.patch(`/api/v1/brands/${brandId}/logos/${logoId}`, {
          status: newSelected.has(logoId) ? 'selected' : 'generated',
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update logo selection';
        addToast({ type: 'error', title: msg });
      }
    },
    [brandId, selectedIds, queryClient, addToast],
  );

  const handleGenerateMore = useCallback(async () => {
    if (!brandId || generating) return;
    setGenerating(true);
    try {
      const result = await apiClient.post<{ jobId: string }>(
        `/api/v1/brands/${brandId}/generate/logos`,
      );
      if (result?.jobId) {
        setJobId(result.jobId);
      } else {
        // No job ID returned -- just refresh
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        setGenerating(false);
        addToast({ type: 'success', title: 'Logos generated' });
      }
    } catch (err) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : 'Failed to start logo generation';
      addToast({ type: 'error', title: msg });
    }
  }, [brandId, generating, queryClient, addToast]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !brandId) return;

      setUploading(true);
      try {
        // 1. Upload file to Supabase Storage
        const ext = file.name.split('.').pop() || 'png';
        const storagePath = `brands/${brandId}/logos/upload-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // 2. Register the uploaded logo with the server
        await apiClient.post(`/api/v1/brands/${brandId}/upload-logo`, {
          url: publicUrl,
          fileName: file.name,
        });

        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        addToast({ type: 'success', title: 'Logo uploaded successfully' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        addToast({ type: 'error', title: msg });
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [brandId, queryClient, addToast],
  );

  // ------ Loading / Error States ------

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-lg text-text-secondary">Brand not found</p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text">{brand.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="text-sm text-text-secondary">
                Logo Gallery ({logoImages.length} logos)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            onClick={handleUploadClick}
            loading={uploading}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload Logo
          </Button>
          <Button
            onClick={handleGenerateMore}
            loading={generating}
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            Generate More
          </Button>
        </div>
      </div>

      {/* Generation Progress */}
      {generating && jobId && (
        <ProgressBar progress={genProgress.progress} message={genProgress.message} />
      )}

      {/* Logo Gallery */}
      {logoImages.length > 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <CardTitle>Your Logos</CardTitle>
            <span className="text-xs text-text-muted">Click to select/deselect</span>
          </div>

          <ImageGallery
            images={logoImages}
            columns={4}
            selectable
            selectedIds={selectedIds}
            onSelect={handleToggleSelect}
          />
        </Card>
      ) : (
        <Card variant="outlined" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
              <ImageIcon className="h-8 w-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-text">No logos yet</p>
              <p className="text-sm text-text-secondary mt-1">
                Generate logos using AI or upload your own
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleUploadClick}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Upload
              </Button>
              <Button
                onClick={handleGenerateMore}
                loading={generating}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Generate Logos
              </Button>
            </div>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
