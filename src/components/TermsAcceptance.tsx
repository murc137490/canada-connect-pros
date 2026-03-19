import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TERMS_SUMMARY_BOOKING, TERMS_SUMMARY_PRO } from "@/content/termsContent";
import { useLanguage } from "@/contexts/LanguageContext";

type Variant = "booking" | "pro";

interface TermsAcceptanceProps {
  variant: Variant;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  /** When true, render inside a dialog with a fixed height scroll area */
  inDialog?: boolean;
}

export default function TermsAcceptance({
  variant,
  accepted,
  onAcceptedChange,
  onSubmit,
  submitLabel,
  inDialog = false,
}: TermsAcceptanceProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setHasScrolledToBottom(atBottom);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  const canCheck = hasScrolledToBottom;
  const label =
    variant === "pro"
      ? t.terms.acceptPro
      : t.terms.acceptBooking;
  const viewFull = t.terms.viewFullTerms;
  /** Booking: enable Continue when scrolled to bottom (no checkbox). Pro: enable when checkbox checked. */
  const canSubmit = variant === "booking" ? hasScrolledToBottom : accepted;
  const showCheckbox = variant === "pro";

  const scrollClass = inDialog
    ? "max-h-[50vh] overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm"
    : "max-h-[280px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm";

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        {variant === "pro" ? t.terms.readProAgreement : t.terms.readBeforeBooking}
      </p>

      <div ref={scrollRef} className={scrollClass}>
        <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed text-left">
          {variant === "pro" ? TERMS_SUMMARY_PRO : TERMS_SUMMARY_BOOKING}
        </pre>
        <p className="mt-4 pt-4 border-t border-border/50 text-foreground">
          <Link to="/terms" className="text-primary underline hover:no-underline font-medium">
            {viewFull}
          </Link>
        </p>
      </div>

      {variant === "booking" && !hasScrolledToBottom && (
        <p className="text-xs text-muted-foreground">
          {t.terms.scrollToEnable}
        </p>
      )}

      {showCheckbox && (
        <label
          className={`flex items-start gap-3 cursor-pointer ${
            canCheck ? "" : "opacity-60 pointer-events-none"
          }`}
        >
          <Checkbox
            checked={accepted}
            onCheckedChange={(v) => onAcceptedChange(v === true)}
            disabled={!canCheck}
            className="mt-0.5 shrink-0"
          />
          <span className="text-sm leading-relaxed select-none">{label}</span>
        </label>
      )}

      {onSubmit && submitLabel && (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`w-full ${!canSubmit ? "opacity-60" : ""}`}
        >
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
