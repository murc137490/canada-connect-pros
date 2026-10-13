import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { Expand, Loader2, MapPin, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distanceKm, geocodeAddress } from "@/lib/geocode";
import { triggerMapResize, whenGoogleMapsReady } from "@/lib/loadGoogleMapsJs";
import { proBookingServiceLabel } from "@/lib/proBookingRequestDisplay";

type Locale = "en" | "fr";

type Booking = {
  id: string;
  created_at: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  service_duration_minutes?: number | null;
  status: string;
  client_id: string;
  service_category_slug?: string | null;
  service_slug?: string | null;
  service_location_choice?: string | null;
  invoice_snapshot?: unknown;
};

type Point = {
  booking: Booking;
  clientName: string;
  lat: number;
  lng: number;
  date: string;
  time: string | null;
  service: string;
};

type MapMarker = { setMap: (map: GoogleMap | null) => void; addListener: (event: string, callback: () => void) => void };
type GoogleMap = { setCenter: (point: { lat: number; lng: number }) => void; setZoom: (zoom: number) => void; fitBounds: (bounds: unknown, padding?: number) => void };
type GoogleCircle = { setMap: (map: GoogleMap | null) => void };
type GoogleMaps = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => MapMarker;
  Circle: new (options: Record<string, unknown>) => GoogleCircle;
  LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
};
type MapsWindow = Window & { google?: { maps?: GoogleMaps } };

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;
const TORONTO_TZ = "America/Toronto";

