import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type PendingPro = {
  id: string;
  user_id: string;
  business_name: string;
  created_at: string;
};

export default function AdminAcceptPros() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = !!user && user.email === "premiereservicescontact@gmail.com";
  const [pending, setPending] = useState<PendingPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: list } = await supabase
        .from("pro_profiles")
        .select("id, user_id, business_name, created_at")
        .eq("is_verified", false)
        .order("created_at", { ascending: false });
      setPending((list as PendingPro[]) ?? []);
      setLoading(false);
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

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
      toast({ title: "Pro accepted. They now appear in search." });
      setPending((prev) => prev.filter((p) => p.user_id !== proUserId));
    } catch (e) {
      toast({ title: "Failed to accept", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
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
          <ShieldCheck size={28} /> Accept pros
        </h1>
        <p className="text-muted-foreground mb-6">
          Only you (admin) can see this page. Accept applications to give pros access to the pro section; they will not appear in search until accepted.
        </p>

        {pending.length === 0 ? (
          <p className="text-muted-foreground">No pending pros right now.</p>
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
                    Applied {new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[280px]" title={p.user_id}>
                    {p.user_id}
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
                    "Accept"
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
