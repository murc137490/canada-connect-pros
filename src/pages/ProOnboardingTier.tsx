import { Navigate, useSearchParams } from "react-router-dom";

/** Legacy route: tier selection was removed; send users straight to profile setup. */
export default function ProOnboardingTier() {
  const [searchParams] = useSearchParams();
  const promo = searchParams.get("promo_code")?.trim();
  const qs = new URLSearchParams();
  qs.set("onboarding", "1");
  if (promo) qs.set("promo_code", promo);
  return <Navigate to={`/create-pro-account?${qs.toString()}`} replace />;
}
