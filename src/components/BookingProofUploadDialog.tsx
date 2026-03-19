import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EVIDENCE_BUCKET = "booking-evidence";

function getFileExt(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "bin";
}

export default function BookingProofUploadDialog({
  open,
  onOpenChange,
  bookingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
}) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const title = useMemo(() => (bookingId ? `Upload proof for booking #${bookingId}` : "Upload proof"), [bookingId]);

  const maxItems = 3;

  const onPickFiles = (picked: FileList | null) => {
    const next = Array.from(picked ?? []);
    const remaining = Math.max(0, maxItems - files.length);
    if (next.length > remaining) {
      toast({ title: "Limit reached", description: `You can upload up to ${maxItems} items.`, variant: "destructive" });
    }
    setFiles((prev) => [...prev, ...next.slice(0, remaining)]);
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!bookingId) return;
    if (files.length === 0) {
      toast({ title: "No files selected", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      for (const f of files) {
        const ext = getFileExt(f.name);
        // Use `${bookingId}/...` so the client can list by prefix.
        const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, f, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
      }
      toast({ title: "Proof uploaded", description: "Your evidence has been added for this booking." });
      setFiles([]);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-gray-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Upload 2–3 photos/videos showing the work was completed as the client requested.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">Select files (images/videos)</label>
            <Input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
              disabled={uploading || !bookingId}
            />
          </div>

          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => {
                const isVideo = f.type.startsWith("video/");
                const url = URL.createObjectURL(f);
                return (
                  <div key={i} className="relative w-24 h-24 rounded-md border overflow-hidden bg-background">
                    {isVideo ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-background/90 border rounded-full p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => removeAt(i)}
                      aria-label="Remove file"
                      disabled={uploading}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFiles([])} disabled={uploading || files.length === 0}>
              Clear
            </Button>
            <Button type="button" onClick={handleUpload} disabled={uploading || !bookingId}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : "Upload proof"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

