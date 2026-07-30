import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Megaphone, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  createPlatformWhatsNewAnnouncement,
  deletePlatformWhatsNewAnnouncement,
  fetchAdminPlatformWhatsNewAnnouncements,
  type PlatformWhatsNewRow,
} from "@/lib/fetchPlatformWhatsNewAnnouncements";
import { WHATS_NEW_CHANGED_EVENT } from "@/lib/whatsNewFeed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  contrastDialogContentClass,
  contrastDialogDescriptionClass,
  contrastDialogTitleClass,
} from "@/lib/dialogContrast";

type Props = {
  onChanged: () => void;
};

function notifyWhatsNewChanged() {
  window.dispatchEvent(new Event(WHATS_NEW_CHANGED_EVENT));
}

export default function WhatsNewAdminPanel({ onChanged }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("/dashboard");
  const [publishing, setPublishing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rows, setRows] = useState<PlatformWhatsNewRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    try {
      const data = await fetchAdminPlatformWhatsNewAnnouncements();
      setRows(data);
    } catch (e) {
      toast({
        title: t.auth?.toastError ?? "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingRows(false);
    }
  }, [t.auth?.toastError, toast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const publish = async () => {
    if (!user?.id || !title.trim()) return;
    setPublishing(true);
    try {
      await createPlatformWhatsNewAnnouncement({
        title,
        body,
        href,
        createdBy: user.id,
      });
      setTitle("");
      setBody("");
      setHref("/dashboard");
      setConfirmOpen(false);
      toast({
        title: t.dashboard.whatsNewAdminPublished ?? "Notification published",
        description: t.dashboard.whatsNewAdminPublishedDesc ?? "It will appear for every account for up to 7 days.",
      });
      await loadRows();
      onChanged();
      notifyWhatsNewChanged();
    } catch (e) {
      toast({
        title: t.auth?.toastError ?? "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t.dashboard.whatsNewAdminDeleteConfirm ?? "Remove this notification for all users?")) return;
    setDeletingId(id);
    try {
      await deletePlatformWhatsNewAnnouncement(id);
      toast({ title: t.dashboard.whatsNewAdminDeleted ?? "Notification removed" });
      await loadRows();
      onChanged();
      notifyWhatsNewChanged();
    } catch (e) {
      toast({
        title: t.auth?.toastError ?? "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="border-t border-border/80 bg-muted/30 px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Megaphone size={14} />
        {t.dashboard.whatsNewAdminHeading ?? "Admin broadcast"}
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 flex gap-2 text-xs text-amber-950 dark:text-amber-100">
        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p>
          {t.dashboard.whatsNewAdminWarning ??
            "This will appear in What's new for every existing account for the next 7 days (or until they mark it read)."}
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <Label htmlFor="wn-admin-title" className="text-xs">
            {t.dashboard.whatsNewAdminTitleLabel ?? "Title"}
          </Label>
          <Input
            id="wn-admin-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="mt-1 h-8 text-sm"
            placeholder={t.dashboard.whatsNewAdminTitlePlaceholder ?? "e.g. Holiday schedule"}
          />
        </div>
        <div>
          <Label htmlFor="wn-admin-body" className="text-xs">
            {t.dashboard.whatsNewAdminBodyLabel ?? "Message"}
          </Label>
          <Textarea
            id="wn-admin-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1 text-sm resize-none"
            placeholder={t.dashboard.whatsNewAdminBodyPlaceholder ?? "Short message for all users"}
          />
        </div>
        <div>
          <Label htmlFor="wn-admin-href" className="text-xs">
            {t.dashboard.whatsNewAdminLinkLabel ?? "Link (optional)"}
          </Label>
          <Input
            id="wn-admin-href"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            className="mt-1 h-8 text-sm"
            placeholder="/dashboard"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!title.trim() || publishing}
          onClick={() => setConfirmOpen(true)}
        >
          {publishing ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          {t.dashboard.whatsNewAdminPublish ?? "Publish to all accounts"}
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          {t.dashboard.whatsNewAdminActiveList ?? "Active broadcasts"}
        </p>
        {loadingRows ? (
          <div className="flex justify-center py-3">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.dashboard.whatsNewAdminNone ?? "No active broadcasts."}</p>
        ) : (
          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground line-clamp-1">{row.title}</p>
                  {row.body ? <p className="text-muted-foreground line-clamp-1">{row.body}</p> : null}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(row.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  disabled={deletingId === row.id}
                  onClick={() => void remove(row.id)}
                  aria-label={t.common.delete ?? "Delete"}
                >
                  {deletingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={contrastDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle className={contrastDialogTitleClass}>
              {t.dashboard.whatsNewAdminConfirmTitle ?? "Publish to everyone?"}
            </AlertDialogTitle>
            <AlertDialogDescription className={contrastDialogDescriptionClass}>
              {t.dashboard.whatsNewAdminConfirmBody ??
                "This notification will be shown in What's new on every existing account for up to 7 days (until each user reads it or it expires)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={publishing} onClick={() => void publish()}>
              {t.dashboard.whatsNewAdminConfirmPublish ?? "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

