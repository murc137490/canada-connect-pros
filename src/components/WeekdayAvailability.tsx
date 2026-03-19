import { useLanguage } from "@/contexts/LanguageContext";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/i18n/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type DayAvailability = {
  available: boolean;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
};

export type AvailabilityState = Record<WeekdayKey, DayAvailability>;

const defaultDay: DayAvailability = { available: false, morning: false, afternoon: false, evening: false };

export function defaultAvailability(): AvailabilityState {
  return WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = { ...defaultDay };
    return acc;
  }, {} as AvailabilityState);
}

/** Serialize to string for DB (e.g. JSON or human-readable). */
export function availabilityToStorage(state: AvailabilityState): string {
  return JSON.stringify(state);
}

export function parseAvailabilityFromStorage(s: string | null): AvailabilityState | null {
  if (!s?.trim()) return null;
  try {
    const parsed = JSON.parse(s) as AvailabilityState;
    if (WEEKDAY_KEYS.every((k) => parsed[k] != null)) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

const weekdayLabels: Record<WeekdayKey, keyof typeof import("@/i18n/translations").translations.en.createPro> = {
  mon: "weekdayMon",
  tue: "weekdayTue",
  wed: "weekdayWed",
  thu: "weekdayThu",
  fri: "weekdayFri",
  sat: "weekdaySat",
  sun: "weekdaySun",
};

interface WeekdayAvailabilityProps {
  value: AvailabilityState;
  onChange: (value: AvailabilityState) => void;
}

export default function WeekdayAvailability({ value, onChange }: WeekdayAvailabilityProps) {
  const { t } = useLanguage();

  const update = (key: WeekdayKey, patch: Partial<DayAvailability>) => {
    onChange({
      ...value,
      [key]: { ...value[key], ...patch },
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="space-y-2 min-w-0">
            <Label className="text-sm font-medium">
              {t.createPro[weekdayLabels[key]]}
            </Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={value[key].available}
                  onCheckedChange={(v) => update(key, { available: v === true })}
                />
                <span className="text-xs text-muted-foreground">{t.createPro.availableLabel}</span>
              </label>
              {value[key].available && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={value[key].morning}
                      onCheckedChange={(v) => update(key, { morning: v === true })}
                    />
                    <span className="text-xs">{t.createPro.timeMorning}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={value[key].afternoon}
                      onCheckedChange={(v) => update(key, { afternoon: v === true })}
                    />
                    <span className="text-xs">{t.createPro.timeAfternoon}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={value[key].evening}
                      onCheckedChange={(v) => update(key, { evening: v === true })}
                    />
                    <span className="text-xs">{t.createPro.timeEvening}</span>
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
