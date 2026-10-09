import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Loader2, UserRound } from "lucide-react";
import Layout from "@/components/Layout";
import PrivateNoIndex from "@/components/PrivateNoIndex";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import ProProfilePage from "./ProProfilePage";
import NotFound from "./NotFound";
import { isUuidLike } from "@/lib/proShareSlug";
import { isReservedHandle, normalizeHandle, USERNAME_RE, type ResolvedHandle } from "@/lib/publicHandle";

/** Untyped RPC helper — resolve_public_handle is newer than the generated DB types. */
async function resolveHandle(handle: string): Promise<ResolvedHandle> {
  // Keep `this` bound to the client (a detached supabase.rpc throws "reading 'rest'").
  const { data, error } = (await supabase.rpc(
    "resolve_public_handle" as never,
    { p_handle: handle } as never,
  )) as unknown as { data: unknown; error: { message: string } | null };
  if (error || !data || typeof data !== "object") return { status: "not_found" };
  return data as ResolvedHandle;
}

function MemberCard({ handle, firstName, since }: { handle: string; firstName: string | null; since: number | null }) {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const fr = locale === "fr";
  const name = firstName?.trim() || (fr ? "Membre AltShift" : "AltShift member");
  return (
    <Layout>
      {/* Client pages are never indexed */}
      <PrivateNoIndex />
      <div className="container mx-auto max-w-md px-4 py-16 md:py-24">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">@{handle}</p>
          {since ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {fr ? `Membre AltShift depuis ${since}` : `AltShift member since ${since}`}
            </p>
          ) : null}
          <p className="mt-6 text-sm text-muted-foreground">
            {fr
              ? "Les profils de clients restent privés. Envie de réserver un pro près de chez vous?"
              : "Client profiles stay private. Looking to book a local pro?"}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/services">{fr ? "Trouver un pro" : "Find a pro"}</Link>
            </Button>
            {!user ? (
              <Button asChild variant="outline">
                <Link to="/auth?mode=signup">
                  {fr ? "Créer un compte" : "Create an account"}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}

/**
 * /<username> — the public link for every account.
 *  - pro      → their public pro page (same visibility rules as /pros/:id)
 *  - client   → a minimal, non-indexed card (first name + member-since year only)
 *  - old name → replaced with the owner's current /<username>
 *  - unknown  → friendly 404
 */
export default function PublicHandlePage() {
  const { shareSlug = "" } = useParams<{ shareSlug: string }>();
  const location = useLocation();
  const handle = normalizeHandle(decodeURIComponent(shareSlug));
  const [state, setState] = useState<{ handle: string; result: ResolvedHandle } | null>(null);

  const looksLikeHandle = USERNAME_RE.test(handle) && !isReservedHandle(handle);

  useEffect(() => {
    if (!looksLikeHandle) return;
    let cancelled = false;
    void resolveHandle(handle).then((result) => {
      if (!cancelled) setState({ handle, result });
    });
    return () => {
      cancelled = true;
    };
  }, [handle, looksLikeHandle]);

  // Old-style /<uuid> links (rare) → the id route, which forwards to the username.
  if (isUuidLike(handle)) return <Navigate to={`/pros/${handle}${location.search}${location.hash}`} replace />;
  if (!looksLikeHandle) return <NotFound />;

  // Typed with capitals → normalise the address bar
  if (shareSlug !== handle && USERNAME_RE.test(handle)) {
    return <Navigate to={`/${handle}${location.search}${location.hash}`} replace />;
  }

  if (!state || state.handle !== handle) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </Layout>
    );
  }

  const r = state.result;
  if (r.status === "redirect") {
    if (r.username) return <Navigate to={`/${r.username}${location.search}${location.hash}`} replace />;
    // Pro without a username yet: render in place (navigating to /pros/:id would bounce back here).
    if (r.pro_profile_id) return <ProProfilePage proIdOverride={r.pro_profile_id} key={r.pro_profile_id} />;
    return <NotFound handle={handle} />;
  }
  if (r.status === "ok" && r.kind === "pro") {
    return <ProProfilePage proIdOverride={r.pro_profile_id} key={r.pro_profile_id} />;
  }
  if (r.status === "ok" && r.kind === "member") {
    return <MemberCard handle={r.username} firstName={r.first_name} since={r.member_since} />;
  }
  return <NotFound handle={handle} />;
}
