import { supabase } from "@/integrations/supabase/client";

export const MAX_CLIENT_REVIEW_PHOTOS = 5;

export async function uploadClientReviewPhotos(
  proUserId: string,
  clientReviewId: string,
  photos: File[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${proUserId}/client-reviews/${clientReviewId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("review-photos").upload(path, photo);
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from("review-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
  }
  return urls;
}

export function revokePhotoPreviewUrls(urls: string[]): void {
  urls.forEach((url) => URL.revokeObjectURL(url));
}
