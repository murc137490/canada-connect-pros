import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}

export default function AddressInput({
  value,
  onChange,
  id = "address-input",
  placeholder,
  className,
  autoComplete = "off",
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!GOOGLE_PLACES_KEY || !inputRef.current) return;

    const initAutocomplete = () => {
      const w = window as Window & { google?: { maps: { places: { Autocomplete: new (el: HTMLInputElement, o: { types?: string[]; componentRestrictions?: { country: string[] }; fields?: string[] }) => { getPlace: () => { formatted_address?: string; name?: string }; addListener: (e: string, fn: () => void) => void } } } } };
      if (!w.google?.maps?.places || !inputRef.current || initRef.current) return;
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

    if ((window as Window & { google?: unknown }).google?.maps?.places) {
      initAutocomplete();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => initAutocomplete();
    script.onerror = () => { initRef.current = false; };
    document.head.appendChild(script);
    return () => {
      script.remove();
      initRef.current = false;
    };
  }, [GOOGLE_PLACES_KEY]);

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
    />
  );
}
