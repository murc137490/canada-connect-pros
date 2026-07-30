import { useEffect, useState } from "react";
import { resolveStorageDisplayUrl } from "@/lib/resolveStorageUrl";
import { Loader2 } from "lucide-react";

type Props = {
  bucket: string;
  url: string | null | undefined;
  alt: string;
  className?: string;
};

/** Resolves private storage paths to signed URLs before rendering. */
export default function StorageDisplayImage({ bucket, url, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);
    if (!url?.trim()) return;
    void resolveStorageDisplayUrl(bucket, url).then((resolved) => {
      if (!cancelled) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, url]);

  if (!url?.trim()) return null;
  if (!src && !failed) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 border border-border rounded-lg ${className ?? ""}`}>
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }
  if (failed || !src) {
    return <p className="text-xs text-muted-foreground">Could not load image.</p>;
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
