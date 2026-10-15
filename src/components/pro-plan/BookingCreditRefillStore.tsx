import { useCallback, useEffect, useState } from "react";
import { CreditCard as CreditCardIcon, Loader2 } from "lucide-react";
import { ApplePay, CreditCard, GooglePay, PaymentForm } from "react-square-web-payments-sdk";
import { ApplePayWalletSlot } from "@/components/ApplePayWalletSlot";
import { GooglePayWalletSlot } from "@/components/GooglePayWalletSlot";
import { untypedDb } from "@/lib/untypedSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { resolveSquareWebConfig } from "@/lib/squareWebConfig";
import { BOOKING_CREDIT_REFILLS } from "@/lib/bookingCredits";
import { ensureApplePaySdkLoadedSoon } from "@/lib/applePaySdk";

type Tier = keyof typeof BOOKING_CREDIT_REFILLS;
const style = { input: { backgroundColor: "#e5e7eb", color: "#171717", fontSize: "16px" }, ".input-container": { borderColor: "#9ca3af", borderRadius: "6px", borderWidth: "1px" }, ".input-container.is-focus": { borderColor: "#2563eb" } } as const;

export default function BookingCreditRefillStore() {
  const { user } = useAuth(); const { locale } = useLanguage(); const { toast } = useToast(); const fr = locale === "fr";
  const [pro, setPro] = useState<{ id: string; tier: Tier } | null>(null); const [prices, setPrices] = useState<Record<number, number>>({}); const [config, setConfig] = useState<{ applicationId: string; locationId: string } | null>(null); const [selected, setSelected] = useState<number | null>(null); const [requestKey, setRequestKey] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; void (async () => { const walletSdkReady = ensureApplePaySdkLoadedSoon(); const cfg = await resolveSquareWebConfig(); await walletSdkReady; if (alive) setConfig(cfg); if (!user?.id) return; const [{ data: profile }, { data: sub }, { data: catalog }] = await Promise.all([untypedDb.from("pro_profiles").select("id,subscription_tier").eq("user_id", user.id).maybeSingle(), untypedDb.from("pro_subscriptions").select("plan_id").eq("user_id", user.id).maybeSingle(), untypedDb.from("booking_credit_refill_prices").select("plan_id,credit_amount,price_cents")]); const tierRaw = String(sub?.plan_id ?? profile?.subscription_tier ?? "").toLowerCase(); if (alive && profile && ["starter","growth","pro"].includes(tierRaw)) { setPro({ id: profile.id, tier: tierRaw as Tier }); const planCatalog = (catalog ?? []).filter((x: { plan_id: string }) => x.plan_id === tierRaw); const map: Record<number,number> = {}; for (const pack of BOOKING_CREDIT_REFILLS[tierRaw as Tier]) { const row = planCatalog.find((x: { credit_amount: number }) => Number(x.credit_amount) === pack.credits); map[pack.credits] = row?.price_cents == null ? pack.priceCents : Number(row.price_cents); } setPrices(map); } })(); return () => { alive = false; }; }, [user?.id]);
  const packs = pro ? BOOKING_CREDIT_REFILLS[pro.tier] : [];
  const selectedPrice = pro && selected ? prices[selected] ?? packs.find((pack) => pack.credits === selected)?.priceCents ?? 0 : 0;
  const createPaymentRequest = useCallback(() => ({
    countryCode: "CA",
    currencyCode: "CAD",
    supportedNetworks: ["visa", "masterCard", "amex", "discover", "interac"],
    merchantCapabilities: ["supports3DS"],
    total: { amount: (selectedPrice / 100).toFixed(2), label: "AltShift Booking Credits" },
  }), [selectedPrice]);
  if (!pro) return null;
  const buy = async (token: { status?: string; token?: string; errors?: unknown }) => { if (token.status !== "OK" || !token.token || !selected || !requestKey) { if (token.status && token.status !== "OK") toast({ title: fr ? "Paiement non autorisé" : "Payment not authorized", description: token.errors ? JSON.stringify(token.errors) : undefined, variant: "destructive" }); return; } setBusy(true); const { data, error } = await supabase.functions.invoke("booking-credit-refill-checkout", { body: { pro_profile_id: pro.id, credit_amount: selected, source_id: token.token, idempotency_key: requestKey } }); setBusy(false); if (error || data?.error) { toast({ title: fr ? "Recharge impossible" : "Refill failed", description: data?.error ?? error?.message, variant: "destructive" }); return; } toast({ title: fr ? "Crédits ajoutés" : "Credits added", description: fr ? `${selected} crédits ajoutés à votre solde.` : `${selected} credits were added to your balance.` }); setSelected(null); setRequestKey(""); window.dispatchEvent(new Event("booking-credits-updated")); };
  return <section className="mx-auto mt-16 max-w-5xl rounded-2xl border bg-card p-5 sm:p-7">
    <div className="mb-5"><h3 className="text-xl font-bold">{fr ? "Recharger les Booking Credits" : "Refill Booking Credits"}</h3><p className="mt-1 text-sm text-muted-foreground">{fr ? `Tarifs ${pro.tier === "pro" ? "Pro" : pro.tier === "growth" ? "Growth" : "Starter"}. Le prix applicable est confirmé au paiement.` : `${pro.tier[0].toUpperCase()}${pro.tier.slice(1)} pricing. The final amount is confirmed at checkout.`}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{packs.map((pack) => <button key={pack.credits} type="button" onClick={() => { setSelected(pack.credits); setRequestKey(crypto.randomUUID()); }} className={`rounded-xl border p-4 text-left transition-colors ${selected === pack.credits ? "border-primary ring-2 ring-primary/25" : "hover:border-primary/50"}`}><span className="flex items-center justify-between gap-2"><b className="text-lg">{pack.credits} <span className="text-sm font-medium text-muted-foreground">{fr ? "crédits" : "Booking Credits"}</span></b><span className="font-semibold">CA${((prices[pack.credits] ?? pack.priceCents) / 100).toFixed(2)}</span></span><span className="mt-1 block text-xs text-muted-foreground">CA${(((prices[pack.credits] ?? pack.priceCents) / 100) / pack.credits).toFixed(2)} / {fr ? "crédit" : "credit"}</span></button>)}</div>
    {selected && config ? <div className="mt-5 rounded-xl border bg-background p-4 text-foreground">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><CreditCardIcon className="size-4" />{fr ? "Mode de paiement" : "Payment method"}<span className="ml-auto tabular-nums">CA${(selectedPrice / 100).toFixed(2)}</span></p>
      <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-4 text-neutral-900 [color-scheme:light] dark:border-neutral-600" style={{ colorScheme: "light" }}>
        <PaymentForm applicationId={config.applicationId} locationId={config.locationId} createPaymentRequest={createPaymentRequest} cardTokenizeResponseReceived={(token) => void buy(token as { status?: string; token?: string; errors?: unknown })}>
          <div className="space-y-4">
            <div className="grid min-w-0 grid-cols-2 gap-2.5">
              <ApplePayWalletSlot className="h-12 min-h-12 min-w-0 overflow-hidden rounded-[4px]" unavailableLabel={fr ? "Apple Pay est disponible sur les appareils et navigateurs compatibles." : "Apple Pay is available on compatible devices and browsers."}>
                <div className="h-12 min-h-12 min-w-0"><ApplePay id="booking-credit-apple-pay" /></div>
              </ApplePayWalletSlot>
              <GooglePayWalletSlot>
                <GooglePay id="booking-credit-google-pay" buttonSizeMode="fill" buttonType="plain" buttonColor="black" />
              </GooglePayWalletSlot>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-neutral-700">{fr ? "Carte de crédit ou de débit" : "Credit or debit card"}</p>
              <CreditCard style={style} buttonProps={{ children: fr ? "Confirmer la recharge" : "Confirm refill" }} />
            </div>
          </div>
        </PaymentForm>
      </div>
      {busy ? <div className="mt-3 flex items-center gap-2 text-sm text-foreground"><Loader2 className="size-4 animate-spin" />{fr ? "Paiement en cours…" : "Processing payment…"}</div> : null}
    </div> : selected && !config ? <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{fr ? "Le paiement par carte est temporairement indisponible." : "Card checkout is temporarily unavailable."}</p> : null}
  </section>;
}
