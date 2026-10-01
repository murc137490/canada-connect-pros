import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCanadianPhone, phoneDigits } from "@/lib/canadianPhone";

type Purpose = "change_email" | "change_phone" | "change_pin";
type Channel = "sms" | "email";

type SecurityStatus = {
  has_voice_pin: boolean;
  can_sms: boolean;
  can_email: boolean;
};

const emptyStatus: SecurityStatus = { has_voice_pin: false, can_sms: false, can_email: false };

export function AccountSecuritySection({
  email,
  phone,
  showPhone,
  onPhoneChanged,
  onEmailChanged,
}: {
  email: string;
  phone: string;
  showPhone: boolean;
  onPhoneChanged: (phone: string) => void;
  onEmailChanged: (email: string) => void;
}) {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const copy = t.dashboard;
  const [status, setStatus] = useState<SecurityStatus>(emptyStatus);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [nextValue, setNextValue] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("account-security", { body: { action: "status" } });
    if (!error && data && typeof data === "object") {
      const row = data as Partial<SecurityStatus>;
      setStatus({
        has_voice_pin: row.has_voice_pin === true,
        can_sms: row.can_sms === true,
        can_email: row.can_email === true,
      });
    }
    setLoadingStatus(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const close = () => {
    setPurpose(null);
    setChannel(null);
    setCodeSent(false);
    setCode("");
    setNextValue("");
    setPinAgain("");
    setBusy(false);
  };

  const open = (nextPurpose: Purpose, nextChannel: Channel | null) => {
    setPurpose(nextPurpose);
    setChannel(nextChannel);
    setCodeSent(false);
    setCode("");
    setNextValue("");
    setPinAgain("");
  };

  const errorText = (codeName: string) => {
    const map: Record<string, string> = {
      email_requires_sms: copy.securityEmailNeedsPhone,
      phone_requires_email: copy.securityPhoneNeedsEmail,
      no_phone: copy.securityNoPhone,
      no_email: copy.securityNoEmail,
      rate_limited: copy.securityRateLimited,
      invalid_code: copy.securityInvalidCode,
      code_expired: copy.securityCodeExpired,
      too_many_attempts: copy.securityTooManyAttempts,
      invalid_pin: copy.securityInvalidPin,
      phone_locked: copy.securityPhoneHint,
      pin_locked: copy.securityPinHint,
      invalid_phone: copy.securityInvalidPhone,
      invalid_email: copy.securityInvalidEmail,
      same_email: copy.securitySameEmail,
      email_taken: copy.securityEmailTaken,
      sms_not_configured: copy.securitySmsUnavailable,
      email_not_configured: copy.securityEmailUnavailable,
    };
    return map[codeName] ?? copy.securityGenericError;
  };

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("account-security", { body });
    if (error) {
      let message = error.message;
      try {
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === "function") {
          const payload = await context.json() as { error?: string };
          if (payload?.error) message = payload.error;
        }
      } catch {
        /* keep the invoke message */
      }
      throw new Error(message);
    }
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
      throw new Error(String((data as { error: string }).error));
    }
    return (data ?? {}) as Record<string, unknown>;
  };

  const sendCode = async (chosen: Channel) => {
    if (!purpose) return;
    setBusy(true);
    try {
      await invoke({ action: "send", purpose, channel: chosen });
      setChannel(chosen);
      setCodeSent(true);
      toast({ title: copy.securityCodeSent });
    } catch (err) {
      toast({ title: t.auth.toastError, description: errorText((err as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!purpose || !channel) return;
    if (purpose === "change_pin") {
      const pin = nextValue.replace(/\D/g, "");
      if (!/^\d{4,6}$/.test(pin) || pin !== pinAgain.replace(/\D/g, "")) {
        toast({ title: t.auth.toastError, description: copy.securityPinMismatch, variant: "destructive" });
        return;
      }
    }
    if (purpose === "change_phone" && phoneDigits(nextValue).length !== 10) {
      toast({ title: t.auth.toastError, description: copy.securityInvalidPhone, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const result = await invoke({
        action: "apply",
        purpose,
        channel,
        code,
        new_pin: purpose === "change_pin" ? nextValue : undefined,
        new_phone: purpose === "change_phone" ? nextValue : undefined,
        new_email: purpose === "change_email" ? nextValue : undefined,
      });
      if (purpose === "change_phone" && typeof result.phone === "string") onPhoneChanged(result.phone);
      if (purpose === "change_email" && typeof result.email === "string") onEmailChanged(result.email);
      toast({ title: copy.securitySaved });
      close();
      await refresh();
    } catch (err) {
      toast({ title: t.auth.toastError, description: errorText((err as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const phoneLocked = phoneDigits(phone).length >= 10;
  const title =
    purpose === "change_email"
      ? copy.securityChangeEmail
      : purpose === "change_phone"
        ? copy.securityChangePhone
        : status.has_voice_pin
          ? copy.securityChangePin
          : copy.securitySetPin;

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="space-y-2 border-b border-border/70 pb-4">
        <Label>{copy.securityPinTitle}</Label>
        <p className="text-sm text-foreground">
          {loadingStatus ? copy.securityPinLoading : status.has_voice_pin ? copy.securityPinSet : copy.securityPinMissing}
        </p>
        <p className="text-xs text-muted-foreground">{copy.securityPinHint}</p>
        <Button type="button" variant="outline" onClick={() => open("change_pin", null)}>
          {status.has_voice_pin ? copy.securityChangePin : copy.securitySetPin}
        </Button>
      </div>
      {showPhone ? (
        <div className="space-y-2">
          <Label htmlFor="acc-phone-locked">{copy.accountPhone}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="acc-phone-locked" value={phone} readOnly className="min-w-0 bg-muted sm:flex-1" />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!status.can_email && phoneLocked}
              onClick={() => open("change_phone", "email")}
            >
              <Lock className="mr-1 h-4 w-4" />
              {phoneLocked ? copy.securityChange : copy.securityAdd}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {phoneLocked ? copy.securityPhoneHint : copy.securityPhoneDialog}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="acc-email-locked">{copy.accountEmail}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="acc-email-locked" value={email} readOnly className="min-w-0 bg-muted sm:flex-1" />
          <Button type="button" variant="outline" className="shrink-0" disabled={!status.can_sms} onClick={() => open("change_email", "sms")}>
            <Lock className="mr-1 h-4 w-4" />
            {copy.securityChange}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {!loadingStatus && !status.can_sms ? copy.securityEmailNeedsPhone : copy.securityEmailHint}
        </p>
      </div>

      <Dialog open={purpose !== null} onOpenChange={(openDialog) => { if (!openDialog) close(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {purpose === "change_email"
                ? copy.securityEmailDialog
                : purpose === "change_phone"
                  ? copy.securityPhoneDialog
                  : copy.securityPinDialog}
            </DialogDescription>
          </DialogHeader>

          {purpose === "change_pin" && !codeSent ? (
            <div className="grid gap-2">
              <Button type="button" disabled={busy || !status.can_sms} onClick={() => void sendCode("sms")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {copy.securitySendText}
              </Button>
              <Button type="button" variant="outline" disabled={busy || !status.can_email} onClick={() => void sendCode("email")}>
                {copy.securitySendEmail}
              </Button>
            </div>
          ) : null}

          {purpose !== "change_pin" && !codeSent ? (
            <Button type="button" disabled={busy || !channel} onClick={() => channel && void sendCode(channel)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {purpose === "change_email" ? copy.securitySendText : copy.securitySendEmail}
            </Button>
          ) : null}

          {codeSent ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="security-code">{copy.securityCodeLabel}</Label>
                <Input
                  id="security-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                />
              </div>
              {purpose === "change_phone" ? (
                <div className="space-y-2">
                  <Label htmlFor="security-phone">{copy.accountPhone}</Label>
                  <Input
                    id="security-phone"
                    type="tel"
                    value={nextValue}
                    onChange={(e) => setNextValue(formatCanadianPhone(e.target.value))}
                    placeholder="(450) 123-4567"
                  />
                </div>
              ) : null}
              {purpose === "change_email" ? (
                <div className="space-y-2">
                  <Label htmlFor="security-email">{copy.accountEmail}</Label>
                  <Input
                    id="security-email"
                    type="email"
                    value={nextValue}
                    onChange={(e) => setNextValue(e.target.value)}
                    placeholder="name@email.com"
                  />
                </div>
              ) : null}
              {purpose === "change_pin" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="security-pin">{copy.securityNewPin}</Label>
                    <Input
                      id="security-pin"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={nextValue}
                      onChange={(e) => setNextValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security-pin-2">{copy.securityConfirmPin}</Label>
                    <Input
                      id="security-pin-2"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={pinAgain}
                      onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                </>
              ) : null}
              <Button type="button" disabled={busy || code.length !== 6} onClick={() => void apply()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {locale === "fr" ? "Confirmer" : "Confirm"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
