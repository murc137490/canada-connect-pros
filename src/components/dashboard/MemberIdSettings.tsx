import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMemberIdInput } from "@/lib/adminMemberGate";
import { isValidUsername } from "@/lib/loginIdentifier";
import { useToast } from "@/hooks/use-toast";

type Props = {
  currentMemberId: string | null;
  locale: "en" | "fr";
  onChanged: (next: string) => void;
};

export default function MemberIdSettings({
  currentMemberId,
  locale,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(currentMemberId ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "taken" | "available" | "invalid">("idle");
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [hasPin, setHasPin] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinLoading, setPinLoading] = useState(true);

  const copy =
    locale === "fr"
      ? {
          title: "Member ID",
          confirm: "Confirmer",
          taken: "Ce Member ID est déjà pris.",
          invalid: "Entrez 4 chiffres.",
          available: "Disponible — confirmez pour l’adopter.",
          saved: "Member ID mis à jour",
          pinTitle: "NIP vocal (téléphone)",
          pinSave: "Enregistrer le NIP",
          pinClear: "Supprimer le NIP",
          pinMismatch: "Les NIP ne correspondent pas.",
          pinInvalid: "Le NIP doit contenir 4 à 6 chiffres.",
          pinSaved: "NIP vocal enregistré",
          pinCleared: "NIP vocal supprimé",
          pinStatusOn: "NIP vocal actif",
          pinStatusOff: "Aucun NIP vocal",
          memberHint: "Votre numéro de membre sert à vous connecter et à vous identifier par téléphone.",
          usernameTitle: "Nom d’utilisateur",
          usernameHint: "Vous pouvez vous connecter avec votre nom d’utilisateur ou votre numéro de membre.",
          usernameNone: "Aucun nom d’utilisateur pour l’instant.",
          usernameSave: "Enregistrer",
          usernameSaved: "Nom d’utilisateur mis à jour",
          usernameInvalid: "3 à 30 lettres minuscules, chiffres, points ou traits d’union, en commençant par une lettre.",
          usernameTaken: "Ce nom d’utilisateur est déjà pris.",
          usernameReserved: "Ce nom d’utilisateur est réservé.",
        }
      : {
          title: "Member ID",
          confirm: "Confirm",
          taken: "That Member ID is taken.",
          invalid: "Enter 4 digits.",
          available: "Available — confirm to claim it.",
          saved: "Member ID updated",
          pinTitle: "Voice PIN (phone)",
          pinSave: "Save PIN",
          pinClear: "Remove PIN",
          pinMismatch: "PINs do not match.",
          pinInvalid: "PIN must be 4–6 digits.",
          pinSaved: "Voice PIN saved",
          pinCleared: "Voice PIN removed",
          pinStatusOn: "Voice PIN is set",
          pinStatusOff: "No voice PIN yet",
          memberHint: "Your Member ID lets you log in and identifies you by phone.",
          usernameTitle: "Username",
          usernameHint: "You can log in with your username or your Member ID.",
          usernameNone: "No username yet.",
          usernameSave: "Save",
          usernameSaved: "Username updated",
          usernameInvalid: "3–30 lowercase letters, numbers, dots or dashes, starting with a letter.",
          usernameTaken: "That username is taken.",
          usernameReserved: "That username is reserved.",
        };

  useEffect(() => {
    setDraft(currentMemberId ?? "");
    setStatus("idle");
  }, [currentMemberId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data, error } = await supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle();
      if (cancelled || error) return;
      const current = (data as { username?: string | null } | null)?.username ?? null;
      setUsername(current);
      setUsernameDraft(current ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveUsername = async () => {
    const next = usernameDraft.trim().toLowerCase();
    if (!isValidUsername(next)) {
      setUsernameError(copy.usernameInvalid);
      return;
    }
    setUsernameSaving(true);
    setUsernameError(null);
    const { data, error } = await supabase.rpc("set_my_username" as never, { p_username: next } as never);
    setUsernameSaving(false);
    const result = data as { ok?: boolean; error?: string; username?: string } | null;
    if (error || !result?.ok) {
      const code = result?.error ?? "";
      setUsernameError(
        code === "taken"
          ? copy.usernameTaken
          : code === "reserved"
            ? copy.usernameReserved
            : code === "invalid_format"
              ? copy.usernameInvalid
              : error?.message ?? code ?? "Error",
      );
      return;
    }
    const saved = String(result.username ?? next);
    setUsername(saved);
    setUsernameDraft(saved);
    toast({ title: copy.usernameSaved });
  };

  useEffect(() => {
    let cancelled = false;
    setPinLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("my_voice_pin_status" as never);
      if (cancelled) return;
      setPinLoading(false);
      if (error) return;
      const row = data as { ok?: boolean; has_pin?: boolean } | null;
      setHasPin(!!row?.has_pin);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeMemberIdInput(draft);
    if (!normalized || normalized === normalizeMemberIdInput(currentMemberId ?? "")) {
      setStatus("idle");
      return;
    }
    if (normalized.length !== 4) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase.rpc("is_public_user_number_available" as never, {
          candidate: normalized,
        } as never);
        if (cancelled) return;
        if (error) {
          setStatus("idle");
          return;
        }
        setStatus(data === true ? "available" : "taken");
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [draft, currentMemberId]);

  const confirmMember = async () => {
    const normalized = normalizeMemberIdInput(draft);
    if (normalized.length !== 4 || status === "taken" || status === "invalid") return;
    setSaving(true);
    const { data, error } = await supabase.rpc("change_my_public_user_number" as never, {
      new_number: normalized,
    } as never);
    setSaving(false);
    const result = data as { ok?: boolean; error?: string; public_user_number?: string } | null;
    if (error || !result?.ok) {
      if (result?.error === "taken" || /taken/i.test(error?.message ?? "")) {
        setStatus("taken");
        return;
      }
      toast({ title: "Error", description: error?.message ?? result?.error ?? "Failed", variant: "destructive" });
      return;
    }
    const next = String(result.public_user_number ?? normalized);
    onChanged(next);
    setDraft(next);
    setStatus("idle");
    toast({ title: copy.saved });
  };

  const savePin = async () => {
    const a = pinDraft.replace(/\D/g, "");
    const b = pinConfirm.replace(/\D/g, "");
    if (a.length < 4 || a.length > 6) {
      toast({ title: copy.pinInvalid, variant: "destructive" });
      return;
    }
    if (a !== b) {
      toast({ title: copy.pinMismatch, variant: "destructive" });
      return;
    }
    setPinSaving(true);
    const { data, error } = await supabase.rpc("set_my_voice_pin" as never, { new_pin: a } as never);
    setPinSaving(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Error", description: error?.message ?? result?.error ?? "Failed", variant: "destructive" });
      return;
    }
    setHasPin(true);
    setPinDraft("");
    setPinConfirm("");
    toast({ title: copy.pinSaved });
  };

  const clearPin = async () => {
    setPinSaving(true);
    const { data, error } = await supabase.rpc("clear_my_voice_pin" as never);
    setPinSaving(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Error", description: error?.message ?? result?.error ?? "Failed", variant: "destructive" });
      return;
    }
    setHasPin(false);
    setPinDraft("");
    setPinConfirm("");
    toast({ title: copy.pinCleared });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div>
        <Label htmlFor="member-id-edit">{copy.title}</Label>
        <div className="flex flex-wrap gap-2 items-start">
          <Input
            id="member-id-edit"
            inputMode="numeric"
            className="font-mono max-w-[10rem]"
            value={draft}
            onChange={(e) => setDraft(normalizeMemberIdInput(e.target.value))}
            maxLength={4}
          />
          <Button
            type="button"
            size="sm"
            disabled={saving || status === "taken" || status === "invalid" || status === "checking" || normalizeMemberIdInput(draft) === normalizeMemberIdInput(currentMemberId ?? "")}
            onClick={() => void confirmMember()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {copy.confirm}
          </Button>
        </div>
        {status === "taken" ? <p className="text-sm text-destructive mt-1.5 font-medium">{copy.taken}</p> : null}
        {status === "invalid" ? <p className="text-sm text-destructive mt-1.5">{copy.invalid}</p> : null}
        {status === "available" ? <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1.5">{copy.available}</p> : null}
        {status === "checking" ? (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> …
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-1.5">{copy.memberHint}</p>
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label htmlFor="username-edit">{copy.usernameTitle}</Label>
        <div className="flex flex-wrap gap-2 items-start">
          <Input
            id="username-edit"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
            className="font-mono max-w-[16rem]"
            value={usernameDraft}
            maxLength={30}
            placeholder={username ? undefined : copy.usernameNone}
            onChange={(e) => {
              setUsernameDraft(e.target.value.toLowerCase().replace(/\s+/g, ""));
              setUsernameError(null);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={usernameSaving || !usernameDraft.trim() || usernameDraft.trim() === (username ?? "")}
            onClick={() => void saveUsername()}
          >
            {usernameSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {copy.usernameSave}
          </Button>
        </div>
        {usernameError ? (
          <p className="text-sm text-destructive font-medium">{usernameError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{copy.usernameHint}</p>
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label>{copy.pinTitle}</Label>
        <p className="text-sm font-medium">
          {pinLoading ? "…" : hasPin ? copy.pinStatusOn : copy.pinStatusOff}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="font-mono max-w-[8rem]"
            placeholder="PIN"
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
          />
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="font-mono max-w-[8rem]"
            placeholder={locale === "fr" ? "Confirmer" : "Confirm"}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
          />
          <Button type="button" size="sm" disabled={pinSaving} onClick={() => void savePin()}>
            {pinSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {copy.pinSave}
          </Button>
          {hasPin ? (
            <Button type="button" size="sm" variant="outline" disabled={pinSaving} onClick={() => void clearPin()}>
              {copy.pinClear}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
