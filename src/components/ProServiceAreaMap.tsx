import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { reverseGeocode } from "@/lib/geocode";
import { MapPin, Loader2 } from "lucide-react";

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

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
  /** When true, only show workspace address (no radius/map circle). */
  atWorkspaceOnly?: boolean;
  useMyLocationLabel?: string;
}

// Minimal types for Google Maps (no @types/google.maps required)
interface GoogleMapsWindow {
  google?: {
    maps: {
      Map: new (el: HTMLElement, opts: object) => { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void };
      Circle: new (opts: { map: unknown; center: { lat: number; lng: number }; radius: number; fillColor?: string; fillOpacity?: number; strokeColor?: string; strokeOpacity?: number; strokeWeight?: number }) => { setCenter: (c: { lat: number; lng: number }) => void; setRadius: (r: number) => void };
      places: {
        Autocomplete: new (el: HTMLInputElement, o: object) => { getPlace: () => PlaceResult; addListener: (e: string, fn: () => void) => void };
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
  useMyLocationLabel = "Use my current location",
}: ProServiceAreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void } | null>(null);
  const circleRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; setRadius: (r: number) => void } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const autocompleteInitRef = useRef(false);

  useEffect(() => {
    if (!GOOGLE_PLACES_KEY || !mapRef.current || !inputRef.current) return;

    const initMap = () => {
      try {
        const g = (window as unknown as GoogleMapsWindow).google;
        if (!g?.maps || !mapRef.current || !inputRef.current) return;

        const center = value.latitude != null && value.longitude != null
        ? { lat: value.latitude, lng: value.longitude }
        : { lat: 43.6532, lng: -79.3832 }; // Toronto fallback

      const map = new g.maps.Map(mapRef.current, {
        zoom: value.service_radius_km ? 10 : 8,
        center,
        mapTypeControl: true,
        streetViewControl: false,
      });
      mapInstanceRef.current = map;

      const radiusKm = value.service_radius_km ?? 25;
      const circle = new g.maps.Circle({
        map,
        center,
        radius: radiusKm * 1000,
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        strokeColor: "#2563eb",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      circleRef.current = circle;

      if (!autocompleteInitRef.current && inputRef.current) {
        autocompleteInitRef.current = true;
        const autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
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
          if (map) map.setCenter({ lat, lng });
          if (map) map.setZoom(10);
          if (circle) circle.setCenter({ lat, lng });
          onChange({
            latitude: lat,
            longitude: lng,
            service_radius_km: value.service_radius_km,
            location: place.formatted_address ?? place.name ?? value.location,
          });
        });
      }

        setMapReady(true);
      } catch (err) {
        console.warn("Google Maps init failed:", err);
        setMapError(true);
      }
    };

    if ((window as unknown as GoogleMapsWindow).google?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => initMap();
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
    const t = setTimeout(() => {
      if (mapRef.current?.querySelector?.("[src*='maps.google.com']") || mapRef.current?.innerHTML?.includes("can't load") || mapRef.current?.innerHTML?.includes("Do you own")) {
        setMapError(true);
      }
    }, 3000);
    return () => {
      clearTimeout(t);
      script.remove();
      mapInstanceRef.current = null;
      circleRef.current = null;
    };
  }, [GOOGLE_PLACES_KEY]);

  const workspacePlacesInitRef = useRef(false);
  useEffect(() => {
    if (!atWorkspaceOnly || !GOOGLE_PLACES_KEY || !inputRef.current) return;
    const initPlacesOnly = () => {
      const g = (window as unknown as GoogleMapsWindow).google;
      if (!g?.maps?.places || !inputRef.current || workspacePlacesInitRef.current) return;
      workspacePlacesInitRef.current = true;
      const autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: ["ca"] },
        fields: ["formatted_address", "name", "geometry"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace() as PlaceResult;
        const loc = place.geometry?.location;
        if (!loc) return;
        onChange({
          latitude: loc.lat(),
          longitude: loc.lng(),
          service_radius_km: null,
          location: place.formatted_address ?? place.name ?? value.location,
        });
      });
    };
    if ((window as unknown as GoogleMapsWindow).google?.maps?.places) {
      initPlacesOnly();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => initPlacesOnly();
    document.head.appendChild(script);
    return () => { script.remove(); workspacePlacesInitRef.current = false; };
  }, [atWorkspaceOnly, GOOGLE_PLACES_KEY, onChange, value.location]);

  useEffect(() => {
    if (!mapReady || !(window as unknown as GoogleMapsWindow).google?.maps) return;
    const map = mapInstanceRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;

    if (value.latitude != null && value.longitude != null) {
      const center = { lat: value.latitude, lng: value.longitude };
      map.setCenter(center);
      circle.setCenter(center);
    }
    const radiusKm = value.service_radius_km ?? 25;
    circle.setRadius(radiusKm * 1000);
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
          service_radius_km: atWorkspaceOnly ? null : value.service_radius_km,
          location: addr ?? value.location,
        });
        if (inputRef.current) inputRef.current.value = addr ?? "";
        if (mapInstanceRef.current) mapInstanceRef.current.setCenter({ lat, lng });
        if (mapInstanceRef.current) mapInstanceRef.current.setZoom(12);
        if (circleRef.current) circleRef.current.setCenter({ lat, lng });
        setGettingLocation(false);
      },
      () => setGettingLocation(false)
    );
  };

  const showFallback = !GOOGLE_PLACES_KEY || mapError;
  const showRadiusAndMap = !atWorkspaceOnly;

  if (atWorkspaceOnly) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Workspace address (client comes to you)</Label>
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

  if (showFallback) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Service area centre (city or address)</Label>
          <Input
            type="text"
            value={value.location ?? ""}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
            placeholder={centerPlaceholder}
            className="w-full"
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
              ? "Add VITE_GOOGLE_PLACES_API_KEY to .env to show the map."
              : "Map could not be loaded. Set your location and radius above — form will still work. If you see \"This page can't load Google Maps correctly\" or \"Do you own this website?\", check Google Cloud Console: add your site to HTTP referrers and enable billing for Maps."}
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
      <div className="space-y-2">
        <Label>Service area centre</Label>
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
      {showRadiusAndMap && (
        <>
          <div className="space-y-2">
            <Label>{radiusLabel}: {value.service_radius_km ?? 25} km</Label>
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
          <div ref={mapRef} className="w-full h-64 rounded-lg border border-border bg-muted" />
        </>
      )}
    </div>
  );
}
