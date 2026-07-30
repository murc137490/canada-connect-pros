import { useRef, useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { reverseGeocode } from "@/lib/geocode";
import { whenGoogleMapsReady, triggerMapResize } from "@/lib/loadGoogleMapsJs";
import type { ServiceLocationMode } from "@/lib/serviceLocationMode";
import { MapPin, Loader2 } from "lucide-react";

const GOOGLE_PLACES_KEY = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY) as
  | string
  | undefined;

const RADIUS_OPTIONS_KM = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150];

export interface ServiceAreaValue {
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
  location: string | null;
}

interface ProServiceAreaMapProps {
  value: ServiceAreaValue;
  onChange: (v: ServiceAreaValue) => void;
  centerPlaceholder?: string;
  radiusLabel?: string;
  atWorkspaceOnly?: boolean;
  locationMode?: ServiceLocationMode;
  workspaceSectionLabel?: string;
  useMyLocationLabel?: string;
}

interface GoogleMapsWindow {
  google?: {
    maps: {
      Map: new (el: HTMLElement, opts: object) => {
        setCenter: (c: { lat: number; lng: number }) => void;
        setZoom: (z: number) => void;
      };
      Circle: new (opts: {
        map: unknown;
        center: { lat: number; lng: number };
        radius: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
      }) => { setCenter: (c: { lat: number; lng: number }) => void; setRadius: (r: number) => void };
      places: {
        Autocomplete: new (
          el: HTMLInputElement,
          o: object,
        ) => { getPlace: () => PlaceResult; addListener: (e: string, fn: () => void) => void };
      };
    };
  };
}

interface PlaceResult {
  geometry?: { location?: { lat: () => number; lng: () => number } };
  formatted_address?: string;
  name?: string;
}

