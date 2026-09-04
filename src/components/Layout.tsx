import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Menu, X, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AnimatedThemeToggler from "@/components/AnimatedThemeToggler";
import CookieConsent from "@/components/CookieConsent";
import HelpFab from "@/components/HelpFab";
import UserMenuDropdown from "@/components/UserMenuDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { getAllServices } from "@/data/services";
import { shouldShowJoinPros, useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";
import { getServiceName } from "@/i18n/serviceTranslations";
import { FOOTER_POPULAR_SERVICE_FALLBACK } from "@/lib/footerPopularServices";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { isSuperAdminEmail } from "@/lib/platformAdmin";
import WhatsNewMenu from "@/components/WhatsNewMenu";
import { useWhatsNew } from "@/contexts/WhatsNewContext";
import { MOTION } from "@/motion/types";

const SCROLL_COMPACT = 24;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();
  const { count: notificationCount } = useNotifications();

  const allServicesCatalog = useMemo(() => getAllServices(), []);

  const [popularFooterLinks, setPopularFooterLinks] = useState<{ to: string; label: string }[]>(() => {
    const all = getAllServices();
    return FOOTER_POPULAR_SERVICE_FALLBACK.map((f) => ({
      to: `/services/${f.category_slug}/${f.service_slug}/pros`,
      label: getServiceName(
        f.service_slug,
        locale,
        all.find((s) => s.categorySlug === f.category_slug && s.slug === f.service_slug)?.name
      ),
    }));
  });

  useEffect(() => {
    let cancelled = false;
    const label = (cat: string, slug: string) => {
      const row = allServicesCatalog.find((s) => s.categorySlug === cat && s.slug === slug);
      return getServiceName(slug, locale, row?.name);
    };
    const toLinks = (rows: { category_slug: string; service_slug: string }[]) =>
      rows.slice(0, 4).map((r) => ({
        to: `/services/${r.category_slug}/${r.service_slug}/pros`,
        label: label(r.category_slug, r.service_slug),
      }));

    const ensureFour = (fromDb: { category_slug: string; service_slug: string }[]) => {
      const merged = [...fromDb];
      const seen = new Set(merged.map((r) => `${r.category_slug}/${r.service_slug}`));
      for (const f of FOOTER_POPULAR_SERVICE_FALLBACK) {
        if (merged.length >= 4) break;
        const k = `${f.category_slug}/${f.service_slug}`;
        if (seen.has(k)) continue;
        merged.push({ category_slug: f.category_slug, service_slug: f.service_slug });
        seen.add(k);
      }
      return merged.slice(0, 4);
    };

    const fallbackRows = FOOTER_POPULAR_SERVICE_FALLBACK.map((f) => ({
      category_slug: f.category_slug,
      service_slug: f.service_slug,
    }));
    setPopularFooterLinks(toLinks(fallbackRows));

    void (async () => {
      const { data, error } = await supabase.rpc("get_top_services_by_browse", { p_limit: 4 });
      const fromDb =
        !error && Array.isArray(data)
          ? (data as { category_slug: string; service_slug: string }[]).map((r) => ({
              category_slug: r.category_slug,
              service_slug: r.service_slug,
            }))
          : [];
      if (!cancelled) setPopularFooterLinks(toLinks(ensureFour(fromDb)));
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, allServicesCatalog]);

  const { activeVerifiedPro, ready: activeVerifiedProReady } = useActiveVerifiedPro(user?.id);
  const [proProfileVerified, setProProfileVerified] = useState(false);
  useEffect(() => {
    if (!user) {
      setProProfileVerified(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("pro_profiles")
        .select("id, is_verified")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setProProfileVerified(!!data?.is_verified);
      try {
        localStorage.setItem(`proProfile:${user.id}`, (!!data).toString());
      } catch {
        // ignore
      }
    })();
  }, [user, activeVerifiedPro]);

  const isHome = location.pathname === "/";
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_COMPACT);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { isPlatformAdmin } = usePlatformAdmin();
  const { items: whatsNewItems } = useWhatsNew();

  /** Prefer profiles.full_name (source of truth) over possibly stale auth metadata. */
  const [profileFullName, setProfileFullName] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) {
      setProfileFullName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProfileFullName(data?.full_name?.trim() || null);
    })();
    const onProfileUpdated = (event: Event) => {
      const name = (event as CustomEvent<{ full_name?: string }>).detail?.full_name;
      if (typeof name === "string") setProfileFullName(name.trim() || null);
    };
    window.addEventListener("premiere:profile-updated", onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("premiere:profile-updated", onProfileUpdated);
    };
  }, [user?.id]);

  const showJoinPros =
    !isPlatformAdmin && shouldShowJoinPros(user?.id, activeVerifiedPro, activeVerifiedProReady);
  const navLinks = [
    { label: t.nav.services, href: "/services" },
    { label: t.nav.howItWorks, href: "/#how-it-works" },
    ...(showJoinPros ? [{ label: t.nav.joinPros, href: "/join-pros" }] : []),
  ];

  const fullName =
    (profileFullName || (user?.user_metadata?.full_name as string | undefined) || "").trim() || "";
  const dashboardLabel = isPlatformAdmin
    ? (locale === "fr" ? "Admin" : "Admin")
    : fullName
      ? fullName.split(/\s+/)[0] || t.nav.dashboardShort
      : t.nav.dashboardShort;
  const isProProfilePage = /^\/pro\/[^/]+$/.test(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const langBtn =
    "border-border/70 bg-background/85 text-foreground hover:bg-muted/70 active:bg-muted focus-visible:bg-muted/70 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15";
  const themeBtn =
    "border-border/70 bg-background/85 text-foreground hover:bg-muted/70 active:bg-muted focus-visible:bg-muted/70 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 [&_svg]:dark:text-white";
  const accountTrigger =
    "!border !border-border/70 !bg-background/85 !text-foreground hover:!bg-muted/70 active:!bg-muted focus-visible:!bg-muted/70 hover:!opacity-100 dark:!border-white/15 dark:!bg-white/10 dark:!text-white dark:hover:!bg-white/15 max-md:!min-w-0 max-md:!px-2";

  const menuItems = isPlatformAdmin
    ? [
        { label: t.dashboard.admin, link: "/dashboard?tab=admin", emoji: "🛡️", show: true },
        {
          label: locale === "fr" ? "Comptes admins" : "Admin accounts",
          link: "/dashboard?tab=staff",
          emoji: "👥",
          show: isSuperAdminEmail(user?.email),
        },
        { label: t.dashboard.myAccount, link: "/dashboard?tab=account", emoji: "👤", show: true },
      ]
    : [
        { label: t.dashboard.myAccount, link: "/dashboard?tab=account", emoji: "👤", show: true },
        { label: t.dashboard.proProfile, link: "/dashboard?tab=pro", emoji: "💼", show: proProfileVerified },
        {
          label: t.dashboard.bookings,
          link: "/dashboard?tab=bookings",
          emoji: "📅",
          show: true,
          badge: notificationCount > 0 ? notificationCount : undefined,
        },
        { label: t.dashboard.favorites, link: "/dashboard?tab=favorites", emoji: "❤️", show: true },
        { label: t.dashboard.reviews, link: "/dashboard?tab=reviews", emoji: "⭐", show: true },
        { label: t.dashboard.invoices, link: "/dashboard?tab=invoices", emoji: "📄", show: true },
        { label: t.dashboard.admin, link: "/dashboard?tab=admin", emoji: "🛡️", show: false },
      ];

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-none flex-col m-0 p-0">
      {!isProProfilePage && (
      <header
        className={`fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,0px)] transition-all duration-300 site-header ${
          scrolled ? "site-header--compact" : ""
        }`}
      >
        <div className={`container-page flex items-center gap-3 transition-all duration-300 ${scrolled ? "h-12" : "h-14"}`}>
          <Link
            to="/"
            className="min-w-0 shrink font-heading text-sm sm:text-[15px] font-extrabold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            aria-label="Premiere Services – Home"
          >
            <span className="block truncate">Première</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 ml-2" aria-label="Primary">
            {navLinks.map((l) => {
              const isActive =
                location.pathname === l.href ||
                (l.href === "/#how-it-works" && location.pathname === "/" && location.hash === "#how-it-works");
              return (
                <Link
                  key={l.href}
                  to={l.href}
                  className={`rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative z-20 ml-auto flex shrink-0 items-center justify-end gap-1 md:gap-1.5">
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "fr" : "en")}
              className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-md border px-0 text-center text-[11px] font-semibold leading-none transition-colors ${langBtn}`}
              aria-label={locale === "en" ? "Switch to French" : "Passer en anglais"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={locale === "en" ? "FR" : "EN"}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: MOTION.ease }}
                >
                  {locale === "en" ? "FR" : "EN"}
                </motion.span>
              </AnimatePresence>
            </button>
            <AnimatedThemeToggler className={`h-8 w-8 shrink-0 rounded-md ${themeBtn}`} />
            {user ? (
              <WhatsNewMenu items={whatsNewItems} variant="desktop" className="hidden sm:flex shrink-0" />
            ) : null}
            {!isPlatformAdmin ? (
            <Button size="sm" className="hidden h-8 px-3 text-[13px] font-semibold md:inline-flex" asChild>
              <Link to="/make-request">{t.nav.publishRequest}</Link>
            </Button>
            ) : null}
            {user ? (
              <UserMenuDropdown
                triggerLabel={dashboardLabel}
                onLogout={handleSignOut}
                accentColor="hsl(222 72% 22%)"
                triggerClassName={accountTrigger}
                panelClassName="user-menu-panel--dashboard"
                notificationCount={isPlatformAdmin ? 0 : notificationCount}
                items={[...menuItems]}
              />
            ) : (
              <Button variant="ghost" size="sm" className="hidden h-8 px-2.5 text-[13px] font-semibold md:inline-flex" asChild>
                <Link to="/auth?mode=login">{t.nav.logIn}</Link>
              </Button>
            )}
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-foreground lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-border/50 bg-background pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
            <nav className="flex w-full flex-col gap-0.5 px-4 pt-3">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-3.5 text-[16px] font-medium text-foreground hover:bg-muted/60"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/support"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-3.5 text-[16px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                {t.nav.support}
              </Link>
              {user ? (
                <div className="mt-2 px-1">
                  <WhatsNewMenu items={whatsNewItems} variant="mobileMenu" className="w-full" />
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2 px-1">
                {user ? (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                    <LogOut size={14} /> {t.nav.logOut}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" className="w-full" asChild>
                      <Link to="/make-request" onClick={() => setMobileOpen(false)}>{t.nav.publishRequest}</Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to="/auth?mode=login" onClick={() => setMobileOpen(false)}>{t.nav.logIn}</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
      )}

      <main
        className={`flex-1 min-h-screen w-full max-w-full min-w-0 bg-gradient-page m-0 p-0 ${
          isProProfilePage || isHome
            ? "pt-0"
            : "pt-[calc(4.25rem+env(safe-area-inset-top,0px))]"
        }`}
      >
        {children}
      </main>

      <footer className="footer-gradient text-white">
        <div className="container-page py-14 md:py-16">
          <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-12">
            <div className="space-y-4 max-w-sm">
              <div className="font-heading text-xl font-extrabold tracking-tight">
                Première Services
              </div>
              <p className="text-sm text-white/65 leading-relaxed">
                {t.footer.tagline}
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{t.footer.servicesCol}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                {popularFooterLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/services" className="hover:text-white transition-colors">{t.nav.services}</Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{t.footer.prosCol}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                {showJoinPros && (
                  <li><Link to="/join-pros" className="hover:text-white transition-colors">{t.nav.joinPros}</Link></li>
                )}
                <li><Link to="/support" className="hover:text-white transition-colors">{t.nav.support}</Link></li>
                <li><Link to="/make-request" className="hover:text-white transition-colors">{t.nav.publishRequest}</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{t.footer.legalCol}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/terms" className="hover:text-white transition-colors">{t.footer.termsOfService}</Link></li>
                <li>
                  <Link to="/help/dashboard-guide" className="hover:text-white transition-colors">
                    {t.footer.dashboardGuide ?? (locale === "fr" ? "Guide du tableau de bord" : "Dashboard guide")}
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-white transition-colors">
                    {locale === "fr" ? "Confidentialité" : (t.footer.privacyPolicy ?? "Privacy")}
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="hover:text-white transition-colors">
                    {locale === "fr" ? "Témoins" : (t.footer.cookiePolicy ?? "Cookies")}
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="hover:text-white transition-colors">
                    {t.nav.support ?? "Contact"}
                  </Link>
                </li>
                <li className="flex items-center gap-2 pt-1 text-white/55">
                  <MapPin size={14} className="shrink-0" />
                  <span>{t.footer.servingCities ?? "Quebec · Expanding"}</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Première Services. {t.footer.rights}</span>
            <div className="flex flex-wrap gap-3">
              <Link to="/terms" className="hover:text-white/70 transition-colors">{t.footer.termsOfService}</Link>
              <Link to="/privacy" className="hover:text-white/70 transition-colors">
                {locale === "fr" ? "Confidentialité" : "Privacy"}
              </Link>
              <Link to="/cookies" className="hover:text-white/70 transition-colors">
                {locale === "fr" ? "Témoins" : "Cookies"}
              </Link>
            </div>
          </div>
        </div>
      </footer>
      <CookieConsent />
      <HelpFab />
    </div>
  );
}
