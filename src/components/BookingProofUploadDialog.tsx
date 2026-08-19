import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { locale } = useLanguage();
  const fr = locale === "fr";
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const copy = useMemo(
    () =>
      fr
        ? {
            titleWithId: (id: string) => `Téléverser une preuve pour la réservation n° ${id}`,
            title: "Téléverser une preuve",
            description: "Téléversez 2 ou 3 photos/vidéos montrant que le travail a été réalisé comme demandé.",
            selectFiles: "Choisir des fichiers (images/vidéos)",
            limitTitle: "Limite atteinte",
            limitDesc: (n: number) => `Vous pouvez téléverser jusqu’à ${n} fichiers.`,
            noFiles: "Aucun fichier sélectionné",
            uploadedTitle: "Preuve téléversée",
            uploadedDesc: "Vos preuves ont été ajoutées à cette réservation.",
            uploadFailed: "Échec du téléversement",
            removeFile: "Retirer le fichier",
            clear: "Effacer",
            upload: "Téléverser la preuve",
          }
        : {
            titleWithId: (id: string) => `Upload proof for booking #${id}`,
            title: "Upload proof",
            description: "Upload 2–3 photos/videos showing the work was completed as the client requested.",
            selectFiles: "Select files (images/videos)",
            limitTitle: "Limit reached",
            limitDesc: (n: number) => `You can upload up to ${n} items.`,
            noFiles: "No files selected",
            uploadedTitle: "Proof uploaded",
            uploadedDesc: "Your evidence has been added for this booking.",
            uploadFailed: "Upload failed",
            removeFile: "Remove file",
            clear: "Clear",
            upload: "Upload proof",
          },
    [fr],
  );

  const title = useMemo(
    () => (bookingId ? copy.titleWithId(bookingId) : copy.title),
    [bookingId, copy],
  );

  const maxItems = 3;

  const onPickFiles = (picked: FileList | null) => {
    const next = Array.from(picked ?? []);
    const remaining = Math.max(0, maxItems - files.length);
    if (next.length > remaining) {
      toast({ title: copy.limitTitle, description: copy.limitDesc(maxItems), variant: "destructive" });
    }
    setFiles((prev) => [...prev, ...next.slice(0, remaining)]);
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!bookingId) return;
    if (files.length === 0) {
      toast({ title: copy.noFiles, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      for (const f of files) {
        const ext = getFileExt(f.name);
        const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, f, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
      }
      toast({ title: copy.uploadedTitle, description: copy.uploadedDesc });
      setFiles([]);
      onOpenChange(false);
    } catch (e) {
      toast({ title: copy.uploadFailed, description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{copy.selectFiles}</label>
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
                      aria-label={copy.removeFile}
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
              {copy.clear}
            </Button>
            <Button type="button" onClick={handleUpload} disabled={uploading || !bookingId}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : copy.upload}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
