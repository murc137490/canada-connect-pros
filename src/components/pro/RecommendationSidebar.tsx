import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import AvatarCircles, { type AvatarItem } from "@/components/AvatarCircles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProItem {
  id: string;
  user_id: string;
  business_name: string;
  imageUrl: string;
}

interface RecommendationSidebarProps {
  currentProId: string;
  serviceSlug?: string;
  categorySlug?: string;
}

const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

export default function RecommendationSidebar({
  currentProId,
  serviceSlug,
  categorySlug,
}: RecommendationSidebarProps) {
  const { t } = useLanguage();
  const [profileCards, setProfileCards] = useState<ProItem[]>([]);
  const [avatarItems, setAvatarItems] = useState<AvatarItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarPros = async () => {
      setLoading(true);

      const { data: proData } = await supabase
        .from("pro_profiles")
        .select("id, user_id, business_name")
        .eq("is_verified", true)
        .neq("id", currentProId)
        .limit(20);

      if (!proData?.length) {
        setProfileCards([]);
        setAvatarItems([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const allItems: ProItem[] = [];
      const avatarList: AvatarItem[] = [];

      for (let i = 0; i < proData.length; i++) {
        const pro = proData[i];
        let imageUrl = "";

        const { data: primaryPhoto } = await supabase
          .from("pro_photos")
          .select("url")
          .eq("pro_profile_id", pro.id)
          .eq("is_primary", true)
          .limit(1)
          .maybeSingle();

        if (primaryPhoto?.url) {
          imageUrl = primaryPhoto.url;
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("user_id", pro.user_id)
            .single();
          if (profile?.avatar_url) imageUrl = profile.avatar_url;
        }

        allItems.push({ ...pro, imageUrl: imageUrl || PLACEHOLDER_AVATAR });
        avatarList.push({ imageUrl: imageUrl || PLACEHOLDER_AVATAR, profileUrl: `/pro/${pro.id}` });
      }

      setProfileCards(allItems.slice(0, 3));
      setAvatarItems(avatarList.slice(3));
      setTotalCount(proData.length);
      setLoading(false);
    };

    fetchSimilarPros();
  }, [currentProId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (totalCount === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-secondary" />
        <h3 className="font-heading font-bold text-black">{t.services.betterMatch}</h3>
      </div>
      <p className="text-sm text-black/80">
        {t.services.betterMatchDesc}
      </p>

      {/* First 3 profiles as cards */}
      <div className="space-y-2">
        {profileCards.map((pro) => (
          <Link
            key={pro.id}
            to={`/pro/${pro.id}`}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-[#F7F7F7] dark:bg-muted/50 dark:border-gray-700 p-2.5 hover:bg-gray-100 dark:hover:bg-muted transition-colors"
          >
            <Avatar className="h-10 w-10 rounded-full shrink-0">
              <AvatarImage src={pro.imageUrl} />
              <AvatarFallback className="text-xs bg-muted">{pro.business_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-[#1F2937] dark:text-foreground text-sm truncate flex-1">{pro.business_name}</span>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      {/* Remaining avatars + count */}
      {avatarItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <AvatarCircles
            numPeople={totalCount - 3}
            avatarUrls={avatarItems}
            maxAvatars={6}
            size="sm"
            otherLabel={totalCount - 3 <= 1 ? t.services.oneProAvailable : (t.services.prosAvailable ?? "{count} pros available").replace("{count}", String(totalCount - 3))}
          />
        </div>
      )}

      {categorySlug && serviceSlug && (
        <Link
          to={`/services/${categorySlug}/${serviceSlug}/pros`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t.services.viewAllPros} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
