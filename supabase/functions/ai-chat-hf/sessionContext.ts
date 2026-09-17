import { createClient } from "npm:@supabase/supabase-js@2.27.0";

export type UserSessionSnapshot = {
  email: string | null;
  fullName: string | null;
  isPro: boolean;
  proVerified: boolean | null;
  businessName: string | null;
  subscriptionTier: string | null;
  shareSlug: string | null;
  serviceCount: number;
  serviceLabels: string[];
  pagePath: string | null;
};

export async function loadUserSessionSnapshot(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  userId: string,
  email: string | null | undefined,
  pagePath: string | null,
): Promise<UserSessionSnapshot> {
  const userDb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });

  const [{ data: profile }, { data: pro }] = await Promise.all([
    userDb.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    userDb
      .from("pro_profiles")
      .select("id, business_name, is_verified, subscription_tier, share_slug")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let serviceLabels: string[] = [];
  if (pro?.id) {
    const { data: services } = await userDb
      .from("pro_services")
      .select("display_name, service_slug, category_slug")
      .eq("pro_profile_id", pro.id)
      .limit(40);
    serviceLabels = (services ?? []).map((s) => {
      const label =
        (typeof s.display_name === "string" && s.display_name.trim()) ||
        (typeof s.service_slug === "string" && s.service_slug.trim()) ||
        "service";
      const cat = typeof s.category_slug === "string" && s.category_slug.trim() ? ` (${s.category_slug})` : "";
      return `${label}${cat}`;
    });
  }

  return {
    email: email ?? null,
    fullName: typeof profile?.full_name === "string" ? profile.full_name : null,
    isPro: !!pro?.id,
    proVerified: pro ? !!pro.is_verified : null,
    businessName: typeof pro?.business_name === "string" ? pro.business_name : null,
    subscriptionTier: typeof pro?.subscription_tier === "string" ? pro.subscription_tier : null,
    shareSlug: typeof pro?.share_slug === "string" ? pro.share_slug : null,
    serviceCount: serviceLabels.length,
    serviceLabels,
    pagePath,
  };
}

export function formatSessionContextBlock(snap: UserSessionSnapshot, language: "en" | "fr"): string {
  const lines: string[] = [];
  if (language === "fr") {
    lines.push("## Session utilisateur (fiable — ne redemande PAS s’ils ont un compte)");
    lines.push("- Connecté : oui");
    if (snap.email) lines.push(`- Courriel : ${snap.email}`);
    if (snap.fullName) lines.push(`- Nom : ${snap.fullName}`);
    lines.push(`- Profil pro : ${snap.isPro ? "oui" : "non"}`);
    if (snap.isPro) {
      if (snap.businessName) lines.push(`- Entreprise : ${snap.businessName}`);
      lines.push(`- Vérifié : ${snap.proVerified ? "oui" : "non / en attente"}`);
      if (snap.subscriptionTier) lines.push(`- Forfait : ${snap.subscriptionTier}`);
      if (snap.shareSlug) lines.push(`- Lien public : https://www.altshift.ca/${snap.shareSlug}`);
      lines.push(`- Services offerts : ${snap.serviceCount}`);
      if (snap.serviceLabels.length) {
        lines.push(`- Liste des services : ${snap.serviceLabels.slice(0, 20).join("; ")}`);
      }
    }
    if (snap.pagePath) lines.push(`- Page actuelle : ${snap.pagePath}`);
    lines.push("");
    lines.push("Règles session :");
    lines.push("- Ne demande JAMAIS « Avez-vous déjà un compte ? » ni n’envoie de lien Sign up / Log in.");
    lines.push("- Pour ajouter un service (pro) : oriente vers [Dashboard](https://www.altshift.ca/dashboard) → onglet Profil pro → « Ajouter un service ».");
    lines.push("- Si le pro a déjà des services, mentionne le nombre et propose d’ajouter des services similaires si pertinent.");
    lines.push("- Si connecté mais pas pro et qu’il veut offrir des services : [Join Pros](https://www.altshift.ca/join-pros).");
  } else {
    lines.push("## User session (trusted — do NOT ask if they have an account)");
    lines.push("- Logged in: yes");
    if (snap.email) lines.push(`- Email: ${snap.email}`);
    if (snap.fullName) lines.push(`- Name: ${snap.fullName}`);
    lines.push(`- Pro profile: ${snap.isPro ? "yes" : "no"}`);
    if (snap.isPro) {
      if (snap.businessName) lines.push(`- Business: ${snap.businessName}`);
      lines.push(`- Verified: ${snap.proVerified ? "yes" : "no / pending"}`);
      if (snap.subscriptionTier) lines.push(`- Plan tier: ${snap.subscriptionTier}`);
      if (snap.shareSlug) lines.push(`- Public link: https://www.altshift.ca/${snap.shareSlug}`);
      lines.push(`- Services offered: ${snap.serviceCount}`);
      if (snap.serviceLabels.length) {
        lines.push(`- Service list: ${snap.serviceLabels.slice(0, 20).join("; ")}`);
      }
    }
    if (snap.pagePath) lines.push(`- Current page: ${snap.pagePath}`);
    lines.push("");
    lines.push("Session rules:");
    lines.push("- NEVER ask “Do you already have an AltShift account?” and NEVER send Sign up / Log in links.");
    lines.push("- To add a service (pro): send them to [Dashboard](https://www.altshift.ca/dashboard) → Pro profile tab → “Add service”.");
    lines.push("- If they already have services, mention the count and optionally suggest similar services to add.");
    lines.push("- If logged in but not a pro and they want to offer services: [Join Pros](https://www.altshift.ca/join-pros).");
  }
  return lines.join("\n");
}
