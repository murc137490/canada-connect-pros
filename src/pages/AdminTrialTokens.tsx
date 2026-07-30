import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Copy, Loader2, Ticket } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { generateTrialTokens, listTrialTokens, type TrialTokenAdminRow, type TrialTokenAdminResponse } from "@/lib/trialCheckout";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

function formatCreated(value: string | undefined, locale: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminTrialTokens() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const d = t.dashboard;
  const { toast } = useToast();
  const { isPlatformAdmin, ready } = usePlatformAdmin();
  const waitingForAdminProfile = !!user && !ready && !isPlatformAdmin;
  const [rows, setRows] = useState<TrialTokenAdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadTokens = async () => {
    if (!user || !isPlatformAdmin || waitingForAdminProfile) return;
    setLoading(true);
    try {
      const { data, error } = await listTrialTokens();
      if (error) throw error;
      setRows((data?.active ?? []) as TrialTokenAdminRow[]);
    } catch (e) {
      toast({
        title: d.adminTrialLoadError ?? "Could not load trial links",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPlatformAdmin, waitingForAdminProfile]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await generateTrialTokens();
      if (error) throw error;
      setRows((data?.active ?? []) as TrialTokenAdminRow[]);
      const gen = (data as TrialTokenAdminResponse | null)?.generated?.[0];
      if (gen?.url) {
        await navigator.clipboard.writeText(gen.url);
        toast({
          title: d.adminTrialGeneratedTitle ?? "Trial link generated",
          description:
            d.adminTrialGeneratedCopied ??
            "Copied to clipboard. Unclaimed links stay in the table until someone uses them.",
        });
      } else {
        toast({
          title: d.adminTrialGeneratedTitle ?? "Trial link generated",
          description:
            d.adminTrialGeneratedReady ??
            "A new one-use personal trial link is ready - use Copy on its row.",
        });
      }
    } catch (e) {
      toast({
        title: d.adminTrialGenerateError ?? "Could not generate links",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyUrl = async (url?: string) => {
    if (!url) {
      toast({
        title: d.adminTrialLinkUnavailable ?? "Link unavailable",
        description:
          d.adminTrialLinkUnavailableDesc ??
          "This invite was already claimed or has no recoverable URL.",
        variant: "destructive",
      });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: d.adminTrialCopied ?? "Copied trial link" });
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
      <div className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading flex items-center gap-2 text-2xl font-bold text-foreground">
            <Ticket size={24} /> {d.adminTrialPageTitle ?? "Personal trial links"}
          </h1>
          <Button asChild variant="outline">
            <Link to="/dashboard?tab=admin">{d.adminBack ?? "Back to admin dashboard"}</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{d.adminTrialPageCardTitle ?? "2-month Growth trial links"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {d.adminTrialPageIntro ??
                "Generate a new one-use personal link for a 2-month Growth trial. Links are stored in the database: unclaimed rows stay until someone completes checkout; claimed rows remain so you can see who used each invite."}
            </p>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
              {d.adminTrialPageOnceNote ??
                "Each link works once. After it is claimed, the URL is cleared server-side - use the table below to see status and account email. Copy is only available for unclaimed invites."}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : null}
                {d.adminTrialGenerateCopy ?? "Generate & copy new link"}
              </Button>
              <Button variant="outline" onClick={loadTokens} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {d.adminTrialRefresh ?? "Refresh from server"}
              </Button>
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {d.adminTrialInvitesHeading ?? "Trial invites"}
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {d.adminTrialEmpty ?? "No trial invites yet. Generate one to create the first row."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">{d.adminTrialColStatus ?? "Status"}</th>
                        <th className="py-2 text-left font-medium">{d.adminTrialColTrial ?? "Trial"}</th>
                        <th className="py-2 text-left font-medium">{d.adminTrialColCreated ?? "Created"}</th>
                        <th className="py-2 text-left font-medium">{d.adminTrialColClaimed ?? "Claimed"}</th>
                        <th className="py-2 text-left font-medium">{d.adminTrialColAccount ?? "Account"}</th>
                        <th className="py-2 text-left font-medium">{d.adminTrialColCopy ?? "Copy link"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => {
                        const claimed = item.status === "claimed" || !!item.used_at;
                        return (
                          <tr key={item.id} className="border-b border-border/50">
                            <td className="py-2">
                              {claimed ? (
                                <span className="text-muted-foreground">{d.adminTrialClaimed ?? "Claimed"}</span>
                              ) : (
                                <span className="font-medium text-green-700 dark:text-green-400">
                                  {d.adminTrialUnclaimed ?? "Unclaimed"}
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              {item.duration_days === 60
                                ? (d.adminTrialTwoMonths ?? "2 months")
                                : (d.adminTrialDays ?? "{{days}} days").replace(
                                    "{{days}}",
                                    String(item.duration_days),
                                  )}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {formatCreated(item.created_at, locale)}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {claimed ? formatCreated(item.used_at ?? undefined, locale) : "-"}
                            </td>
                            <td className="py-2">
                              {claimed ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-foreground">{item.claimed_by_email ?? "-"}</span>
                                  {item.claimed_by_public_user_number ? (
                                    <span className="text-xs text-muted-foreground">
                                      {(d.adminTrialMemberHash ?? "Member #{{number}}").replace(
                                        "{{number}}",
                                        String(item.claimed_by_public_user_number),
                                      )}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground"> - </span>
                              )}
                            </td>
                            <td className="py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!item.url}
                                onClick={() => void copyUrl(item.url)}
                              >
                                <Copy className="size-4" /> {d.adminTrialCopy ?? "Copy"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
