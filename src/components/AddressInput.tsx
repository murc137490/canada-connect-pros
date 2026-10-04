import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { suggestAddresses, type AddressHit } from "@/lib/addressSuggestions";

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as
  | string
  | undefined;

/** True when a browser Maps key was provided at build time. Suggestions still work without it. */
export function hasGoogleAddressAutocomplete(): boolean {
  return !!GOOGLE_MAPS_KEY;
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
}: AddressInputProps) {
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setHits([]);
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(() => {
      void suggestAddresses(q).then((rows) => {
        if (requestRef.current !== requestId) return;
        setHits(rows);
        setOpen(rows.length > 0);
      });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => hits.length && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete={autoComplete}
        required={required}
        aria-autocomplete="list"
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background shadow-lg" role="listbox">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng},${hit.label}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(hit.label);
                  setOpen(false);
                }}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
