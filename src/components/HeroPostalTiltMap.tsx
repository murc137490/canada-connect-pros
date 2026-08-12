import { useEffect, useRef, useState } from "react";
import { whenGoogleMapsReady, triggerMapResize } from "@/lib/loadGoogleMapsJs";
import { cn } from "@/lib/utils";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;

type Props = {
  lat: number;
  lng: number;
  className?: string;
};

type GoogleMapInstance = {
  setCenter: (c: { lat: number; lng: number }) => void;
  setTilt: (t: number) => void;
  setHeading: (h: number) => void;
  setZoom: (z: number) => void;
};

type GoogleMapsWindow = {
  google?: {
    maps?: {
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
      Marker: new (opts: Record<string, unknown>) => {
        setPosition: (c: { lat: number; lng: number }) => void;
      };
    };
  };
};

/** Flat rectangular map: satellite bird’s-eye (top-down), no camera tilt. */
export default function HeroPostalTiltMap({ lat, lng, className }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<{ setPosition: (c: { lat: number; lng: number }) => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!API_KEY || !mapRef.current) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    const run = async () => {
      try {
        await whenGoogleMapsReady(API_KEY);
        if (cancelled || !mapRef.current) return;

        const g = (window as unknown as GoogleMapsWindow).google;
        if (!g?.maps?.Map) throw new Error("Maps unavailable");

        const center = { lat, lng };

        if (!mapInstanceRef.current) {
          const map = new g.maps.Map(mapRef.current, {
            center,
            zoom: 16,
            mapTypeId: "hybrid",
            tilt: 0,
            heading: 0,
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "cooperative",
            rotateControl: false,
          });
          mapInstanceRef.current = map;
          markerRef.current = new g.maps.Marker({
            map,
            position: center,
          });
        } else {
          mapInstanceRef.current.setCenter(center);
          mapInstanceRef.current.setZoom(16);
          mapInstanceRef.current.setTilt(0);
          mapInstanceRef.current.setHeading(0);
          markerRef.current?.setPosition(center);
        }

        resizeObserver = new ResizeObserver(() => {
          triggerMapResize(mapInstanceRef.current);
        });
        resizeObserver.observe(mapRef.current);

        requestAnimationFrame(() => {
          triggerMapResize(mapInstanceRef.current);
          mapInstanceRef.current?.setTilt(0);
        });
        setFailed(false);
      } catch (err) {
        console.warn("Hero postal map failed:", err);
        if (!cancelled) setFailed(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [lat, lng]);

  const embedFallback = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&t=k&output=embed`;

  return (
    <div
      className={cn(
        "relative h-[160px] w-full overflow-hidden rounded-xl border border-border/80 bg-muted sm:h-[180px] dark:border-white/15",
        className
      )}
    >
      {failed || !API_KEY ? (
        <iframe
          title="Map"
          src={embedFallback}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div ref={mapRef} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
