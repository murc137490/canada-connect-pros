import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  TERMS_SUMMARY_BOOKING,
  TERMS_SUMMARY_BOOKING_FR,
  TERMS_SUMMARY_PRO,
  TERMS_SUMMARY_PRO_FR,
} from "@/content/termsContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { recordLegalAcceptance } from "@/lib/legalAcceptance";

type Variant = "booking" | "pro";

interface TermsAcceptanceProps {
  variant: Variant;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  inDialog?: boolean;
  bookingId?: string | null;
}

export default function TermsAcceptance({
  variant,
  accepted,
  onAcceptedChange,
  onSubmit,
  submitLabel,
  inDialog = false,
  bookingId = null,
}: TermsAcceptanceProps) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const summary =
    variant === "pro"
      ? locale === "fr"
        ? TERMS_SUMMARY_PRO_FR
        : TERMS_SUMMARY_PRO
      : locale === "fr"
        ? TERMS_SUMMARY_BOOKING_FR
        : TERMS_SUMMARY_BOOKING;

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setHasScrolledToBottom(scrollHeight - scrollTop - clientHeight < 30);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [summary]);

  const label = variant === "pro" ? t.terms.acceptPro : t.terms.acceptBooking;
  const viewFull = t.terms.viewFullTerms;
  /** Both variants require scroll + checkbox so acceptance is explicit. */
  const canSubmit = hasScrolledToBottom && accepted;
  const scrollClass = inDialog
    ? "max-h-[50vh] overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm"
    : "max-h-[280px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm";

  const handleAcceptedChange = (value: boolean) => {
    onAcceptedChange(value);
    if (value && user?.id) {
      void recordLegalAcceptance(user.id, {
        documentType: variant === "pro" ? "professional_agreement" : "client_booking_terms",
        languageDisplayed: locale === "fr" ? "fr" : "en",
        languageSelected: locale === "fr" ? "fr" : "en",
        context: variant,
        bookingId,
      });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        {variant === "pro" ? t.terms.readProAgreement : t.terms.readBeforeBooking}
      </p>
      <p className="text-xs text-muted-foreground">
        {locale === "fr"
          ? "Version française affichée. Une version anglaise est disponible via le sélecteur de langue."
          : "English version shown. A French version is available via the language selector."}{" "}
        <Link to="/privacy" className="underline">
          {locale === "fr" ? "Confidentialité" : "Privacy"}
        </Link>
      </p>

      <div ref={scrollRef} className={scrollClass}>
        <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed text-left">
          {summary}
        </pre>
        <p className="mt-4 pt-4 border-t border-border/50 text-foreground">
          <Link to="/terms" className="text-primary underline hover:no-underline font-medium">
            {viewFull}
          </Link>
        </p>
      </div>

      {!hasScrolledToBottom && (
        <p className="text-xs text-muted-foreground">{t.terms.scrollToEnable}</p>
      )}

      <div className="flex items-start gap-3">
        <Checkbox
          id={`terms-accept-${variant}`}
          checked={accepted}
          disabled={!hasScrolledToBottom}
          onCheckedChange={(c) => handleAcceptedChange(c === true)}
        />
        <label
          htmlFor={`terms-accept-${variant}`}
          className={`text-sm leading-snug ${hasScrolledToBottom ? "text-foreground cursor-pointer" : "text-muted-foreground"}`}
        >
          {label}
        </label>
      </div>

      {onSubmit && (
        <Button type="button" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
          {submitLabel ?? t.terms.requestBooking}
        </Button>
      )}
    </div>
  );
}
