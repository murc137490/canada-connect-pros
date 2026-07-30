import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Menu, X, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AnimatedThemeToggler from "@/components/AnimatedThemeToggler";
import CookieConsent from "@/components/CookieConsent";
import HelpFab from "@/components/HelpFab";
import PillNavLinks from "@/components/PillNavLinks";
import UserMenuDropdown from "@/components/UserMenuDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { getAllServices } from "@/data/services";
import { shouldShowJoinPros, useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";
import { getServiceName } from "@/i18n/serviceTranslations";
import { FOOTER_POPULAR_SERVICE_FALLBACK } from "@/lib/footerPopularServices";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import WhatsNewMenu from "@/components/WhatsNewMenu";
import { useWhatsNew } from "@/contexts/WhatsNewContext";

const HERO_SCROLL_THRESHOLD = 320;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
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
    if (!isHome) {
      setScrolledPastHero(false);
      return;
    }
    const onScroll = () => setScrolledPastHero(window.scrollY > HERO_SCROLL_THRESHOLD);
    onScroll(); // initial
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const { isPlatformAdmin } = usePlatformAdmin();
  const { items: whatsNewItems } = useWhatsNew();

  const showJoinPros =
    !isPlatformAdmin && shouldShowJoinPros(user?.id, activeVerifiedPro, activeVerifiedProReady);
  const navLinks = [
    { label: t.nav.howItWorks, href: "/#how-it-works" },
    { label: t.nav.services, href: "/services" },
    ...(showJoinPros ? [{ label: t.nav.joinPros, href: "/join-pros" }] : []),
    { label: t.nav.support, href: "/support" },
  ];

  const fullName = (user?.user_metadata?.full_name as string)?.trim();
  const dashboardLabel = fullName ? fullName.split(/\s+/)[0] || t.nav.dashboardShort : t.nav.dashboardShort;
  const isProProfilePage = /^\/pro\/[^/]+$/.test(location.pathname);
  // Use light header (white text) only at top of home; after scroll use theme-aware colors so text is visible on white
  const headerLight = isHome && !scrolledPastHero;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const langBtn = headerLight
    ? "border-white/30 bg-white/15 text-white shadow-sm backdrop-blur-sm hover:bg-white/25 active:bg-white/30 focus-visible:bg-white/25"
    : "border-border/70 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted/70 active:bg-muted focus-visible:bg-muted/70 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:active:bg-white/20 dark:focus-visible:bg-white/15";
  const themeBtn = headerLight
    ? "border-white/30 bg-white/15 text-white shadow-sm backdrop-blur-sm hover:bg-white/25 active:bg-white/30 focus-visible:bg-white/25 [&_svg]:text-white"
    : "border-border/70 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted/70 active:bg-muted focus-visible:bg-muted/70 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:active:bg-white/20 dark:focus-visible:bg-white/15 [&_svg]:dark:text-white";
  const menuIcon = headerLight ? "text-white" : "text-foreground";
  const accountTrigger = headerLight
    ? "!border !border-white/30 !bg-white/15 !text-white !shadow-sm backdrop-blur-sm hover:!bg-white/25 active:!bg-white/30 focus-visible:!bg-white/25 hover:!opacity-100 max-md:!min-w-0 max-md:!px-2"
    : "!border !border-border/70 !bg-background/85 !text-foreground !shadow-sm backdrop-blur-sm hover:!bg-muted/70 active:!bg-muted focus-visible:!bg-muted/70 hover:!opacity-100 dark:!border-white/15 dark:!bg-white/10 dark:!text-white dark:hover:!bg-white/15 dark:active:!bg-white/20 dark:focus-visible:!bg-white/15 max-md:!min-w-0 max-md:!px-2";

  const menuItems = isPlatformAdmin
    ? [
        { label: t.dashboard.admin, link: "/dashboard?tab=admin", emoji: "🛡️", show: true },
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
    <div className="min-h-screen w-full max-w-full min-w-0 flex flex-col m-0 p-0">
      {/* Nav — hidden on pro public profile; on home, no bar so nav floats on hero image */}
      {!isProProfilePage && (
      <header className={`fixed top-0 left-0 right-0 z-50 group pt-[env(safe-area-inset-top,0px)] transition-all duration-300 ${headerLight ? "border-0 border-transparent bg-transparent hover:bg-transparent hover:border-transparent shadow-none hover:shadow-none backdrop-blur-0 hover:backdrop-blur-0" : "border-b border-transparent hover:border-transparent bg-transparent hover:bg-transparent dark:hover:bg-transparent backdrop-blur-0 hover:backdrop-blur-0 shadow-none hover:shadow-none"}`}>
        {/* Single row: logo left (full-bleed on small screens), controls + nav on the right; desktop gets centered pill links */}
        <div className="relative flex min-h-[3rem] w-full items-center xl:min-h-[4rem] pl-[max(0.25rem,env(safe-area-inset-left,0px))] pr-[max(0.25rem,env(safe-area-inset-right,0px))] xl:pl-[env(safe-area-inset-left,0px)] xl:pr-[env(safe-area-inset-right,0px)]">
          <div className="relative flex w-full items-center justify-between gap-2 px-2 py-1.5 md:container md:mx-auto md:h-16 md:px-0 md:py-0">
            <Link
              to="/"
              className={`min-w-0 shrink font-logo tracking-tight transition-opacity hover:opacity-90 md:shrink-0 ${
                headerLight ? "text-white drop-shadow-sm md:drop-shadow-none" : "text-primary"
              } mr-auto max-w-[min(100%,calc(100%-10rem))] text-left text-[15px] leading-tight sm:text-[16px] md:text-[20px] xl:text-[22px] 2xl:max-w-none`}
              aria-label="Premiere Services – Home"
            >
              <span className="block truncate text-left md:whitespace-normal 2xl:truncate">Premiere Services</span>
            </Link>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 2xl:block">
              <div className="pointer-events-auto">
                <PillNavLinks items={navLinks} className={headerLight ? "pill-nav-header-light" : ""} />
              </div>
            </div>

            <div
              className={`relative z-20 flex shrink-0 flex-nowrap items-center justify-end gap-1 md:gap-1.5 2xl:ml-auto ${headerLight ? "text-white" : "text-foreground dark:text-white"}`}
            >
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "fr" : "en")}
                className={`h-8 w-9 shrink-0 rounded-md border px-0 py-1 text-center text-[12px] font-semibold leading-none transition-colors md:h-9 md:w-11 md:py-1.5 md:text-[15px] md:font-medium ${langBtn}`}
                aria-label={locale === "en" ? "Switch to French" : "Passer en anglais"}
              >
                {locale === "en" ? "FR" : "EN"}
              </button>
              <AnimatedThemeToggler className={`h-8 w-8 shrink-0 rounded-md md:h-9 md:w-9 ${themeBtn}`} />
              {user ? (
                <WhatsNewMenu items={whatsNewItems} variant="desktop" className="hidden sm:flex shrink-0" />
              ) : null}
              {user ? (
                <UserMenuDropdown
                  triggerLabel={dashboardLabel}
                  onLogout={handleSignOut}
                  accentColor="#007A56"
                  triggerClassName={accountTrigger}
                  panelClassName="user-menu-panel--dashboard"
                  notificationCount={isPlatformAdmin ? 0 : notificationCount}
                  items={[...menuItems]}
                />
              ) : (
                <div className="hidden items-center gap-2 md:flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-9 min-w-[5.85rem] shrink-0 px-2.5 text-[15px] font-medium ${headerLight ? "text-white hover:bg-white/10 hover:text-white" : "dark:text-white dark:hover:bg-white/10 dark:hover:text-white"}`}
                    asChild
                  >
                    <Link to="/auth?mode=login">{t.nav.logIn}</Link>
                  </Button>
                  <Button
                    size="sm"
                    className={`h-9 min-w-[5.85rem] shrink-0 px-2.5 text-[15px] font-medium ${headerLight ? "border border-white/40 bg-white/20 text-white hover:bg-white/30" : "bg-secondary text-secondary-foreground hover:bg-secondary/90"}`}
                    asChild
                  >
                    <Link to="/auth?mode=signup">{t.nav.signUp}</Link>
                  </Button>
                </div>
              )}
              <button
                type="button"
                className={`shrink-0 rounded-md p-1.5 2xl:hidden ${menuIcon}`}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu — site links; account lives in header dropdown */}
        {mobileOpen && (
          <div className="2xl:hidden border-t border-border/50 bg-background pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-lg">
            <nav className="flex w-full max-w-full flex-col items-center gap-0.5 px-3 pt-3">
              {navLinks.map((l) => {
                const isActive = location.pathname === l.href || (l.href === "/#how-it-works" && location.pathname === "/");
                return (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`w-full max-w-sm translate-x-0.5 rounded-lg px-3 py-3.5 text-center text-[18px] font-medium transition-colors ${
                      isActive ? "font-semibold bg-muted/70 text-foreground" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {user ? (
                <div className="mt-3 flex w-full max-w-sm flex-col items-center px-1">
                  <WhatsNewMenu items={whatsNewItems} variant="mobileMenu" className="w-full" />
                </div>
              ) : null}
              <div className="mt-3 flex w-full max-w-sm translate-x-0.5 flex-col items-center gap-2 px-1">
                {user ? (
                  <>
                    <span className="w-full text-center text-sm text-muted-foreground truncate" title={user?.email ?? undefined}>{dashboardLabel}</span>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                      <LogOut size={14} /> {t.nav.logOut}
                    </Button>
                  </>
                ) : (
                  <div className="flex w-full justify-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to="/auth?mode=login">{t.nav.logIn}</Link>
                    </Button>
                    <Button size="sm" className="flex-1 bg-secondary text-secondary-foreground" asChild>
                      <Link to="/auth?mode=signup">{t.nav.signUp}</Link>
                    </Button>
                  </div>
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
            : "pt-[calc(5rem+env(safe-area-inset-top,0px))] 2xl:pt-[calc(3.5rem+env(safe-area-inset-top,0px))]"
        }`}
      >
        {children}
      </main>

      {/* Footer */}
      <footer className="footer-gradient text-white border-t border-white/10">
        <div className="container py-10 md:py-14 px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            <div className="space-y-4">
              <div className="font-heading font-semibold text-lg tracking-tight">
                {t.common.premiereServices}
              </div>
              <p className="text-sm opacity-80 leading-relaxed max-w-xs">
                {t.footer.tagline}
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-heading font-semibold">{t.footer.popular}</h4>
              <ul className="space-y-2 text-sm opacity-70">
                {popularFooterLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="hover:opacity-100 block py-0.5 underline-offset-2 hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-heading font-semibold">{t.footer.company}</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><Link to="/support" className="hover:opacity-100 block py-0.5">{t.nav.support}</Link></li>
                {showJoinPros && <li><Link to="/join-pros" className="hover:opacity-100 block py-0.5">{t.nav.joinPros}</Link></li>}
                <li><Link to="/terms" className="hover:opacity-100 block py-0.5">{t.footer.termsOfService}</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-heading font-semibold">{t.footer.serving}</h4>
              <div className="flex items-center gap-2 text-sm opacity-70">
                <MapPin size={14} className="shrink-0" />
                <span className="leading-relaxed">{t.footer.servingCities ?? "Quebec · Expanding"}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-6 text-center text-xs opacity-80">
            © {new Date().getFullYear()} {t.common.premiereServices}. {t.footer.rights}
          </div>
        </div>
      </footer>
      <CookieConsent />
      <HelpFab />
    </div>
  );
}
