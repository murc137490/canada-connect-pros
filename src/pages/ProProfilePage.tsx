import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  MapPin, DollarSign, Clock, Phone, Globe, Briefcase,
  ArrowLeft, Loader2, ShieldCheck
} from "lucide-react";
import StarRating from "@/components/pro/StarRating";
import LicenseBadge from "@/components/pro/LicenseBadge";
import ReviewSection from "@/components/pro/ReviewSection";
import RecommendationSidebar from "@/components/pro/RecommendationSidebar";

interface ProData {
  id: string;
  user_id: string;
  business_name: string;
  bio: string | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  availability: string | null;
  phone: string | null;
  website: string | null;
  years_experience: number;
  is_verified: boolean;
}

export default function ProProfilePage() {
  const { proId } = useParams<{ proId: string }>();
  const [pro, setPro] = useState<ProData | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null }[]>([]);
  const [services, setServices] = useState<{ service_slug: string; category_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null }[]>([]);
  const [licenses, setLicenses] = useState<{ license_number: string; license_type: string; is_verified: boolean }[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!proId) return;
    const fetch = async () => {
      setLoading(true);

      const { data: proData } = await supabase
        .from("pro_profiles")
        .select("*")
        .eq("id", proId)
        .single();

      if (!proData) { setLoading(false); return; }
      setPro(proData as any);

      // Parallel fetches
      const [profileRes, photosRes, servicesRes, licensesRes, ratingRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", proData.user_id).single(),
        supabase.from("pro_photos").select("id, url, caption").eq("pro_profile_id", proId).order("is_primary", { ascending: false }),
        supabase.from("pro_services").select("service_slug, category_slug, description, custom_price_min, custom_price_max").eq("pro_profile_id", proId),
        supabase.from("pro_licenses").select("license_number, license_type, is_verified").eq("pro_profile_id", proId),
        supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: proId }),
      ]);

      setFullName(profileRes.data?.full_name || "Pro");
      setAvatarUrl(profileRes.data?.avatar_url || null);
      setPhotos(photosRes.data || []);
      setServices((servicesRes.data as any[]) || []);
      setLicenses((licensesRes.data as any[]) || []);
      setAvgRating(Number(ratingRes.data?.[0]?.avg_rating || 0));
      setReviewCount(Number(ratingRes.data?.[0]?.review_count || 0));
      setLoading(false);
    };
    fetch();
  }, [proId]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!pro) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Pro not found</h1>
          <Button asChild><Link to="/services">Browse Services</Link></Button>
        </div>
      </Layout>
    );
  }

  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase();
  const firstService = services[0];

  return (
    <Layout>
      {/* Hero */}
      <div className="bg-primary text-primary-foreground">
        <div className="container py-10">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-6">
            <ArrowLeft size={16} /> Back to Services
          </Link>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="w-24 h-24 border-4 border-primary-foreground/20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-2xl font-bold bg-secondary text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="font-heading text-3xl font-extrabold">{pro.business_name}</h1>
                {pro.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                    <ShieldCheck size={14} /> Verified
                  </span>
                )}
              </div>
              <p className="text-primary-foreground/70 text-lg mb-3">{fullName}</p>

              <div className="flex items-center gap-4 flex-wrap text-sm text-primary-foreground/70">
                <div className="flex items-center gap-1">
                  <StarRating rating={avgRating} size={16} />
                  <span>({reviewCount} reviews)</span>
                </div>
                {pro.location && (
                  <span className="inline-flex items-center gap-1"><MapPin size={14} />{pro.location}</span>
                )}
                {pro.years_experience > 0 && (
                  <span className="inline-flex items-center gap-1"><Briefcase size={14} />{pro.years_experience} years exp.</span>
                )}
                {(pro.price_min || pro.price_max) && (
                  <span className="inline-flex items-center gap-1 text-maple-300 font-medium">
                    <DollarSign size={14} />
                    {pro.price_min && pro.price_max
                      ? `$${Number(pro.price_min).toLocaleString()} – $${Number(pro.price_max).toLocaleString()}`
                      : pro.price_min
                      ? `From $${Number(pro.price_min).toLocaleString()}`
                      : `Up to $${Number(pro.price_max).toLocaleString()}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio */}
            {pro.bio && (
              <section>
                <h2 className="font-heading text-lg font-bold text-foreground mb-3">About</h2>
                <p className="text-muted-foreground leading-relaxed">{pro.bio}</p>
              </section>
            )}

            {/* Services offered */}
            {services.length > 0 && (
              <section>
                <h2 className="font-heading text-lg font-bold text-foreground mb-3">Services Offered</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <div key={svc.service_slug} className="bg-muted/50 border rounded-xl p-4">
                      <h3 className="font-medium text-card-foreground capitalize">
                        {svc.service_slug.replace(/-/g, " ")}
                      </h3>
                      {svc.description && (
                        <p className="text-xs text-muted-foreground mt-1">{svc.description}</p>
                      )}
                      {(svc.custom_price_min || svc.custom_price_max) && (
                        <p className="text-xs text-secondary font-medium mt-2">
                          {svc.custom_price_min && svc.custom_price_max
                            ? `$${Number(svc.custom_price_min)} – $${Number(svc.custom_price_max)}`
                            : svc.custom_price_min
                            ? `From $${Number(svc.custom_price_min)}`
                            : `Up to $${Number(svc.custom_price_max)}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Portfolio photos */}
            {photos.length > 0 && (
              <section>
                <h2 className="font-heading text-lg font-bold text-foreground mb-3">Portfolio</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative rounded-xl overflow-hidden border aspect-square">
                      <img src={photo.url} alt={photo.caption || "Work photo"} className="w-full h-full object-cover" />
                      {photo.caption && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                          <p className="text-xs text-white">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Licenses */}
            {licenses.length > 0 && (
              <section>
                <h2 className="font-heading text-lg font-bold text-foreground mb-3">Licenses & Certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {licenses.map((lic) => (
                    <LicenseBadge
                      key={lic.license_number}
                      licenseNumber={lic.license_number}
                      licenseType={lic.license_type}
                      isVerified={lic.is_verified}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Contact info */}
            <section className="bg-card border rounded-2xl p-6">
              <h2 className="font-heading text-lg font-bold text-card-foreground mb-3">Contact</h2>
              <div className="space-y-2 text-sm">
                {pro.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone size={16} /> <a href={`tel:${pro.phone}`} className="hover:text-foreground">{pro.phone}</a>
                  </div>
                )}
                {pro.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe size={16} />
                    <a href={pro.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">
                      {pro.website}
                    </a>
                  </div>
                )}
                {pro.availability && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={16} /> {pro.availability}
                  </div>
                )}
              </div>
            </section>

            {/* Reviews */}
            <ReviewSection proProfileId={pro.id} proUserId={pro.user_id} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Quick contact CTA */}
            <div className="bg-card border rounded-2xl p-6 text-center sticky top-20">
              <h3 className="font-heading font-bold text-card-foreground mb-2">Interested?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Contact {fullName} for a free quote.
              </p>
              {pro.phone && (
                <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 mb-3" asChild>
                  <a href={`tel:${pro.phone}`}>
                    <Phone size={16} className="mr-2" /> Call Now
                  </a>
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link to="/support">Send Message</Link>
              </Button>
            </div>

            {/* Recommendations */}
            <RecommendationSidebar
              currentProId={pro.id}
              serviceSlug={firstService?.service_slug}
              categorySlug={firstService?.category_slug}
            />
          </aside>
        </div>
      </div>
    </Layout>
  );
}
