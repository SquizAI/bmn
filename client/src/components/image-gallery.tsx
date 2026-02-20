import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ------ Types ------

export interface GalleryImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  label?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'selected' | 'none';
}

interface ImageGalleryProps {
  images: GalleryImage[];
  onSelect?: (id: string) => void;
  onReject?: (id: string) => void;
  onApprove?: (id: string) => void;
  selectedIds?: Set<string>;
  selectable?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

// ------ Lightbox ------

function Lightbox({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const image = images[currentIndex];
  if (!image) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-white/80 hover:text-white"
        >
          <X className="h-8 w-8" />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              className="absolute left-4 text-white/80 hover:text-white"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="absolute right-4 text-white/80 hover:text-white"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}

        <motion.img
          key={image.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          src={image.url}
          alt={image.label || 'Image'}
          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />

        {image.label && (
          <p className="absolute bottom-6 text-center text-sm text-white/80">
            {image.label} ({currentIndex + 1} of {images.length})
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ------ Gallery Item ------

function GalleryItem({
  image,
  isSelected,
  selectable,
  onSelect,
  onApprove,
  onReject,
  onZoom,
}: {
  image: GalleryImage;
  isSelected: boolean;
  selectable: boolean;
  onSelect?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onZoom: () => void;
}) {
  const statusColor =
    image.status === 'approved' || image.status === 'selected'
      ? 'ring-success'
      : image.status === 'rejected'
        ? 'ring-error'
        : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border-2 transition-all duration-200',
        isSelected
          ? 'border-primary ring-2 ring-primary/30'
          : image.status && image.status !== 'pending' && image.status !== 'none'
            ? `border-transparent ring-2 ${statusColor}`
            : 'border-border hover:border-border-hover',
      )}
    >
      <img
        src={image.thumbnailUrl || image.url}
        alt={image.label || 'Gallery image'}
        className="aspect-square w-full object-cover"
        loading="lazy"
      />

      {/* Overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
        <button
          type="button"
          onClick={onZoom}
          className="rounded-full bg-white/90 p-2 text-text transition-transform hover:scale-110"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {selectable && onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              'rounded-full p-2 transition-transform hover:scale-110',
              isSelected ? 'bg-primary text-white' : 'bg-white/90 text-text',
            )}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Approve / Reject buttons */}
      {(onApprove || onReject) && (
        <div className="absolute bottom-2 left-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onApprove && (
            <Button
              size="sm"
              variant={image.status === 'approved' ? 'success' : 'outline'}
              onClick={onApprove}
              className="flex-1 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              Approve
            </Button>
          )}
          {onReject && (
            <Button
              size="sm"
              variant={image.status === 'rejected' ? 'danger' : 'outline'}
              onClick={onReject}
              className="flex-1 text-xs"
            >
              <X className="mr-1 h-3 w-3" />
              Reject
            </Button>
          )}
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Status badge */}
      {image.status && image.status !== 'none' && image.status !== 'pending' && (
        <div
          className={cn(
            'absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium',
            image.status === 'approved' || image.status === 'selected'
              ? 'bg-success text-white'
              : 'bg-error text-white',
          )}
        >
          {image.status}
        </div>
      )}

      {/* Label */}
      {image.label && (
        <div className="border-t border-border bg-surface px-3 py-2">
          <p className="truncate text-xs font-medium text-text">{image.label}</p>
        </div>
      )}
    </motion.div>
  );
}

// ------ Image Gallery ------

function ImageGallery({
  images,
  onSelect,
  onReject,
  onApprove,
  selectedIds = new Set(),
  selectable = false,
  columns = 4,
  className,
}: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const colsClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  const handlePrev = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : null));
  }, [images.length]);

  return (
    <>
      <div className={cn('grid gap-4', colsClass, className)}>
        {images.map((image, index) => (
          <GalleryItem
            key={image.id}
            image={image}
            isSelected={selectedIds.has(image.id)}
            selectable={selectable}
            onSelect={onSelect ? () => onSelect(image.id) : undefined}
            onApprove={onApprove ? () => onApprove(image.id) : undefined}
            onReject={onReject ? () => onReject(image.id) : undefined}
            onZoom={() => setLightboxIndex(index)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </>
  );
}

export { ImageGallery, Lightbox };
