import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Printer,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { useDispatchPrintExport } from '@/hooks/use-print-export';
import type { PrintSpecs } from '@/hooks/use-admin-templates';

interface PrintExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  productId: string;
  productName: string;
  printSpecs?: PrintSpecs;
}

export default function PrintExportDialog({
  isOpen,
  onClose,
  brandId,
  productId,
  productName,
  printSpecs,
}: PrintExportDialogProps) {
  const [format, setFormat] = useState<'pdf' | 'png_300dpi'>('pdf');
  const exportMutation = useDispatchPrintExport();

  const handleExport = () => {
    exportMutation.mutate({ brandId, productId, format });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-text-muted hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">Export for Print</h3>
              <p className="text-xs text-text-muted">{productName}</p>
            </div>
          </div>

          {/* Print specs */}
          {printSpecs && (
            <div className="mb-4 rounded-lg bg-surface p-3">
              <p className="mb-2 text-xs font-medium text-text-secondary">
                Print Specifications
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                <span>DPI: {printSpecs.dpi || 300}</span>
                <span>Color: {printSpecs.color_space || 'CMYK'}</span>
                <span>Bleed: {printSpecs.bleed_mm || 3}mm</span>
                <span>Safe Area: {printSpecs.safe_area_mm || 5}mm</span>
                {printSpecs.print_width_mm && (
                  <span>
                    Size: {printSpecs.print_width_mm}x{printSpecs.print_height_mm}mm
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Format selection */}
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-text-secondary">Export Format</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                  format === 'pdf'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-secondary hover:bg-surface'
                }`}
              >
                <FileText className="h-4 w-4" />
                PDF (Print-Ready)
              </button>
              <button
                type="button"
                onClick={() => setFormat('png_300dpi')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                  format === 'png_300dpi'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-secondary hover:bg-surface'
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                PNG (300 DPI)
              </button>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending || exportMutation.isSuccess}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : exportMutation.isSuccess ? (
              <>
                <Download className="h-4 w-4" />
                Export Started
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export {format === 'pdf' ? 'PDF' : 'PNG'}
              </>
            )}
          </button>

          {exportMutation.isSuccess && (
            <p className="mt-2 text-center text-xs text-green-500">
              Export job started. You will be notified when it is ready for download.
            </p>
          )}

          {exportMutation.isError && (
            <p className="mt-2 text-center text-xs text-red-500">
              Export failed. Please try again.
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
