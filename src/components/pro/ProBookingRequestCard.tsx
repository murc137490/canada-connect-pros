import { CheckCircle, Star, XCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDriveDurationLabel } from "@/lib/drivingDistance";
import { formatProResponseDuration } from "@/lib/bookingResponseTime";
import { formatBookingTimeRange } from "@/lib/bookingTimeRange";
import { proBookingAmountDisplay, proBookingServiceLabel, type ProBookingRequestRow } from "@/lib/proBookingRequestDisplay";
import { bookingUsesTravelDistance, type ServiceLocationMode } from "@/lib/serviceLocationMode";

export type { ProBookingRequestRow };

export type ProBookingRequestCardProps = {
  booking: ProBookingRequestRow;
  /** Pending list: service, price, distance only (no name, schedule, phone, or ID). */
  compactPending?: boolean;
  serviceLocationMode?: ServiceLocationMode;
  isLocked: boolean;
  statusLabel: string;
  onLockedClick?: () => void;
  onApprove?: () => void;
  onDecline?: () => void;
  onMarkComplete?: () => void;
  onReviewClient?: () => void;
  onUploadProof?: () => void;
  approveSubmitting?: boolean;
  markCompleteSubmitting?: boolean;
  showReviewButton?: boolean;
  showProofButton?: boolean;
  isUnread?: boolean;
  onOpenDetail?: () => void;
};

export default function ProBookingRequestCard({
  booking: b,
  compactPending = false,
  serviceLocationMode = "travel",
  isLocked,
  statusLabel,
  onLockedClick,
  onApprove,
  onDecline,
  onMarkComplete,
  onReviewClient,
  onUploadProof,
  approveSubmitting,
  markCompleteSubmitting,
  showReviewButton,
  showProofButton,
  isUnread = false,
  onOpenDetail,
}: ProBookingRequestCardProps) {
  const { t, locale } = useLanguage();
  const serviceLabel = proBookingServiceLabel(b, locale);
  const amountLabel = proBookingAmountDisplay(b);

  const choice = (b.service_location_choice === "travel" ? "travel" : "workspace") as "workspace" | "travel";
  const showDistance = bookingUsesTravelDistance(serviceLocationMode, choice);
  const distanceLine =
    showDistance && b.distance_km_snapshot != null
      ? (t.dashboard.proBookingDistanceLine ?? "~{{km}} km from you · ~{{duration}} by car")
          .replace("{{km}}", String(Math.round(Number(b.distance_km_snapshot) * 10) / 10))
          .replace(
            "{{duration}}",
            b.drive_minutes_snapshot != null
              ? formatDriveDurationLabel(Number(b.drive_minutes_snapshot))
              : "-",
          )
      : null;

  const scheduleLine =
    !compactPending && (b.preferred_date || b.preferred_time)
      ? [
          b.preferred_date
            ? new Date(String(b.preferred_date) + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })
            : null,
          b.preferred_time
            ? formatBookingTimeRange(String(b.preferred_time), b.service_duration_minutes) || String(b.preferred_time).slice(0, 5)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <li
      className={`relative text-sm ${isLocked ? "cursor-pointer overflow-hidden rounded-lg border border-primary/20 bg-muted/20 p-3" : onOpenDetail ? "py-3 border-b border-border/50 last:border-0 cursor-pointer rounded-lg hover:bg-muted/30 transition-colors px-2 -mx-2" : "py-3 border-b border-border/50 last:border-0"}`}
      onClick={(event) => {
        if (isLocked) {
          onLockedClick?.();
          return;
        }
        if ((event.target as HTMLElement).closest("button")) return;
        onOpenDetail?.();
      }}
      onKeyDown={(event) => {
        if (!onOpenDetail && !isLocked) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (isLocked) onLockedClick?.();
          else onOpenDetail?.();
        }
      }}
      role={isLocked || onOpenDetail ? "button" : undefined}
      tabIndex={isLocked || onOpenDetail ? 0 : undefined}
    >
      <div className={`space-y-2 ${isLocked ? "pointer-events-none select-none blur-sm" : ""}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden />
            {t.dashboard.requestedOn} {new Date(b.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {isUnread ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                {t.dashboard.newBookingNotification ?? "New"}
              </span>
            ) : null}
            <span className="text-muted-foreground font-medium">{statusLabel}</span>
          </span>
        </div>

        {!compactPending ? (
          <p className="text-xs text-muted-foreground">
            {(() => {
              const responseFmt = formatProResponseDuration(b.created_at, b.responded_at, locale);
              if (responseFmt) return (t.dashboard.proResponseTimeLine ?? "Response: {{value}}").replace("{{value}}", responseFmt);
              return t.dashboard.proResponseWaiting ?? "";
            })()}
          </p>
        ) : b.status === "pending" ? (
          <p className="text-xs text-muted-foreground">{t.dashboard.proResponseWaiting ?? ""}</p>
        ) : null}

        {serviceLabel ? (
          <p className="text-sm text-foreground">
            {!compactPending ? <span className="text-muted-foreground">{t.dashboard.invoiceService ?? "Service"}: </span> : null}
            <span className={compactPending ? "font-medium" : undefined}>{serviceLabel}</span>
          </p>
        ) : null}

        {amountLabel ? (
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">{t.dashboard.invoiceTotal ?? "Total charged"}: </span>
            <span className="font-semibold">{amountLabel}</span>
          </p>
        ) : null}

        {distanceLine ? <p className="text-sm text-foreground">{distanceLine}</p> : null}

        {!compactPending && choice === "workspace" && serviceLocationMode !== "travel" ? (
          <p className="text-xs text-muted-foreground">{t.dashboard.proBookingAtWorkspace ?? "Client visits your workspace"}</p>
        ) : null}

        {scheduleLine ? <p className="text-xs text-muted-foreground">{scheduleLine}</p> : null}

        {compactPending && onOpenDetail ? (
          <p className="text-xs text-primary/90 font-medium">{t.dashboard.proBookingTapForDetails ?? "Tap for details"}</p>
        ) : null}

        {b.status === "declined" && b.decline_reason ? (
          <p className="text-xs text-muted-foreground">Reason: {b.decline_reason}</p>
        ) : null}

        <div className="flex gap-2 mt-1 flex-wrap">
          {b.status === "pending" && onApprove && onDecline ? (
            <>
              <Button type="button" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onApprove(); }} disabled={isLocked || approveSubmitting}>
                {approveSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} {t.dashboard.approve}
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onDecline(); }} disabled={isLocked}>
                <XCircle size={14} /> {t.dashboard.decline}
              </Button>
            </>
          ) : null}
          {b.status === "accepted" && onMarkComplete ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              disabled={isLocked || markCompleteSubmitting}
              onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
            >
              {markCompleteSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {t.dashboard.markServiceComplete ?? "Mark service completed"}
            </Button>
          ) : null}
          {showReviewButton && onReviewClient ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onReviewClient(); }} disabled={isLocked}>
              <Star size={14} /> {t.dashboard.reviewClient}
            </Button>
          ) : null}
          {showProofButton && onUploadProof ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onUploadProof(); }} disabled={isLocked}>
              <FileText size={14} /> Upload proof
            </Button>
          ) : null}
        </div>
      </div>
      {isLocked ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/35 px-4 text-center">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
            {t.dashboard.requestLockedBadge ?? "Upgrade to unlock"}
          </span>
        </div>
      ) : null}
    </li>
  );
}
