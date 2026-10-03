import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const HOURS_OPTIONS = [24, 48, 72] as const;

export type ProSmsPrefs = {
  sms_reminder_hours: number;
  sms_confirmation_message_custom: string | null;
  sms_reminder_message_custom: string | null;
  sms_review_request_message_custom: string | null;
};

const DEFAULT_CONFIRM =
  "Booking confirmed with {{business}} on {{date}} at {{time}}. If your appointment is late evening, please leave outdoor lights on for safety.";
const DEFAULT_REMINDER =
  "Reminder: appointment with {{business}} on {{date}} at {{time}}. If it is late at night, please keep outdoor lights on for the professional.";
const DEFAULT_REVIEW =
  "How did you like your service with {{business}}? Leave a quick review from your AltShift dashboard.";

type Props = {
  proProfileId: string;
  locale: "en" | "fr";
  enabled: boolean;
};

export default function ProSmsAutomationSettings({ proProfileId, locale, enabled }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<number>(24);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  const copy =
    locale === "fr"
      ? {
          title: "SMS automatiques (Pro)",
          intro:
            "Inclus avec le forfait Performance : confirmations, rappels et demandes d’avis. Le pied de page support AltShift est toujours ajouté.",
          hoursLabel: "Préavis avant le rendez-vous",
          hoursHint: "Le client reçoit un SMS 24, 48 ou 72 heures avant la date prévue.",
          confirmLabel: "Message de confirmation (optionnel)",
          reminderLabel: "Message de rappel (optionnel)",
          reviewLabel: "Demande d’avis après le service (optionnel)",
          placeholder: "Laissez vide pour utiliser le texte par défaut AltShift",
          supportNote:
            "Support toujours inclus : +1 450 800 3177 · support@altshift.ca · altshift.ca (clavardage).",
          save: "Enregistrer",
          saved: "Préférences SMS enregistrées",
          upgrade: "Passez au forfait Performance pour activer les SMS automatiques.",
        }
      : {
          title: "SMS automation (Pro)",
          intro:
            "Included with Pro: booking confirmations, appointment reminders, and post-service review requests. AltShift support footer is always appended.",
          hoursLabel: "Notice before appointment",
          hoursHint: "Clients get an SMS 24, 48, or 72 hours before the scheduled date.",
          confirmLabel: "Confirmation message (optional)",
          reminderLabel: "Reminder message (optional)",
          reviewLabel: "Review request after service (optional)",
          placeholder: "Leave blank to use the AltShift default",
          supportNote:
            "Support always included: +1 450 800 3177 · support@altshift.ca · altshift.ca (chat).",
          save: "Save",
          saved: "SMS preferences saved",
          upgrade: "Upgrade to Pro to enable automated SMS.",
        };

  useEffect(() => {
    if (!enabled || !proProfileId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("pro_profiles")
        .select(
          "sms_reminder_hours, sms_confirmation_message_custom, sms_reminder_message_custom, sms_review_request_message_custom",
        )
        .eq("id", proProfileId)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        const row = data as ProSmsPrefs;
        const h = Number(row.sms_reminder_hours);
        setHours(h === 48 || h === 72 ? h : 24);
        setConfirmMsg(row.sms_confirmation_message_custom?.trim() || "");
        setReminderMsg(row.sms_reminder_message_custom?.trim() || "");
        setReviewMsg(row.sms_review_request_message_custom?.trim() || "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, proProfileId]);

  const save = async () => {
    if (!enabled || !proProfileId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("pro_profiles")
      .update({
        sms_reminder_hours: hours,
        sms_confirmation_message_custom: confirmMsg.trim() || null,
        sms_reminder_message_custom: reminderMsg.trim() || null,
        sms_review_request_message_custom: reviewMsg.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proProfileId);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: copy.saved });
  };

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{copy.title}</p>
        <p>{copy.upgrade}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-heading font-bold text-foreground">{copy.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{copy.intro}</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div>
            <Label>{copy.hoursLabel}</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">{copy.hoursHint}</p>
            <div className="flex flex-wrap gap-2">
              {HOURS_OPTIONS.map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={hours === h ? "default" : "outline"}
                  onClick={() => setHours(h)}
                >
                  {h}h
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>{copy.confirmLabel}</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={3}
              value={confirmMsg}
              onChange={(e) => setConfirmMsg(e.target.value)}
              placeholder={DEFAULT_CONFIRM}
            />
          </div>
          <div>
            <Label>{copy.reminderLabel}</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={3}
              value={reminderMsg}
              onChange={(e) => setReminderMsg(e.target.value)}
              placeholder={DEFAULT_REMINDER}
            />
          </div>
          <div>
            <Label>{copy.reviewLabel}</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={3}
              value={reviewMsg}
              onChange={(e) => setReviewMsg(e.target.value)}
              placeholder={DEFAULT_REVIEW}
            />
          </div>
          <p className="text-xs text-muted-foreground">{copy.supportNote}</p>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {copy.save}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
