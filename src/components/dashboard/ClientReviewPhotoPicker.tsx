import { Camera, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { MAX_CLIENT_REVIEW_PHOTOS } from "@/lib/clientReviewPhotos";

type Props = {
  photos: File[];
  previewUrls: string[];
  onPhotosChange: (files: File[], previews: string[]) => void;
};

export default function ClientReviewPhotoPicker({ photos, previewUrls, onPhotosChange }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_CLIENT_REVIEW_PHOTOS) {
      toast({ title: t.reviews.maxPhotos, variant: "destructive" });
      return;
    }
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    onPhotosChange([...photos, ...files], [...previewUrls, ...newPreviews]);
  };

  const removeAt = (idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    onPhotosChange(
      photos.filter((_, i) => i !== idx),
      previewUrls.filter((_, i) => i !== idx),
    );
  };

  return (
    <div className="space-y-2">
      {previewUrls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previewUrls.map((url, i) => (
            <div key={url} className="relative h-16 w-16 rounded-md overflow-hidden border border-border">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                aria-label={t.common.cancel}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Camera size={16} />
        <span>{t.reviews.addPhotos}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleAdd} />
      </label>
    </div>
  );
}