function ymdInToronto(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TORONTO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function isPaidSnapshot(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  const address = typeof snapshot.customer_address === "string" ? snapshot.customer_address.trim() : "";
  return snapshot.v === 2 && typeof snapshot.paid_at === "string" && address.length > 5 && !/not provided|non fourni/i.test(address);
}

function serviceAddressFromInvoice(value: string, clientName: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const postalLine = lines.findIndex((line) => /^(postal code|code postal)\s*:/i.test(line));
  const addressLines = postalLine >= 0 ? lines.slice(postalLine + 1) : lines;
  return addressLines
    .filter((line) => line !== clientName && !/^[+\d(][\d\s().+-]{6,}$/.test(line) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line))
    .join(", ")
    .trim();
}

function dateRange(period: string) {
  const today = ymdInToronto();
  const now = new Date(`${today}T12:00:00`);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: ymdInToronto(monday), to: ymdInToronto(sunday) };
  }
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-31` };
  return { from: today, to: "9999-12-31" };
}

function formatDate(date: string, locale: Locale) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" });
}

export default function ProUpcomingJobsMap({
  proProfileId,
  bookings,
  clientProfiles,
  locale,
  proLocation,
  defaultRadiusKm,
  onOpenBooking,
}: {
  proProfileId: string;
  bookings: Booking[];
  clientProfiles: Record<string, { full_name: string | null }>;
  locale: Locale;
  proLocation: { lat: number; lng: number } | null;
  defaultRadiusKm: number | null;
  onOpenBooking: (bookingId: string) => void;
}) {
  const fr = locale === "fr";
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<GoogleMap | null>(null);
  const markers = useRef<MapMarker[]>([]);
  const circle = useRef<GoogleCircle | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [period, setPeriod] = useState("upcoming");
  const [areaEnabled, setAreaEnabled] = useState(true);
  const [mapRadiusKm, setMapRadiusKm] = useState(Math.min(100, Math.max(5, defaultRadiusKm ?? 50)));
  const [selected, setSelected] = useState<Point | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setMapRadiusKm(Math.min(100, Math.max(5, defaultRadiusKm ?? 50)));
  }, [proProfileId, defaultRadiusKm]);

  const eligibleBookings = useMemo(() => {
    const today = ymdInToronto();
    return bookings.filter((booking) => {
      const visitDate = booking.preferred_date?.slice(0, 10) ?? "";
      return booking.status === "accepted" && booking.service_location_choice === "travel" && visitDate >= today && isPaidSnapshot(booking.invoice_snapshot);
    });
  }, [bookings]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all(eligibleBookings.map(async (booking) => {
      const snapshot = booking.invoice_snapshot as Record<string, unknown>;
      const invoiceAddress = String(snapshot.customer_address ?? "").trim();
      const address = serviceAddressFromInvoice(invoiceAddress, clientProfiles[booking.client_id]?.full_name?.trim() ?? "");
      if (address.length < 5) return null;
      const location = await geocodeAddress(address).catch(() => null);
      if (!location) return null;
      const date = booking.preferred_date?.slice(0, 10) ?? "";
      return {
        booking,
        clientName: clientProfiles[booking.client_id]?.full_name?.trim() || "Client",
        lat: location.lat,
        lng: location.lng,
        date,
        time: booking.preferred_time?.slice(0, 5) ?? null,
        service: proBookingServiceLabel(booking, locale) || (fr ? "Service" : "Service"),
      } satisfies Point;
    })).then((rows) => {
      if (cancelled) return;
      setPoints(rows.filter((point): point is Point => point !== null));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eligibleBookings, clientProfiles, locale]);

  const bounds = dateRange(period);
  const visiblePoints = useMemo(() => points.filter((point) => {
    if (point.date < bounds.from || point.date > bounds.to) return false;
    if (areaEnabled && proLocation && distanceKm(proLocation.lat, proLocation.lng, point.lat, point.lng) > mapRadiusKm) return false;
    return true;
  }), [points, bounds.from, bounds.to, areaEnabled, proLocation, mapRadiusKm]);

  useEffect(() => {
    let cancelled = false;
    if (!mapElement.current) return;
    if (!MAPS_KEY) { setMapError(true); return; }
    void whenGoogleMapsReady(MAPS_KEY, false).then(() => {
      if (cancelled || !mapElement.current) return;
      const maps = (window as MapsWindow).google?.maps;
      if (!maps) throw new Error("Google Maps is unavailable");
      const mapCenter = proLocation ?? (visiblePoints[0] ? { lat: visiblePoints[0].lat, lng: visiblePoints[0].lng } : { lat: 45.4, lng: -72.73 });
      if (!mapInstance.current) {
        mapInstance.current = new maps.Map(mapElement.current, {
          center: mapCenter,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "cooperative",
          backgroundColor: "#101b1d",
        });
      }
      const map = mapInstance.current;
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
      circle.current?.setMap(null);
      circle.current = null;

      if (areaEnabled && proLocation) {
        circle.current = new maps.Circle({
          map,
          center: proLocation,
          radius: mapRadiusKm * 1000,
          fillColor: "#35a985",
          fillOpacity: 0.08,
          strokeColor: "#35a985",
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
        });
        map.setCenter(proLocation);
        map.setZoom(mapRadiusKm <= 10 ? 11 : mapRadiusKm <= 25 ? 10 : mapRadiusKm <= 50 ? 9 : 8);
      } else if (visiblePoints.length) {
        const mapBounds = new maps.LatLngBounds();
        if (proLocation) mapBounds.extend(proLocation);
        visiblePoints.forEach((point) => mapBounds.extend({ lat: point.lat, lng: point.lng }));
        map.fitBounds(mapBounds, 28);
      } else {
        map.setCenter(mapCenter);
        map.setZoom(10);
      }

      visiblePoints.forEach((point) => {
        const marker = new maps.Marker({
          map,
          position: { lat: point.lat, lng: point.lng },
          title: `${point.clientName} · ${formatDate(point.date, locale)}`,
          icon: {
            path: 0,
            fillColor: "#208c70",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            scale: 8,
          },
        });
        marker.addListener("click", () => setSelected(point));
        markers.current.push(marker);
      });
      setMapError(false);
    }).catch(() => { if (!cancelled) setMapError(true); });
    return () => { cancelled = true; };
  }, [visiblePoints, areaEnabled, mapRadiusKm, proLocation, locale]);

  useEffect(() => () => {
    markers.current.forEach((marker) => marker.setMap(null));
    circle.current?.setMap(null);
  }, []);

  useEffect(() => {
    if (selected && !visiblePoints.some((point) => point.booking.id === selected.booking.id)) setSelected(null);
  }, [selected, visiblePoints]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const resizeTimer = window.setTimeout(() => triggerMapResize(mapInstance.current), 120);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  const periodOptions = [
    { id: "today", label: fr ? "Aujourd’hui" : "Today" },
    { id: "week", label: fr ? "Cette semaine" : "This week" },
    { id: "month", label: fr ? "Ce mois-ci" : "This month" },
    { id: "upcoming", label: fr ? "À venir" : "Upcoming" },
  ];

  return (
    <section
      className={expanded
        ? "fixed inset-0 z-[100] m-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-y-auto rounded-none border-0 bg-background p-4 sm:p-6"
        : "relative rounded-xl border bg-card p-2"}
      aria-label={fr ? "Carte des réservations à venir" : "Upcoming bookings map"}
    >
      {expanded ? (
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <MapPin className="size-5 text-primary" aria-hidden />{fr ? "Réservations à venir" : "Upcoming jobs"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr ? "Repères des réservations acceptées, payées et avec déplacement." : "Pins show accepted, paid bookings that require travel."}
            </p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label={fr ? "Fermer la carte" : "Close map"} onClick={() => setExpanded(false)}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      {expanded ? (
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                aria-pressed={period === option.id}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${period === option.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              >{option.label}</button>
            ))}
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={areaEnabled} onChange={(event) => setAreaEnabled(event.target.checked)} className="size-4 accent-primary" />
            {fr ? "Zone de service" : "Service area"}
          </label>
        </div>
      ) : null}

      {expanded && areaEnabled ? (
        <ElasticRadiusSlider value={mapRadiusKm} onChange={setMapRadiusKm} locale={locale} />
      ) : null}

      <div className={expanded ? "relative min-h-[250px] flex-1 overflow-hidden rounded-xl border border-border/70" : "relative overflow-hidden rounded-lg"}>
        <div ref={mapElement} className={expanded ? "h-full min-h-[250px] w-full bg-muted/40" : "h-[190px] w-full bg-muted/40"} />
        {!expanded && !mapError ? (
          <button
            type="button"
            className="absolute inset-0 z-10 flex items-end justify-end p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={fr ? "Ouvrir la carte en plein écran" : "Open map full screen"}
            onClick={() => setExpanded(true)}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
              <Expand className="size-3.5" aria-hidden />{fr ? "Agrandir" : "Expand map"}
            </span>
          </button>
        ) : null}
        {mapError ? <div className="absolute inset-0 z-20 grid place-items-center bg-background/90 px-4 text-center text-sm text-muted-foreground">{fr ? "La carte est temporairement indisponible." : "The map is temporarily unavailable."}</div> : null}
        {loading ? <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-md bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />{fr ? "Localisation des réservations…" : "Locating bookings…"}</div> : null}
        {expanded && !loading && visiblePoints.length === 0 && !mapError ? <div className="absolute inset-x-3 bottom-3 z-10 rounded-md bg-background/95 px-3 py-2 text-center text-xs text-muted-foreground">{fr ? "Aucune réservation payée à afficher pour cette période et ce rayon." : "No paid bookings to show for this period and radius."}</div> : null}
      </div>

      {expanded ? (
        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{visiblePoints.length} {fr ? (visiblePoints.length === 1 ? "réservation" : "réservations") : (visiblePoints.length === 1 ? "booking" : "bookings")}</span>
          {proLocation ? <span className="inline-flex items-center gap-1"><Navigation className="size-3" aria-hidden />{fr ? "Zone centrée sur votre profil" : "Area centered on your profile"}</span> : null}
        </div>
      ) : null}

      {expanded && selected ? (
        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{selected.clientName}</p>
            <p className="text-xs text-muted-foreground">{selected.service} · {formatDate(selected.date, locale)}{selected.time ? ` · ${selected.time}` : ""}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenBooking(selected.booking.id)}>{fr ? "Voir la réservation" : "View booking"}</Button>
        </div>
      ) : null}
    </section>
  );
}

function ElasticRadiusSlider({ value, onChange, locale }: { value: number; onChange: (value: number) => void; locale: Locale }) {
  const stretch = useMotionValue(1);
  const fr = locale === "fr";
  const handlePointerDown = () => animate(stretch, 1.035, { type: "spring", stiffness: 360, damping: 18 });
  const handlePointerUp = () => animate(stretch, 1, { type: "spring", stiffness: 300, damping: 14, bounce: 0.35 });

  return (
    <div className="mb-4 flex shrink-0 items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 sm:max-w-xl">
      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <motion.div className="min-w-0 flex-1" style={{ scaleX: stretch }}>
        <input
          aria-label={fr ? "Rayon de service en kilomètres" : "Service radius in kilometres"}
          type="range"
          min={5}
          max={100}
          step={5}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="h-2 w-full cursor-pointer accent-primary"
        />
      </motion.div>
      <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{value} km</span>
    </div>
  );
}
