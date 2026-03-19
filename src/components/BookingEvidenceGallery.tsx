import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EVIDENCE_BUCKET = "booking-evidence";

function isVideoFile(name: string) {
  return /\.(mp4|mov|webm|m4v|ogg)$/i.test(name);
}

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

export default function BookingEvidenceGallery({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const prefix = useMemo(() => bookingId, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // We store evidence under `${bookingId}/...` so we can list by prefix.
        const { data } = await supabase.storage.from(EVIDENCE_BUCKET).list(prefix);
        const names = (data ?? []).map((d) => d.name).filter(Boolean);
        if (!cancelled) setFileNames(names.slice(0, 5));
      } catch (e) {
        // Evidence is optional; don't block the claim flow if listing fails.
        if (!cancelled) setFileNames([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Loader2 size={14} className="animate-spin" />
        Loading evidence…
      </div>
    );
  }

  if (fileNames.length === 0) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">No proof media uploaded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {fileNames.map((name) => {
          const fullPath = `${prefix}/${name}`;
          const urlData = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(fullPath);
          const url = urlData.data.publicUrl;
          return (
            <div key={name} className="rounded-md overflow-hidden border bg-background">
              {isImageFile(name) ? (
                // Images: show thumbnail.
                // Note: evidence bucket should allow public read for these publicUrl links to work.
                <img src={url} alt="Booking proof" className="w-full h-28 object-cover" />
              ) : isVideoFile(name) ? (
                // Videos: show playable preview.
                <video src={url} className="w-full h-28 object-cover" controls preload="metadata" />
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="block p-2 text-xs text-primary hover:underline">
                  Open file
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

