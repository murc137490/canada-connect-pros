/** Fired after a successful paid plan checkout so shell UI (e.g. nav) can update without a full reload. */
export const PRO_PLAN_PAID_EVENT = "premiere-pro-plan-paid";

export function dispatchProPlanPaidEvent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PRO_PLAN_PAID_EVENT));
}
