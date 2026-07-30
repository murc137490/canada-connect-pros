import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type PendingPro = {
  id: string;
  user_id: string;
  business_name: string;
  created_at: string;
};

export default function AdminAcceptPros() {
  const { user, session } = useAuth();
  const { locale, t } = useLanguage();
  const d = t.dashboard;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPlatformAdmin, ready } = usePlatformAdmin();
  const waitingForAdminProfile = !!user && !ready && !isPlatformAdmin;
  const [pending, setPending] = useState<PendingPro[]>([]);
  const [publicNumberByUserId, setPublicNumberByUserId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (waitingForAdminProfile) {
      return;
    }
    if (!isPlatformAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: list } = await supabase
        .from("pro_profiles")
        .select("id, user_id, business_name, created_at")
        .eq("is_verified", false)
        .order("created_at", { ascending: false });
      const rows = (list as PendingPro[]) ?? [];
      setPending(rows);
      const ids = [...new Set(rows.map((p) => p.user_id))];
      if (ids.length === 0) {
        setPublicNumberByUserId({});
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("user_id, public_user_number").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((r: { user_id: string; public_user_number: string | null }) => {
        if (r.public_user_number) map[r.user_id] = r.public_user_number;
      });
      setPublicNumberByUserId(map);
      setLoading(false);
    })();
  }, [user, isPlatformAdmin, waitingForAdminProfile]);

  useEffect(() => {
    if (loading) return;
    if (waitingForAdminProfile) return;
    if (!user || !isPlatformAdmin) {
      navigate("/", { replace: true });
    }
  }, [user, isPlatformAdmin, loading, waitingForAdminProfile, navigate]);

  const handleAccept = async (proUserId: string) => {
    if (!session?.access_token || !SUPABASE_URL) return;
    setAcceptingId(proUserId);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-pro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pro_user_id: proUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      toast({
        title:
          locale === "fr"
            ? "Pro accepté. Il apparaît maintenant dans la recherche."
            : "Pro accepted. They now appear in search.",
      });
      setPending((prev) => prev.filter((p) => p.user_id !== proUserId));
    } catch (e) {
      toast({
        title: locale === "fr" ? "Échec de l’acceptation" : "Failed to accept",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading || waitingForAdminProfile) {
    return (
      <Layout>
        <div className="container py-16 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <ShieldCheck size={28} /> {d.adminAcceptProsTitle ?? "Accept pros"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {d.adminAcceptProsPageOnlyYou ??
            "Only you (admin) can see this page. Accept applications to give pros access to the pro section; they will not appear in search until accepted."}
        </p>

        {pending.length === 0 ? (
          <p className="text-muted-foreground">{d.adminNoPendingPros ?? "No pending pros right now."}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{p.business_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(d.adminAppliedOn ?? "Applied {{date}}").replace(
                      "{{date}}",
                      new Date(p.created_at).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
                        dateStyle: "medium",
                      }),
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{d.accountMemberId ?? "Member ID"}</span>{" "}
                    <span
                      className="font-mono truncate max-w-[200px] inline-block align-bottom"
                      title={`Internal: ${p.user_id}`}
                    >
                      {publicNumberByUserId[p.user_id] ?? "-"}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAccept(p.user_id)}
                  disabled={acceptingId !== null}
                  className="shrink-0"
                >
                  {acceptingId === p.user_id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    d.approve ?? "Accept"
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
