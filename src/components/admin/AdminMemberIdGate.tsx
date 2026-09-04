import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canUsePlatformAdminTools, isSuperAdminEmail } from "@/lib/platformAdmin";
import {
  clearAdminMemberVerification,
  isAdminMemberVerified,
  normalizeMemberIdInput,
  setAdminMemberVerified,
} from "@/lib/adminMemberGate";

type Props = {
  children: React.ReactNode;
};

/**
 * Staff platform admins must confirm their 6-digit Member ID once per browser session.
 * Super admin (murc137490@gmail.com) is exempt.
 */
export default function AdminMemberIdGate({ children }: Props) {
  const { user, signOut } = useAuth();
  const { locale } = useLanguage();
  const { toast } = useToast();
  const fr = locale === "fr";
  const [checking, setChecking] = useState(true);
  const [needsGate, setNeedsGate] = useState(false);
  const [expectedMemberId, setExpectedMemberId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) {
        clearAdminMemberVerification();
        if (!cancelled) {
          setNeedsGate(false);
          setChecking(false);
        }
        return;
      }
      // Super admin never needs Member ID verification.
      if (isSuperAdminEmail(user.email)) {
        if (!cancelled) {
          setNeedsGate(false);
          setChecking(false);
        }
        return;
      }
      setChecking(true);
      const { data } = await supabase
        .from("profiles")
        .select("is_platform_admin, public_user_number")
        .eq("user_id", user.id)
        .maybeSingle();
      const isAdmin = canUsePlatformAdminTools(user.email, data?.is_platform_admin === true);
      const memberId = String((data as { public_user_number?: string | null } | null)?.public_user_number ?? "").trim();
      if (!isAdmin) {
        if (!cancelled) {
          setNeedsGate(false);
          setChecking(false);
        }
        return;
      }
      if (!/^[0-9]{6}$/.test(memberId)) {
        if (!cancelled) {
          setNeedsGate(true);
          setExpectedMemberId(null);
          setChecking(false);
        }
        return;
      }
      if (isAdminMemberVerified(user.id, memberId)) {
        if (!cancelled) {
          setNeedsGate(false);
          setChecking(false);
        }
        return;
      }
      if (!cancelled) {
        setExpectedMemberId(memberId);
        setNeedsGate(true);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const entered = normalizeMemberIdInput(input);
    if (!/^[0-9]{6}$/.test(entered)) {
      toast({
        title: fr ? "Member ID invalide" : "Invalid Member ID",
        description: fr ? "Entrez exactement 6 chiffres." : "Enter exactly 6 digits.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      if (!expectedMemberId || entered !== expectedMemberId) {
        clearAdminMemberVerification();
        await signOut();
        toast({
          title: fr ? "Accès refusé" : "Access denied",
          description: fr
            ? "Le Member ID ne correspond pas. Vous avez été déconnecté."
            : "Member ID did not match. You have been signed out.",
          variant: "destructive",
        });
        return;
      }
      setAdminMemberVerified(user.id, expectedMemberId);
      setNeedsGate(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  if (!needsGate) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-xl border bg-card p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="text-primary" size={22} />
          <h1 className="font-heading text-xl font-bold text-foreground">
            {fr ? "Vérification admin" : "Admin verification"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {expectedMemberId
            ? fr
              ? "Entrez votre Member ID à 6 chiffres pour continuer."
              : "Enter your 6-digit Member ID to continue."
            : fr
              ? "Aucun Member ID n’est assigné à ce compte. Contactez le super admin."
              : "No Member ID is assigned to this account. Contact the super admin."}
        </p>
        {expectedMemberId ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-member-id">Member ID</Label>
              <Input
                id="admin-member-id"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="font-mono tracking-widest text-center text-lg"
                value={input}
                onChange={(e) => setInput(normalizeMemberIdInput(e.target.value))}
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              {fr ? "Continuer" : "Continue"}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void signOut();
            }}
          >
            {fr ? "Se déconnecter" : "Sign out"}
          </Button>
        )}
      </div>
    </div>
  );
}