export default function ProServiceAreaMap({
  value,
  onChange,
  centerPlaceholder = "Search address or use my location...",
  radiusLabel = "Service radius (km)",
  atWorkspaceOnly = false,
  locationMode: locationModeProp,
  workspaceSectionLabel = "Workspace location (clients come to you)",
  useMyLocationLabel = "Use my current location",
}: ProServiceAreaMapProps) {
  const locationMode: ServiceLocationMode =
    locationModeProp ?? (atWorkspaceOnly ? "workspace" : "travel");
  const showWorkspaceAddress = locationMode === "workspace" || locationMode === "both";
  const showTravelMap = locationMode === "travel" || locationMode === "both";
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void } | null>(
    null,
  );
  const circleRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; setRadius: (r: number) => void } | null>(
    null,
  );
  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const autocompleteInitRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const bindAutocomplete = useCallback(
    (input: HTMLInputElement) => {
      const g = (window as unknown as GoogleMapsWindow).google;
      if (!g?.maps?.places) return;
      const autocomplete = new g.maps.places.Autocomplete(input, {
        types: ["address"],
        componentRestrictions: { country: ["ca"] },
        fields: ["formatted_address", "name", "geometry"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace() as PlaceResult;
        const loc = place.geometry?.location;
        if (!loc) return;
        const lat = loc.lat();
        const lng = loc.lng();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(10);
        }
        if (circleRef.current) circleRef.current.setCenter({ lat, lng });
        onChange({
          latitude: lat,
          longitude: lng,
          service_radius_km: showTravelMap ? value.service_radius_km : null,
          location: place.formatted_address ?? place.name ?? value.location,
        });
        requestAnimationFrame(() => triggerMapResize(mapInstanceRef.current));
      });
    },
    [onChange, showTravelMap, value.service_radius_km, value.location],
  );

  useEffect(() => {
    if (!GOOGLE_PLACES_KEY || !inputRef.current) return;
    if (autocompleteInitRef.current) return;

    let cancelled = false;
    void whenGoogleMapsReady(GOOGLE_PLACES_KEY)
      .then(() => {
        if (cancelled || !inputRef.current || autocompleteInitRef.current) return;
        autocompleteInitRef.current = true;
        bindAutocomplete(inputRef.current);
      })
      .catch(() => setMapError(true));

    return () => {
      cancelled = true;
    };
  }, [GOOGLE_PLACES_KEY, bindAutocomplete, locationMode]);

  useEffect(() => {
    if (!showTravelMap || !GOOGLE_PLACES_KEY) {
      setMapReady(false);
      return;
    }

    let cancelled = false;
    setMapLoading(true);
    setMapError(false);

    const initMap = async () => {
      try {
        await whenGoogleMapsReady(GOOGLE_PLACES_KEY);
        if (cancelled || !mapRef.current) return;

        const g = (window as unknown as GoogleMapsWindow).google;
        if (!g?.maps) throw new Error("Google Maps unavailable");

        const center =
          value.latitude != null && value.longitude != null
            ? { lat: value.latitude, lng: value.longitude }
            : { lat: 45.5017, lng: -73.5673 };

        if (!mapInstanceRef.current) {
          const map = new g.maps.Map(mapRef.current, {
            zoom: value.service_radius_km ? 10 : 8,
            center,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          });
          mapInstanceRef.current = map;

          const radiusKm = value.service_radius_km ?? 25;
          circleRef.current = new g.maps.Circle({
            map,
            center,
            radius: radiusKm * 1000,
            fillColor: "#3b82f6",
            fillOpacity: 0.2,
            strokeColor: "#2563eb",
            strokeOpacity: 0.8,
            strokeWeight: 2,
          });
        } else {
          mapInstanceRef.current.setCenter(center);
          if (circleRef.current) circleRef.current.setCenter(center);
        }

        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = new ResizeObserver(() => {
          triggerMapResize(mapInstanceRef.current);
        });
        resizeObserverRef.current.observe(mapRef.current);

        requestAnimationFrame(() => {
          triggerMapResize(mapInstanceRef.current);
          setTimeout(() => triggerMapResize(mapInstanceRef.current), 200);
          setTimeout(() => triggerMapResize(mapInstanceRef.current), 600);
        });

        if (!cancelled) {
          setMapReady(true);
          setMapLoading(false);
        }
      } catch (err) {
        console.warn("Google Maps init failed:", err);
        if (!cancelled) {
          setMapError(true);
          setMapLoading(false);
        }
      }
    };

    const t = setTimeout(() => void initMap(), 50);

    return () => {
      cancelled = true;
      clearTimeout(t);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [showTravelMap, GOOGLE_PLACES_KEY, locationMode]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !circleRef.current) return;
    if (value.latitude != null && value.longitude != null) {
      const center = { lat: value.latitude, lng: value.longitude };
      mapInstanceRef.current.setCenter(center);
      circleRef.current.setCenter(center);
    }
    const radiusKm = value.service_radius_km ?? 25;
    circleRef.current.setRadius(radiusKm * 1000);
    triggerMapResize(mapInstanceRef.current);
  }, [mapReady, value.latitude, value.longitude, value.service_radius_km]);

  const setRadius = (km: number) => {
    onChange({ ...value, service_radius_km: km });
    if (circleRef.current) circleRef.current.setRadius(km * 1000);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = await reverseGeocode(lat, lng);
        onChange({
          latitude: lat,
          longitude: lng,
          service_radius_km: showTravelMap ? value.service_radius_km : null,
          location: addr ?? value.location,
        });
        if (inputRef.current) inputRef.current.value = addr ?? "";
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(12);
          triggerMapResize(mapInstanceRef.current);
        }
        if (circleRef.current) circleRef.current.setCenter({ lat, lng });
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
    );
  };

  const showFallback = !GOOGLE_PLACES_KEY || mapError;

  if (locationMode === "workspace") {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{workspaceSectionLabel}</Label>
          <Input
            ref={inputRef}
            type="text"
            defaultValue={value.location ?? ""}
            placeholder={centerPlaceholder}
            className="w-full"
            autoComplete="off"
          />
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleUseMyLocation} disabled={gettingLocation}>
            {gettingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            {useMyLocationLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (showFallback && showTravelMap) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Service area centre</Label>
          <Input
            ref={inputRef}
            type="text"
            defaultValue={value.location ?? ""}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
            placeholder={centerPlaceholder}
            className="w-full"
            autoComplete="off"
          />
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleUseMyLocation} disabled={gettingLocation}>
            {gettingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            {useMyLocationLabel}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>{radiusLabel}</Label>
          <p className="text-sm text-muted-foreground">
            {!GOOGLE_PLACES_KEY
              ? "Add VITE_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_PLACES_API_KEY to .env to show the map."
              : "Map could not be loaded. Set your location and radius above - the form will still work. In Google Cloud Console, enable Maps JavaScript API and Places API, add your site to HTTP referrers, and enable billing."}
          </p>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS_KM.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => onChange({ ...value, service_radius_km: km })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  (value.service_radius_km ?? 25) === km
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {locationMode === "both" ? (
        <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/15 px-3 py-2">
          Set your workspace address and how far you travel to clients.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label>{locationMode === "both" ? workspaceSectionLabel : "Service area centre"}</Label>
        <Input
          ref={inputRef}
          type="text"
          defaultValue={value.location ?? ""}
          placeholder={centerPlaceholder}
          className="w-full"
          autoComplete="off"
        />
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleUseMyLocation} disabled={gettingLocation}>
          {gettingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          {useMyLocationLabel}
        </Button>
      </div>
      {showTravelMap && (
        <>
          <div className="space-y-2">
            <Label>
              {radiusLabel}: {value.service_radius_km ?? 25} km
            </Label>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setRadius(km)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    (value.service_radius_km ?? 25) === km
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full min-h-[16rem]">
            {mapLoading && !mapReady && !mapError ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-border bg-muted/80">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            {mapError ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 p-3 min-h-[16rem] flex items-center">
                {!GOOGLE_PLACES_KEY
                  ? "Add VITE_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_PLACES_API_KEY to .env to show the map."
                  : "Map could not load. You can still set radius and address above."}
              </p>
            ) : (
              <div
                ref={mapRef}
                className="w-full min-h-[16rem] h-64 rounded-lg border border-border bg-muted"
                style={{ minHeight: 256 }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
