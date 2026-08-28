import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Soft dark fade overlay used while Square tokenizes / charges (avoids white flash on Google Pay). */
export function PaymentProcessingOverlay({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("sq-pay-processing-overlay", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="sq-pay-processing-inner">
        <Loader2 className="size-6 animate-spin text-white" aria-hidden />
        {label ? <p className="sq-pay-processing-label">{label}</p> : null}
      </div>
    </div>
  );
}
