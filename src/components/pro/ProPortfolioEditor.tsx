import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StorageDisplayImage from "@/components/StorageDisplayImage";
import { storagePathFromUrl } from "@/lib/resolveStorageUrl";

const BUCKET = "pro-photos";
const MAX_PORTFOLIO = 12;

type ProPhoto = {
  id: string;
  url: string;
  caption: string | null;
  is_primary: boolean | null;
};

export default function ProPortfolioEditor({ proProfileId }: { proProfileId: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<ProPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  const loadPhotos = useCallback(async () => {
    if (!proProfileId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pro_photos")
      .select("id, url, caption, is_primary")
      .eq("pro_profile_id", proProfileId)
      .order("is_primary", { ascending: false });
    if (error) {
      toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
    } else {
      setPhotos((data ?? []) as ProPhoto[]);
    }
    setLoading(false);
  }, [proProfileId, t.auth.toastError, toast]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const gallery = photos.filter((p) => !p.is_primary);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !user?.id || !proProfileId) return;
    const remaining = MAX_PORTFOLIO - gallery.length;
    if (remaining <= 0) {
      toast({
        title: t.dashboard.portfolioMaxPhotos ?? "Photo limit reached",
        description: (t.dashboard.portfolioMaxPhotosDesc ?? "You can have up to {{count}} portfolio photos.").replace(
          "{{count}}",
          String(MAX_PORTFOLIO),
        ),
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const toUpload = Array.from(files).slice(0, remaining);
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/gallery-${Date.now()}-${i}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(up.path);
        const { error: insErr } = await supabase.from("pro_photos").insert({
          pro_profile_id: proProfileId,
          url: pub.publicUrl,
          is_primary: false,
          caption: null,
        });
        if (insErr) throw insErr;
      }
      toast({ title: t.dashboard.portfolioPhotoAdded ?? "Photo added" });
      await loadPhotos();
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveCaption = async (photoId: string) => {
    const { error } = await supabase
      .from("pro_photos")
      .update({ caption: editCaption.trim() || null })
      .eq("id", photoId);
    if (error) {
      toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    setEditCaption("");
    await loadPhotos();
  };

  const deletePhoto = async (photo: ProPhoto) => {
    if (photo.is_primary) return;
    if (!window.confirm(t.dashboard.portfolioDeleteConfirm ?? "Remove this photo from your portfolio?")) return;
    const path = storagePathFromUrl(BUCKET, photo.url);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
    const { error } = await supabase.from("pro_photos").delete().eq("id", photo.id);
    if (error) {
      toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
      return;
    }
    await loadPhotos();
  };

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 mt-6">
      <h3 className="font-heading font-bold text-foreground mb-1">{t.dashboard.portfolioTitle ?? "Portfolio"}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t.dashboard.portfolioHint ??
          "Photos appear on your public profile under Services. Your profile photo is managed in the preview section above."}
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      ) : (
        <>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {gallery.map((photo) => (
                <div key={photo.id} className="relative group rounded-lg border border-border overflow-hidden aspect-square bg-muted/30">
                  <StorageDisplayImage
                    bucket={BUCKET}
                    url={photo.url}
                    alt={photo.caption || t.common.workPhoto}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-gradient-to-t from-black/75 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingId(photo.id);
                        setEditCaption(photo.caption ?? "");
                      }}
                      aria-label={t.dashboard.editService ?? "Edit"}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => void deletePhoto(photo)}
                      aria-label={t.common.delete ?? "Delete"}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {photo.caption ? (
                    <p className="absolute top-1 left-1 right-1 text-[10px] text-white drop-shadow line-clamp-2 pointer-events-none">
                      {photo.caption}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">{t.dashboard.portfolioEmpty ?? "No portfolio photos yet."}</p>
          )}

          {editingId ? (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex-1 min-w-[12rem]">
                <Label htmlFor="portfolio-caption">{t.dashboard.portfolioCaption ?? "Caption (optional)"}</Label>
                <Input
                  id="portfolio-caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  maxLength={120}
                  className="mt-1"
                />
              </div>
              <Button type="button" size="sm" onClick={() => void saveCaption(editingId)}>
                {t.common.save}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setEditCaption("");
                }}
              >
                <X size={14} />
              </Button>
            </div>
          ) : null}

          <label className="inline-flex cursor-pointer items-center gap-2">
            <Button type="button" size="sm" className="gap-1 pointer-events-none" disabled={uploading || gallery.length >= MAX_PORTFOLIO} asChild>
              <span>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t.dashboard.portfolioAddPhotos ?? "Add photos"}
              </span>
            </Button>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading || gallery.length >= MAX_PORTFOLIO}
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}

