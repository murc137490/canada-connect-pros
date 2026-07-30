import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  cropAvatarToBlob,
  getInitialAvatarCropScale,
  type AvatarCropTransform,
} from "@/lib/circularAvatarCrop";
import { cn } from "@/lib/utils";

const CONTAINER_SIZE = 280;
const CROP_DIAMETER = 220;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onConfirm: (blob: Blob) => Promise<void>;
};

export default function ProfileAvatarCropDialog({ open, onOpenChange, imageSrc, onConfirm }: Props) {
  const { t } = useLanguage();
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transform, setTransform] = useState<AvatarCropTransform>({ scale: 1, panX: 0, panY: 0 });

  useEffect(() => {
    if (!open) {
      setReady(false);
      setTransform({ scale: 1, panX: 0, panY: 0 });
    }
  }, [open]);

  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const initialScale = getInitialAvatarCropScale(img.naturalWidth, img.naturalHeight, CONTAINER_SIZE, CROP_DIAMETER);
    setTransform({ scale: initialScale, panX: 0, panY: 0 });
    setReady(true);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setTransform((prev) => ({
      ...prev,
      panX: dragRef.current!.panX + (e.clientX - dragRef.current!.x),
      panY: dragRef.current!.panY + (e.clientY - dragRef.current!.y),
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    setSaving(true);
    try {
      const blob = await cropAvatarToBlob(img, {
        containerSize: CONTAINER_SIZE,
        cropDiameter: CROP_DIAMETER,
        transform,
      });
      await onConfirm(blob);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const fit =
    imgRef.current?.naturalWidth && imgRef.current?.naturalHeight
      ? Math.min(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
      : 1;
  const displayScale = fit * transform.scale;
  const displayW = (imgRef.current?.naturalWidth ?? 0) * displayScale;
  const displayH = (imgRef.current?.naturalHeight ?? 0) * displayScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.dashboard.profilePhotoCropTitle ?? "Profile photo"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {t.dashboard.profilePhotoCropHint ?? "Drag to position. The circle shows what will appear on your profile."}
        </p>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-muted"
          style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imageSrc ? (
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: displayW || "auto",
                height: displayH || "auto",
                left: CONTAINER_SIZE / 2 - (displayW || 0) / 2 + transform.panX,
                top: CONTAINER_SIZE / 2 - (displayH || 0) / 2 + transform.panY,
              }}
            />
          ) : null}

          {/* Dim everything outside the crop circle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "rgba(0,0,0,0.55)",
              WebkitMaskImage: `radial-gradient(circle ${CROP_DIAMETER / 2}px at 50% 50%, transparent ${CROP_DIAMETER / 2}px, black ${CROP_DIAMETER / 2 + 1}px)`,
              maskImage: `radial-gradient(circle ${CROP_DIAMETER / 2}px at 50% 50%, transparent ${CROP_DIAMETER / 2}px, black ${CROP_DIAMETER / 2 + 1}px)`,
            }}
          />

          {/* Circle outline matching profile photo size */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] pointer-events-none",
            )}
            style={{ width: CROP_DIAMETER, height: CROP_DIAMETER }}
          />
        </div>

        <div className="space-y-2 px-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t.dashboard.profilePhotoZoom ?? "Zoom"}
          </label>
          <Slider
            min={1}
            max={4}
            step={0.02}
            value={[transform.scale]}
            onValueChange={([v]) => setTransform((prev) => ({ ...prev, scale: v ?? prev.scale }))}
            disabled={!ready}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel ?? "Cancel"}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!ready || saving} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {t.common.save ?? "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

