import { useLanguage } from "@/contexts/LanguageContext";
import { formatCanadianPostal } from "@/lib/canadianPostal";

export type ClientAccountSummary = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  postal_code: string | null;
  address: string | null;
  email_language: string | null;
  birthday: string | null;
  public_user_number: string | null;
  email?: string | null;
};

type Props = {
  client: ClientAccountSummary;
};

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function ClientAccountSummaryBlock({ client }: Props) {
  const { t } = useLanguage();
  const d = t.dashboard;
  const auth = t.auth;
  const lang =
    client.email_language === "fr" ? "Français" : client.email_language === "en" ? "English" : "-";
  const birthday = client.birthday
    ? new Date(`${client.birthday}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "long" })
    : "-";
  const postal = client.postal_code?.trim() ? formatCanadianPostal(client.postal_code) : "-";

  return (
    <div className="rounded-md border border-border/60 bg-background/80 p-4 space-y-4">
      <p className="font-heading font-semibold text-foreground text-sm">{d.accountDetailsTitle}</p>
      <Field label={d.accountName} value={client.full_name?.trim() || "-"} />
      <Field label={d.accountPhone} value={client.phone?.trim() || "-"} />
      <Field label={d.accountPostalCode} value={postal} hint={d.accountPostalHint} />
      <Field label={d.accountAddress} value={client.address?.trim() || "-"} />
      <Field label={d.accountEmail} value={client.email?.trim() || "-"} hint={d.accountEmailHint} />
      <Field label={auth.emailLanguageLabel} value={lang} hint={d.accountEmailLanguageHint} />
      <Field label={d.accountBirthday} value={birthday} />
      <p className="text-sm text-foreground font-mono">
        <span className="font-medium font-sans">{d.accountMemberId}: </span>
        {client.public_user_number ?? "-"}
      </p>
    </div>
  );
}
