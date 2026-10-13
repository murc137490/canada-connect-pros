import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

export default function ProServicesModeSwitcher() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [verifiedPro, setVerifiedPro] = useState(false);
  const clientMode = new URLSearchParams(location.search).get("mode") === "client";

  useEffect(() => {
    let active = true;
    if (!user) {
      setVerifiedPro(false);
      return () => { active = false; };
    }
    void supabase.from("pro_profiles").select("is_verified").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (active) setVerifiedPro(data?.is_verified === true);
    });
    return () => { active = false; };
  }, [user]);

  if (!verifiedPro) return null;

  const params = new URLSearchParams(location.search);
  if (clientMode) params.delete("mode");
  else params.set("mode", "client");
  const search = params.toString();

  return (
    <div className="border-b border-primary/20 bg-primary/5">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-sm font-medium text-foreground">
          {clientMode
            ? (locale === "fr" ? "Mode client : découvrez les professionnels réservables." : "Client mode: browse professionals you can book.")
            : (locale === "fr" ? "Demandes de travaux : choisissez un service pour voir les demandes correspondantes." : "Available jobs: choose a service to see matching requests.")}
        </p>
        <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" to={{ pathname: location.pathname, search: search ? `?${search}` : "" }}>
          {clientMode
            ? (locale === "fr" ? "Demandes disponibles" : "Available jobs")
            : (locale === "fr" ? "Mode client" : "Client mode")}
        </Link>
      </div>
    </div>
  );
}
