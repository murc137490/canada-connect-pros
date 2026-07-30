import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as
  | string
  | undefined;

/** True when Places autocomplete can load (either `VITE_GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_PLACES_API_KEY`). */
export function hasGoogleAddressAutocomplete(): boolean {
  return !!GOOGLE_MAPS_KEY;
}

function whenGooglePlacesReady(apiKey: string): Promise<void> {
  const w = window as Window & { google?: { maps?: { places?: unknown } } };
  if (w.google?.maps?.places) return Promise.resolve();

  const findScript = () =>
    Array.from(document.querySelectorAll("script")).find((s) =>
      (s as HTMLScriptElement).src?.includes("maps.googleapis.com/maps/api/js")
    ) as HTMLScriptElement | undefined;

  const existing = findScript();
  if (existing) {
    return new Promise((resolve, reject) => {
      const win = () => window as Window & { google?: { maps?: { places?: unknown } } };
      let settled = false;
      const finishOk = () => {
        if (settled) return;
        if (win().google?.maps?.places) {
          settled = true;
          resolve();
        }
      };
      const finishLoad = () => {
        if (settled) return;
        if (win().google?.maps?.places) {
          settled = true;
          resolve();
        } else {
          settled = true;
          reject(new Error("Google Maps Places not available"));
        }
      };
      finishOk();
      queueMicrotask(finishOk);
      setTimeout(finishOk, 0);
      existing.addEventListener("load", finishLoad, { once: true });
      existing.addEventListener(
        "error",
        () => {
          if (!settled) {
            settled = true;
            reject(new Error("Google Maps script error"));
          }
        },
        { once: true }
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(script);
  });
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  required?: boolean;
  /** When no Google key: use a multi-line field (default 3). */
  textareaRows?: number;
}

export default function AddressInput({
  value,
  onChange,
  id = "address-input",
  placeholder,
  className,
  autoComplete = "off",
  required,
  textareaRows = 3,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !inputRef.current) return;

    let cancelled = false;

    const initAutocomplete = () => {
      const w = window as Window & {
        google?: {
          maps: {
            places: {
              Autocomplete: new (
                el: HTMLInputElement,
                o: { types?: string[]; componentRestrictions?: { country: string[] }; fields?: string[] }
              ) => {
                getPlace: () => { formatted_address?: string; name?: string };
                addListener: (e: string, fn: () => void) => void;
              };
            };
          };
        };
      };
      if (cancelled || !w.google?.maps?.places || !inputRef.current || initRef.current) return;
      initRef.current = true;
      const autocomplete = new w.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: ["ca"] },
        fields: ["formatted_address", "name", "geometry"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const addr = place.formatted_address ?? place.name ?? "";
        if (addr) onChangeRef.current(addr);
      });
    };

    whenGooglePlacesReady(GOOGLE_MAPS_KEY)
      .then(() => {
        if (!cancelled) initAutocomplete();
      })
      .catch(() => {
        initRef.current = false;
      });

    return () => {
      cancelled = true;
      initRef.current = false;
    };
  }, [GOOGLE_MAPS_KEY]);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete={autoComplete}
        required={required}
        rows={textareaRows}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete={autoComplete}
      required={required}
    />
  );
}
