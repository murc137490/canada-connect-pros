import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileAvatarCropDialog from "@/components/dashboard/ProfileAvatarCropDialog";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

type Props = {
  src?: string | null;
  fallback: string;
  alt?: string;
  className?: string;
  disabled?: boolean;
  onSave: (blob: Blob) => Promise<void>;
};

export default function ClickableProfileAvatar({
  src,
  fallback,
  alt = "",
  className,
  disabled,
  onSave,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
  };

  const closeCrop = (open: boolean) => {
    setCropOpen(open);
    if (!open && cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  const handleConfirm = async (blob: Blob) => {
    setUploading(true);
    try {
      await onSave(blob);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || uploading}
        className={cn(
          "relative rounded-full shrink-0 h-20 w-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !disabled && "cursor-pointer group",
          disabled && "cursor-default opacity-70",
          className,
        )}
        aria-label="Change profile photo"
      >
        <Avatar className="h-full w-full border-2 border-border">
          <AvatarImage src={src ?? undefined} alt={alt} />
          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">{fallback}</AvatarFallback>
        </Avatar>
        {!disabled ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-colors">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin opacity-0 group-hover:opacity-100" />
            ) : (
              <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
            )}
          </span>
        ) : null}
      </button>
      <ProfileAvatarCropDialog
        open={cropOpen}
        onOpenChange={closeCrop}
        imageSrc={cropSrc}
        onConfirm={handleConfirm}
      />
    </>
  );
}
