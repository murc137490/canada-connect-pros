import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue } from "motion/react";
import { Expand, Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distanceKm, geocodeAddress } from "@/lib/geocode";
import { triggerMapResize, whenGoogleMapsReady } from "@/lib/loadGoogleMapsJs";
import { proBookingServiceLabel } from "@/lib/proBookingRequestDisplay";

type Locale = "en" | "fr";

type Booking = {
  id: string;
  public_booking_code?: string | null;
  invoice_number?: number | null;
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
  address: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapReadyVersion, setMapReadyVersion] = useState(0);

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
        address,
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

  // Keep the Google Map instance alive while the user changes date and radius filters.
  // Only recreate it when the map container moves into or out of the fullscreen portal.
  useEffect(() => {
    let cancelled = false;
    if (!mapElement.current) return;
    if (!MAPS_KEY) { setMapError(true); return; }
    void whenGoogleMapsReady(MAPS_KEY, false).then(() => {
      if (cancelled || !mapElement.current) return;
      const maps = (window as MapsWindow).google?.maps;
      if (!maps) throw new Error("Google Maps is unavailable");
      const mapCenter = proLocation ?? { lat: 45.4, lng: -72.73 };
      mapInstance.current = new maps.Map(mapElement.current, {
        center: mapCenter,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: expanded ? "greedy" : "cooperative",
        backgroundColor: "#101b1d",
      });
      setMapReadyVersion((version) => version + 1);
      setMapError(false);
    }).catch(() => { if (!cancelled) setMapError(true); });
    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
      circle.current?.setMap(null);
      circle.current = null;
      mapInstance.current = null;
    };
  }, [expanded, proLocation]);

  // Refresh only markers and the radius overlay. Keep the map object and camera position.
  useEffect(() => {
    const map = mapInstance.current;
    const maps = (window as MapsWindow).google?.maps;
    if (!map || !maps) return;

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
  }, [visiblePoints, areaEnabled, mapRadiusKm, proLocation, locale, mapReadyVersion]);

  useEffect(() => {
    if (!selected || !mapInstance.current) return;
    mapInstance.current.setCenter({ lat: selected.lat, lng: selected.lng });
    mapInstance.current.setZoom(15);
  }, [selected, mapReadyVersion]);

  useEffect(() => () => {
    markers.current.forEach((marker) => marker.setMap(null));
    circle.current?.setMap(null);
    mapInstance.current = null;
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

  const nearbyBookings = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return points
      .filter((point) => {
        if (!query) return true;
        const bookingNumber = [point.booking.public_booking_code, point.booking.invoice_number, point.booking.id]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLocaleLowerCase();
        return [point.clientName, point.address, bookingNumber].some((value) => value.toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (!proLocation) return a.date.localeCompare(b.date);
        return distanceKm(proLocation.lat, proLocation.lng, a.lat, a.lng) - distanceKm(proLocation.lat, proLocation.lng, b.lat, b.lng);
      });
  }, [points, proLocation, searchQuery]);

  const selectBooking = (point: Point) => {
    setPeriod("upcoming");
    setAreaEnabled(false);
    setSelected(point);
    setSearchQuery("");
    setSearchOpen(false);
    mapInstance.current?.setCenter({ lat: point.lat, lng: point.lng });
    mapInstance.current?.setZoom(15);
  };

  const mapView = (
    <section
      className={expanded
        ? "fixed inset-0 z-[9999] m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#101b1d] p-0"
        : "relative rounded-xl border bg-card p-2"}
      aria-label={fr ? "Carte des réservations à venir" : "Upcoming bookings map"}
    >
      <div className={expanded ? "absolute inset-0 overflow-hidden" : "relative overflow-hidden rounded-lg"}>
        <div ref={mapElement} className={expanded ? "h-full min-h-full w-full bg-[#101b1d]" : "h-[190px] w-full bg-muted/40"} />
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
        {expanded && !loading && visiblePoints.length === 0 && !mapError ? <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white/80 backdrop-blur">{fr ? "Aucune réservation payée pour cette période et ce rayon." : "No paid bookings for this period and radius."}</div> : null}
      </div>

      {expanded ? (
        <>
          <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-wrap gap-1.5 rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur sm:left-5 sm:top-5">
            {periodOptions.map((option) => (
              <button key={option.id} type="button" onClick={() => setPeriod(option.id)} aria-pressed={period === option.id}
                className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${period === option.id ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-100"}`}>
                {option.label}
              </button>
            ))}
            <label className="flex cursor-pointer items-center gap-2 border-l border-slate-200 px-3 text-xs font-medium text-slate-700">
              <input type="checkbox" checked={areaEnabled} onChange={(event) => setAreaEnabled(event.target.checked)} className="size-4 accent-primary" />
              {fr ? "Zone" : "Area"}
            </label>
          </div>
          {areaEnabled ? <div className="absolute bottom-5 left-3 z-30 w-[min(26rem,calc(100vw-1.5rem))] rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur sm:bottom-6 sm:left-5"><ElasticRadiusSlider value={mapRadiusKm} onChange={setMapRadiusKm} locale={locale} /></div> : null}
          <div className="absolute right-3 top-3 z-40 flex w-[min(25rem,calc(100vw-1.5rem))] items-start gap-2 sm:right-5 sm:top-5">
            <div className="relative min-w-0 flex-1">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-xl ring-1 ring-black/5">
                <Search className="size-4 shrink-0 text-slate-500" aria-hidden />
                <input value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                  placeholder={fr ? "Nom, adresse ou no de réservation" : "Client, address or booking number"}
                  aria-label={fr ? "Rechercher une réservation par client, adresse ou numéro" : "Search bookings by client, address or number"}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500" />
                {searchQuery ? <button type="button" aria-label={fr ? "Effacer la recherche" : "Clear search"} onClick={() => setSearchQuery("")} className="rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button> : null}
              </div>
              {searchOpen ? <div className="absolute right-0 top-[calc(100%+0.5rem)] max-h-[min(65vh,34rem)] w-full overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-black/10">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{fr ? "Réservations les plus proches" : "Closest bookings"}</p>
                {nearbyBookings.length ? nearbyBookings.map((point) => {
                  const distance = proLocation ? distanceKm(proLocation.lat, proLocation.lng, point.lat, point.lng) : null;
                  const number = point.booking.public_booking_code || (point.booking.invoice_number ? `#${point.booking.invoice_number}` : `#${point.booking.id.slice(0, 8).toUpperCase()}`);
                  return <button key={point.booking.id} type="button" onClick={() => selectBooking(point)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{point.clientName}</span><span className="shrink-0 text-xs text-slate-500">{distance === null ? "" : `${distance.toFixed(1)} km`}</span></span>
                      <span className="mt-0.5 block truncate text-xs text-slate-600">{point.address}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{number} · {formatDate(point.date, locale)}{point.time ? ` · ${point.time}` : ""}</span></span>
                  </button>;
                }) : <p className="px-3 py-4 text-sm text-slate-500">{fr ? "Aucune réservation trouvée." : "No bookings found."}</p>}
              </div> : null}
            </div>
            <Button type="button" variant="outline" size="icon" aria-label={fr ? "Fermer la carte" : "Close map"} onClick={() => { setExpanded(false); setSearchOpen(false); }} className="size-11 shrink-0 rounded-2xl border-0 bg-white text-slate-800 shadow-xl hover:bg-slate-100">
              <X className="size-5" aria-hidden />
            </Button>
          </div>
          {searchOpen ? <button aria-label={fr ? "Fermer les résultats de recherche" : "Close search results"} className="fixed inset-0 z-20 cursor-default" onClick={() => setSearchOpen(false)} /> : null}
          {selected ? <div className="absolute bottom-5 right-3 z-30 flex max-w-[min(28rem,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl sm:bottom-6 sm:right-5">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{selected.clientName}</p><p className="truncate text-xs text-slate-600">{selected.address}</p><p className="truncate text-xs text-slate-500">{selected.service} · {formatDate(selected.date, locale)}{selected.time ? ` · ${selected.time}` : ""}</p></div>
            <Button type="button" size="sm" onClick={() => onOpenBooking(selected.booking.id)}>{fr ? "Réservation" : "Booking"}</Button>
          </div> : null}
          {loading ? <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white shadow-lg backdrop-blur"><Loader2 className="mr-2 inline size-3.5 animate-spin" />{fr ? "Localisation…" : "Locating…"}</div> : null}
        </>
      ) : null}
    </section>
  );

  return expanded && typeof document !== "undefined" ? createPortal(mapView, document.body) : mapView;
}

function ElasticRadiusSlider({ value, onChange, locale }: { value: number; onChange: (value: number) => void; locale: Locale }) {
  const stretch = useMotionValue(1);
  const fr = locale === "fr";
  const handlePointerDown = () => animate(stretch, 1.035, { type: "spring", stiffness: 360, damping: 18 });
  const handlePointerUp = () => animate(stretch, 1, { type: "spring", stiffness: 300, damping: 14, bounce: 0.35 });

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <MapPin className="size-4 shrink-0 text-slate-600" aria-hidden />
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
      <span className="w-16 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-900">{value} km</span>
    </div>
  );
}
