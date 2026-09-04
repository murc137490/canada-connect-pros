import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toUserFacingMessage } from "@/lib/userFacingError";
import { useLanguage } from "@/contexts/LanguageContext";

export type AdminStaffRow = {
  user_id: string;
  email: string;
  member_id: string;
  full_name: string;
  date_of_birth: string | null;
  address: string;
  phone: string;
  phone_secondary: string;
  best_contact_method: string;
  additional_info: string;
  created_at: string;
};

const emptyForm = {
  email: "",
  password: "",
  member_id: "",
  full_name: "",
  date_of_birth: "",
  address: "",
  phone: "",
  phone_secondary: "",
  best_contact_method: "",
  additional_info: "",
};

export default function AdminStaffManager() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const [staff, setStaff] = useState<AdminStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fr = locale === "fr";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-platform-admins", {
        body: { action: "list" },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message);
      }
      setStaff(((data as { staff?: AdminStaffRow[] })?.staff ?? []) as AdminStaffRow[]);
    } catch (e) {
      toast({
        title: fr ? "Erreur" : "Error",
        description: toUserFacingMessage(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-platform-admins", {
        body: { action: "create", ...form, date_of_birth: form.date_of_birth || null },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message);
      }
      toast({
        title: fr ? "Admin créé" : "Admin created",
        description: fr
          ? `Compte prêt. Member ID ${(data as { member_id?: string }).member_id ?? form.member_id}.`
          : `Account ready. Member ID ${(data as { member_id?: string }).member_id ?? form.member_id}.`,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast({
        title: fr ? "Erreur" : "Error",
        description: toUserFacingMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (userId: string) => {
    if (!window.confirm(fr ? "Révoquer cet admin ?" : "Revoke this admin?")) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-platform-admins", {
        body: { action: "revoke", user_id: userId },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error || error?.message);
      }
      await load();
    } catch (err) {
      toast({
        title: fr ? "Erreur" : "Error",
        description: toUserFacingMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldPlus size={22} />
          {fr ? "Comptes administrateurs" : "Admin accounts"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {fr
            ? "Super admin : murc137490@gmail.com — créez des admins avec un Member ID à 6 chiffres pour l’audit (qui / quoi / quand)."
            : "Super admin: murc137490@gmail.com — create admins with a 6-digit Member ID for audit (who / what / when)."}
        </p>
      </div>

      <form onSubmit={createStaff} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{fr ? "Nom complet" : "Full name"}</Label>
          <Input
            required
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{fr ? "Mot de passe temporaire" : "Temporary password"}</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Member ID (6 {fr ? "chiffres" : "digits"})</Label>
          <Input
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="font-mono"
            value={form.member_id}
            onChange={(e) => setForm((p) => ({ ...p, member_id: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{fr ? "Date de naissance" : "Date of birth"}</Label>
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{fr ? "Adresse" : "Address"}</Label>
          <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{fr ? "Téléphone" : "Phone"}</Label>
          <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{fr ? "2e téléphone" : "Second phone"}</Label>
          <Input
            value={form.phone_secondary}
            onChange={(e) => setForm((p) => ({ ...p, phone_secondary: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{fr ? "Meilleure façon de contacter" : "Best way to contact"}</Label>
          <Input
            value={form.best_contact_method}
            onChange={(e) => setForm((p) => ({ ...p, best_contact_method: e.target.value }))}
            placeholder={fr ? "ex. texto, courriel, appel" : "e.g. text, email, call"}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{fr ? "Informations additionnelles" : "Additional information"}</Label>
          <Textarea
            rows={3}
            value={form.additional_info}
            onChange={(e) => setForm((p) => ({ ...p, additional_info: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {fr ? "Créer l’admin" : "Create admin"}
          </Button>
        </div>
      </form>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold text-foreground">{fr ? "Admins actifs" : "Active admins"}</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr ? "Aucun admin staff encore." : "No staff admins yet."}</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((row) => (
              <li key={row.user_id} className="rounded-lg border p-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground">{row.full_name || row.email}</p>
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Member ID: {row.member_id}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  {row.best_contact_method ? (
                    <p className="text-xs text-muted-foreground">{row.best_contact_method}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void revoke(row.user_id)}>
                  <Trash2 size={14} />
                  {fr ? "Révoquer" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
