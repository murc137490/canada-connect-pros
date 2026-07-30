import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Clock, ExternalLink, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { contentUnavailableLabel, isContentBlocked } from "@/lib/contentModeration";
import StorageDisplayImage from "@/components/StorageDisplayImage";
import ClientAccountSummaryBlock, {
  type ClientAccountSummary,
} from "@/components/admin/ClientAccountSummaryBlock";

const EVIDENCE_BUCKET = "booking-evidence";

type PendingBookingClaim = {
  id: string;
  booking_id: string;
  client_id: string;
  pro_profile_id: string;
  claim_type: string;
  dispute_category: string | null;
  message: string;
  attachment_urls: string[];
  status: string;
  issue_number?: number | null;
  admin_resolution?: string | null;
  created_at: string;
  pro_profiles: { business_name: string | null } | null;
};

type BookingMeta = {
  id: string;
  public_booking_code: string | null;
};

type ClientProfileSummary = ClientAccountSummary;

export default function AdminIssueReports() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const d = t.dashboard;
  const { toast } = useToast();
  const { isPlatformAdmin, ready } = usePlatformAdmin();
  const waitingForAdminProfile = !!user && !ready && !isPlatformAdmin;
  const [claims, setClaims] = useState<PendingBookingClaim[]>([]);
  const [bookingById, setBookingById] = useState<Record<string, BookingMeta>>({});
  const [clientByUserId, setClientByUserId] = useState<Record<string, ClientProfileSummary>>({});
  const [loading, setLoading] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);

  const claimOutcomeLabel = (code: string) => {
    switch (code) {
      case "refunded":
        return d.adminIssueRefunded ?? "Refunded";
      case "job_redone":
        return d.adminIssueJobRedone ?? "Job done again";
      case "resolved":
        return d.adminIssueResolved ?? "Issue resolved";
      default:
        return code;
    }
  };

  const claimTypeLabel = (c: PendingBookingClaim) => {
    if (c.claim_type === "issue") return d.adminIssueTypeIssue ?? "Issue report";
    if (c.claim_type === "payment_problem") return d.adminIssueTypePayment ?? "Payment problem";
    if (c.claim_type === "service_problem") return d.adminIssueTypeService ?? "Service problem";
    if (c.dispute_category) return c.dispute_category.replace(/_/g, " ");
    return c.claim_type;
  };

  useEffect(() => {
    if (!user || !isPlatformAdmin || waitingForAdminProfile) return;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("booking_claim_requests")
        .select(
          "id, booking_id, client_id, pro_profile_id, claim_type, dispute_category, message, attachment_urls, status, issue_number, admin_resolution, created_at, pro_profiles(business_name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        toast({
          title: d.adminIssueLoadError ?? "Could not load issue reports",
          description: error.message,
          variant: "destructive",
        });
        setClaims([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as PendingBookingClaim[];
      setClaims(rows);

      const bookingIds = [...new Set(rows.map((r) => r.booking_id))];
      const clientIds = [...new Set(rows.map((r) => r.client_id))];

      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, public_booking_code")
          .in("id", bookingIds);
        const map: Record<string, BookingMeta> = {};
        (bookings ?? []).forEach((b: BookingMeta) => {
          map[b.id] = b;
        });
        setBookingById(map);
      } else {
        setBookingById({});
      }

      if (clientIds.length > 0) {
        const cmap: Record<string, ClientProfileSummary> = {};
        const { data: summaries, error: sumErr } = await supabase.rpc("admin_client_account_summaries", {
          p_user_ids: clientIds,
        });
        if (!sumErr && summaries?.length) {
          (summaries as ClientProfileSummary[]).forEach((p) => {
            cmap[p.user_id] = p;
          });
        } else {
          const { data: profs } = await supabase
            .from("profiles")
            .select(
              "user_id, full_name, phone, postal_code, address, email_language, birthday, public_user_number",
            )
            .in("user_id", clientIds);
          (profs ?? []).forEach((p: ClientProfileSummary) => {
            cmap[p.user_id] = { ...p, email: null };
          });
        }
        setClientByUserId(cmap);
      } else {
        setClientByUserId({});
      }

      setLoading(false);
    })();
  }, [user, isPlatformAdmin, waitingForAdminProfile, toast, d.adminIssueLoadError]);

  const sortedClaims = useMemo(
    () =>
      [...claims].sort((a, b) => {
        const ad = a.admin_resolution ? 1 : 0;
        const bd = b.admin_resolution ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [claims],
  );

  const handleSetClaimResolution = async (claimId: string, resolution: "refunded" | "job_redone" | "resolved") => {
    if (!user || !isPlatformAdmin) return;
    setUpdatingClaimId(claimId);
    try {
      const { error } = await supabase
        .from("booking_claim_requests")
        .update({ admin_resolution: resolution, status: "reviewed" })
        .eq("id", claimId);
      if (error) throw error;
      toast({ title: d.adminIssueOutcomeSaved ?? "Outcome saved", description: claimOutcomeLabel(resolution) });
      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, admin_resolution: resolution, status: "reviewed" } : c)));
    } catch (e) {
      toast({
        title: d.adminIssueUpdateFailed ?? "Could not update",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUpdatingClaimId(null);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (waitingForAdminProfile) {
    return (
      <Layout>
        <div className="container flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }
  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="container max-w-5xl py-8 px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock size={24} /> {d.adminIssueReportsTitle ?? "Issue reports"}
          </h1>
          <Button asChild variant="outline">
            <Link to="/dashboard?tab=admin">{d.adminBack ?? "Back to admin dashboard"}</Link>
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4 md:p-8 max-h-[calc(100dvh-10rem)] overflow-y-auto">
          <p className="text-muted-foreground text-sm mb-6">
            {d.adminIssueReportsIntro ??
              "Client reports with booking reference, member ID, and account summary (no private verification documents)."}
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={28} />
            </div>
          ) : sortedClaims.length === 0 ? (
            <p className="text-muted-foreground text-sm">{d.adminIssueReportsEmpty ?? "No issue reports yet."}</p>
          ) : (
            <ul className="space-y-4">
              {sortedClaims.map((c) => {
                const open = !c.admin_resolution;
                const booking = bookingById[c.booking_id];
                const client = clientByUserId[c.client_id];
                const msgBlocked = isContentBlocked(c.message);
                return (
                  <li key={c.id} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {open ? (
                        <span className="inline-flex rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-0.5">
                          {d.adminIssueOpen ?? "Open"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2.5 py-0.5">
                          {claimOutcomeLabel(c.admin_resolution ?? "")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-foreground">
                      {(d.adminIssueNumberLine ?? "Issue #{{number}}").replace(
                        "{{number}}",
                        String(c.issue_number ?? "-"),
                      )}{" "}
                      · {claimTypeLabel(c)} · {c.pro_profiles?.business_name ?? "Provider"}
                    </p>

                    <div className="grid gap-1 text-xs font-mono text-muted-foreground break-all sm:grid-cols-2">
                      <p>
                        {d.adminIssueBookingId ?? "Booking ID"}: {c.booking_id}
                      </p>
                      <p>
                        {d.adminIssueBookingRef ?? "Booking ref"}:{" "}
                        {booking?.public_booking_code?.toUpperCase() ?? "-"}
                      </p>
                      <p>
                        {d.accountMemberId ?? "Member ID"}: {client?.public_user_number ?? "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
                        <Link to={`/pros/${c.pro_profile_id}`} target="_blank" rel="noopener noreferrer">
                          {d.adminIssueProPage ?? "Pro page"} <ExternalLink size={12} />
                        </Link>
                      </Button>
                    </div>

                    {client ? <ClientAccountSummaryBlock client={client} /> : null}

                    {msgBlocked ? (
                      <p className="text-sm rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                        {contentUnavailableLabel(locale)} - {d.adminIssueReportHidden ?? "report reason hidden"}
                      </p>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.message}</p>
                    )}

                    {open && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Label className="text-xs text-muted-foreground shrink-0">
                          {d.adminIssueOutcome ?? "Outcome"}
                        </Label>
                        <select
                          className="flex h-9 max-w-xs rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                          defaultValue=""
                          disabled={updatingClaimId === c.id}
                          onChange={(e) => {
                            const v = e.target.value as "" | "refunded" | "job_redone" | "resolved";
                            if (v) void handleSetClaimResolution(c.id, v);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            {d.adminIssueChooseOutcome ?? "Choose outcome…"}
                          </option>
                          <option value="refunded">{d.adminIssueRefunded ?? "Refunded"}</option>
                          <option value="job_redone">{d.adminIssueJobRedone ?? "Job done again"}</option>
                          <option value="resolved">{d.adminIssueResolved ?? "Issue resolved"}</option>
                        </select>
                        {updatingClaimId === c.id && <Loader2 className="animate-spin size-4 text-muted-foreground" />}
                      </div>
                    )}

                    {Array.isArray(c.attachment_urls) && c.attachment_urls.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {(d.adminIssuePictures ?? "Pictures ({{count}})").replace(
                            "{{count}}",
                            String(c.attachment_urls.length),
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {c.attachment_urls.map((href) =>
                            isContentBlocked(href) ? (
                              <div
                                key={href}
                                className="h-20 w-20 rounded-md border bg-muted flex items-center justify-center text-[10px] text-center p-1 text-muted-foreground"
                              >
                                {contentUnavailableLabel(locale)}
                              </div>
                            ) : (
                              <a
                                key={href}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-20 w-20 rounded-md border overflow-hidden"
                              >
                                <StorageDisplayImage
                                  bucket={EVIDENCE_BUCKET}
                                  url={href}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </a>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
