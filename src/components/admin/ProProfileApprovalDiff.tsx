import type { ProProfileSnapshotDiff } from "@/lib/proProfileApprovalSnapshot";

type Props = {
  diffs: ProProfileSnapshotDiff[];
  locale: "en" | "fr";
  lastEditedAt?: string | null;
};

export default function ProProfileApprovalDiff({ diffs, locale, lastEditedAt }: Props) {
  if (diffs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {locale === "fr"
          ? "Aucune modification depuis la première soumission."
          : "No changes since the original submission."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lastEditedAt ? (
        <p className="text-xs text-muted-foreground">
          {locale === "fr" ? "Dernière modification : " : "Last edited: "}
          {new Date(lastEditedAt).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      ) : null}
      <ul className="space-y-3">
        {diffs.map((d) => (
          <li key={d.field} className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-3 text-sm">
            <p className="font-semibold text-foreground mb-2">{d.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  {locale === "fr" ? "Soumission initiale" : "Original submission"}
                </p>
                <p className="text-muted-foreground whitespace-pre-wrap break-words">{d.before}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  {locale === "fr" ? "Version actuelle" : "Current version"}
                </p>
                <p className="text-foreground whitespace-pre-wrap break-words font-medium">{d.after}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
