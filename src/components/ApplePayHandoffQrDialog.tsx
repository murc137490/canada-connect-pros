import { useEffect, useRef, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import {
  applePayHandoffUrl,
  createApplePayHandoff,
  fetchApplePayHandoff,
  type ApplePayHandoffDraft,
} from "@/lib/applePayHandoff";
import { Button } from "@/components/ui/button";

type Props = {
  draft: ApplePayHandoffDraft;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  title: string;
  body: string;
  waitingLabel: string;
  closeLabel: string;
  errorLabel: string;
};

export default function ApplePayHandoffQrDialog({
  draft,
  open,
  onClose,
  onPaid,
  title,
  body,
  waitingLabel,
  closeLabel,
  errorLabel,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const wasOpen = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;

    let cancelled = false;
    setCreating(true);
    setError(null);
    setUrl(null);
    void (async () => {
      try {
        const row = await createApplePayHandoff(draftRef.current);
        if (cancelled) return;
        setUrl(applePayHandoffUrl(row.id));
      } catch (e) {
        if (!cancelled) setError((e as Error).message || errorLabel);
      } finally {
        if (!cancelled) setCreating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, errorLabel]);

  useEffect(() => {
    if (!open || !url) return;
    const id = url.split("/").pop();
    if (!id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const row = await fetchApplePayHandoff(id);
        if (cancelled || !row) return;
        if (row.status === "paid") onPaid();
      } catch {
        /* ignore poll errors */
      }
    };
    const interval = window.setInterval(() => {
      void tick();
    }, 2500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, url, onPaid]);

  if (!open) return null;

  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(url)}`
    : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
          </div>
        </div>

        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-border bg-white p-3">
          {creating ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="text-sm text-destructive text-center px-2">{error}</p>
          ) : qrSrc ? (
            <img src={qrSrc} alt="Apple Pay QR code" width={220} height={220} className="rounded-md" />
          ) : null}
        </div>

        {url ? (
          <p className="text-[11px] text-muted-foreground break-all text-center">
            <a href={url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
              {url}
            </a>
          </p>
        ) : null}

        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {waitingLabel}
        </p>

        <Button type="button" variant="outline" className="w-full" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  );
}
