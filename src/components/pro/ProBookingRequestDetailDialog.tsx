import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDriveDurationLabel } from "@/lib/drivingDistance";
import { formatBookingTimeRange } from "@/lib/bookingTimeRange";
import { proBookingAmountDisplay, proBookingServiceLabel, type ProBookingRequestRow } from "@/lib/proBookingRequestDisplay";
import { bookingUsesTravelDistance, type ServiceLocationMode } from "@/lib/serviceLocationMode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: ProBookingRequestRow | null;
  serviceLocationMode?: ServiceLocationMode;
  clientName?: string | null;
  clientPhone?: string | null;
  canSeePhone?: boolean;
  statusLabel?: string;
  /** Pros see status only — never the government ID image. */
  clientIdentityVerified?: boolean;
};

export default function ProBookingRequestDetailDialog({
  open,
  onOpenChange,
  booking,
  serviceLocationMode = "travel",
  clientName,
  clientPhone,
  canSeePhone = false,
  statusLabel,
  clientIdentityVerified = false,
}: Props) {
  const { t, locale } = useLanguage();
  if (!booking) return null;

  const serviceLabel = proBookingServiceLabel(booking, locale);
  const amountLabel = proBookingAmountDisplay(booking);
  const choice = (booking.service_location_choice === "travel" ? "travel" : "workspace") as "workspace" | "travel";
  const showDistance = bookingUsesTravelDistance(serviceLocationMode, choice);

  const scheduleLine = [booking.preferred_date, booking.preferred_time]
    .filter(Boolean)
    .map((part, i) => {
      if (i === 0 && booking.preferred_date) {
        return new Date(String(booking.preferred_date) + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "medium" });
      }
      if (booking.preferred_time) {
        return formatBookingTimeRange(String(booking.preferred_time), booking.service_duration_minutes) || String(booking.preferred_time).slice(0, 5);
      }
      return null;
    })
    .filter(Boolean)
    .join(" · ");

  const locationLabel =
    choice === "workspace"
      ? t.dashboard.proBookingAtWorkspace ?? "Client visits your workspace"
      : t.dashboard.proBookingTravelToClient ?? "At client's address";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.dashboard.proBookingDetailTitle ?? "Booking request details"}</DialogTitle>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          {statusLabel ? (
            <div>
              <dt className="text-muted-foreground">{t.dashboard.statusLabel ?? "Status"}</dt>
              <dd className="font-medium text-foreground">{statusLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">{t.dashboard.proBookingClientName ?? "Client"}</dt>
            <dd className="font-medium text-foreground">{clientName?.trim() || "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {locale === "fr" ? "Vérification d’identité" : "Identity verification"}
            </dt>
            <dd className="font-medium text-foreground">
              {clientIdentityVerified
                ? locale === "fr"
                  ? "Identité vérifiée ✓"
                  : "Identity verified ✓"
                : locale === "fr"
                  ? "Non vérifiée / en attente"
                  : "Not verified / pending"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.dashboard.phone ?? "Phone"}</dt>
            <dd className="font-medium text-foreground">
              {canSeePhone && clientPhone?.trim()
                ? clientPhone.trim()
                : t.dashboard.proBookingPhoneAfterAccept ?? "Shown after you accept this booking."}
            </dd>
          </div>
          {serviceLabel ? (
            <div>
              <dt className="text-muted-foreground">{t.dashboard.invoiceService ?? "Service"}</dt>
              <dd className="font-medium text-foreground">{serviceLabel}</dd>
            </div>
          ) : null}
          {amountLabel ? (
            <div>
              <dt className="text-muted-foreground">{t.dashboard.invoiceTotal ?? "Total charged"}</dt>
              <dd className="font-medium text-foreground">{amountLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">{t.dashboard.proBookingLocation ?? "Service location"}</dt>
            <dd className="font-medium text-foreground">{locationLabel}</dd>
          </div>
          {showDistance && booking.distance_km_snapshot != null ? (
            <div>
              <dt className="text-muted-foreground">{t.dashboard.proBookingTravelDistance ?? "Travel estimate"}</dt>
              <dd className="font-medium text-foreground">
                {(t.dashboard.proBookingDistanceLine ?? "~{{km}} km from you · ~{{duration}} by car")
                  .replace("{{km}}", String(Math.round(Number(booking.distance_km_snapshot) * 10) / 10))
                  .replace(
                    "{{duration}}",
                    booking.drive_minutes_snapshot != null
                      ? formatDriveDurationLabel(Number(booking.drive_minutes_snapshot))
                      : "-",
                  )}
              </dd>
            </div>
          ) : null}
          {scheduleLine ? (
            <div>
              <dt className="text-muted-foreground">{t.dashboard.proBookingSchedule ?? "Requested schedule"}</dt>
              <dd className="font-medium text-foreground">{scheduleLine}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">{t.dashboard.requestedOn ?? "Requested on"}</dt>
            <dd className="font-medium text-foreground">
              {new Date(booking.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
