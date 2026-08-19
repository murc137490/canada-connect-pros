import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveStorageDisplayUrl } from "@/lib/resolveStorageUrl";
import { RETENTION_CONFIG } from "@/config/legalConfig";

const EVIDENCE_BUCKET = "booking-evidence";

function isVideoFile(name: string) {
  return /\.(mp4|mov|webm|m4v|ogg)$/i.test(name);
}

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

export default function BookingEvidenceGallery({ bookingId }: { bookingId: string }) {
  const { t } = useLanguage();
  const d = t.dashboard;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<{ name: string; url: string }[]>([]);

  const prefix = useMemo(() => bookingId, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.storage.from(EVIDENCE_BUCKET).list(prefix);
        const names = (data ?? []).map((x) => x.name).filter(Boolean).slice(0, 5);
        const resolved = await Promise.all(
          names.map(async (name) => {
            const url = await resolveStorageDisplayUrl(
              EVIDENCE_BUCKET,
              `${prefix}/${name}`,
              RETENTION_CONFIG.signedUrlTtlSeconds,
            );
            return url ? { name, url } : null;
          }),
        );
        if (!cancelled) setItems(resolved.filter(Boolean) as { name: string; url: string }[]);
      } catch {
        if (!cancelled) setItems([]);
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
        {d.evidenceGalleryLoading}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">{d.evidenceGalleryEmpty}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ name, url }) => (
          <div key={name} className="rounded-md overflow-hidden border bg-background">
            {isImageFile(name) ? (
              <img src={url} alt={d.evidenceGalleryProofAlt} className="w-full h-28 object-cover" />
            ) : isVideoFile(name) ? (
              <video src={url} className="w-full h-28 object-cover" controls preload="metadata" />
            ) : (
              <a href={url} target="_blank" rel="noreferrer" className="block p-2 text-xs text-primary hover:underline">
                {d.evidenceGalleryOpenFile}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
