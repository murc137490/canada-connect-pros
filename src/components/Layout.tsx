import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Menu, X, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AnimatedThemeToggler from "@/components/AnimatedThemeToggler";
import CookieConsent from "@/components/CookieConsent";
import PillNavLinks from "@/components/PillNavLinks";
import UserMenuDropdown from "@/components/UserMenuDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

const HERO_SCROLL_THRESHOLD = 320;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLanguage();
  const { count: notificationCount } = useNotifications();

  const [hasProProfile, setHasProProfile] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) {
      setHasProProfile(null);
      return;
    }
    // Use a cached pro check to avoid UI flicker.
    try {
      const cacheKey = `proProfile:${user.id}`;
      const raw = localStorage.getItem(cacheKey);
      if (raw === "true" || raw === "false") {
        setHasProProfile(raw === "true");
      }
    } catch {
      // Ignore cache errors (e.g. blocked storage).
    }
    (async () => {
      const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      setHasProProfile(!!data);
      try {
        localStorage.setItem(`proProfile:${user.id}`, (!!data).toString());
      } catch {
        // ignore
      }
    })();
  }, [user]);

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

  const isAdmin = !!user && (user.email ?? "").toLowerCase().trim() === "premiereservicescontact@gmail.com";

  // Keep "Join the pros" completely unavailable for pro users.
  // If logged in and we haven't confirmed "not a pro" yet, hide it.
  const showJoinPros = !user || hasProProfile === false;
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

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 flex flex-col m-0 p-0">
      {/* Nav — hidden on pro public profile; on home, no bar so nav floats on hero image */}
      {!isProProfilePage && (
      <header className={`fixed top-0 left-0 right-0 z-50 group transition-all duration-300 ${headerLight ? "border-0 border-transparent bg-transparent hover:bg-transparent hover:border-transparent shadow-none hover:shadow-none backdrop-blur-0 hover:backdrop-blur-0" : "border-b border-transparent hover:border-border/50 bg-transparent hover:bg-background/95 dark:hover:bg-background/95 backdrop-blur-0 hover:backdrop-blur-xl shadow-none hover:shadow-sm"}`}>
        <div className="container relative flex items-center h-16">
          {/* Left: logo with shuffle effect on hover */}
          <Link to="/" className={`shrink-0 flex items-center min-w-0 font-logo text-[20px] md:text-[22px] tracking-tight transition-opacity hover:opacity-90 ${headerLight ? "text-white" : "text-primary"}`} aria-label="Premiere Services – Home">
            Premiere Services
          </Link>

          {/* Center: pill nav links */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <PillNavLinks items={navLinks} className={headerLight ? "pill-nav-header-light" : ""} />
          </div>

          {/* Right: language, theme, user menu or Log In / Sign Up */}
          <div className={`hidden md:flex flex-1 justify-end items-center gap-3 ml-auto ${headerLight ? "text-white" : "text-foreground dark:text-white"}`}>
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "fr" : "en")}
              className={`text-[15px] font-medium px-2.5 py-1.5 rounded-md border transition-colors ${headerLight ? "border-white/40 bg-transparent hover:bg-white/10 text-white" : "border-border bg-background hover:bg-muted/80 text-foreground dark:bg-card dark:border-white/30 dark:hover:bg-white/10 dark:text-white"}`}
              aria-label={locale === "en" ? "Switch to French" : "Passer en anglais"}
            >
              {locale === "en" ? "FR" : "EN"}
            </button>
            <AnimatedThemeToggler className={headerLight ? "text-white border-white/40 bg-white/10 [&_svg]:text-white" : "dark:text-white [&_svg]:dark:text-white"} />
            {user ? (
              <UserMenuDropdown
                triggerLabel={dashboardLabel}
                onLogout={handleSignOut}
                accentColor="#007A56"
                triggerClassName={headerLight ? "!bg-white/20 !text-white !border !border-white/40 hover:!bg-white/30" : undefined}
                notificationCount={notificationCount}
                items={[
                  { label: t.dashboard.myAccount, link: "/dashboard?tab=account", emoji: "👤", show: true },
                  { label: t.dashboard.bookings, link: "/dashboard?tab=bookings", emoji: "📅", show: true },
                  { label: t.dashboard.favorites, link: "/dashboard?tab=favorites", emoji: "❤️", show: true },
                  { label: t.dashboard.reviews, link: "/dashboard?tab=reviews", emoji: "⭐", show: true },
                  { label: t.dashboard.invoices, link: "/dashboard?tab=invoices", emoji: "📄", show: true },
                  { label: t.dashboard.admin, link: "/dashboard?tab=admin", emoji: "🛡️", show: isAdmin },
                ]}
              />
            ) : (
              <>
                <Button variant="ghost" size="sm" className={`h-9 text-[15px] font-medium shrink-0 ${headerLight ? "text-white hover:text-white hover:bg-white/10" : "dark:text-white dark:hover:text-white dark:hover:bg-white/10"}`} asChild>
                  <Link to="/auth?mode=login">{t.nav.logIn}</Link>
                </Button>
                <Button size="sm" className={`h-9 text-[15px] font-medium shrink-0 ${headerLight ? "bg-white/20 text-white border border-white/40 hover:bg-white/30" : "bg-secondary text-secondary-foreground hover:bg-secondary/90"}`} asChild>
                  <Link to="/auth?mode=signup">{t.nav.signUp}</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile: right-side toggle */}
          <div className="md:hidden flex flex-1 justify-end items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "fr" : "en")}
              className="text-[14px] font-medium px-2.5 py-1.5 rounded border border-border bg-background text-foreground dark:bg-card dark:border-white/30 dark:text-white"
            >
              {locale === "en" ? "FR" : "EN"}
            </button>
            <AnimatedThemeToggler />
            <button className="p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-sm pb-5">
            <nav className="container flex flex-col gap-0.5 pt-4">
              {navLinks.map((l) => {
                const isActive = location.pathname === l.href || (l.href === "/#how-it-works" && location.pathname === "/");
                return (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-4 py-3.5 rounded-lg text-[18px] font-medium transition-colors ${
                      isActive ? "font-semibold bg-muted/70 text-foreground" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {user && (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium hover:bg-muted ${
                    location.pathname === "/dashboard" ? "font-semibold ring-2 ring-secondary/50 ring-inset bg-muted/50" : ""
                  }`}
                >
                  {dashboardLabel}
                </Link>
              )}
              <div className="flex flex-col gap-2 mt-3 px-4">
                {user ? (
                  <>
                    <span className="text-sm text-muted-foreground truncate" title={user?.email ?? undefined}>{dashboardLabel}</span>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                      <LogOut size={14} /> {t.nav.logOut}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
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

      <main className={`flex-1 min-h-screen w-full max-w-full min-w-0 bg-gradient-page m-0 p-0 ${isProProfilePage || isHome ? "pt-0" : "pt-16"}`}>{children}</main>

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
                <li><Link to="/services" className="hover:opacity-100 block py-0.5">Home Improvement</Link></li>
                <li><Link to="/services" className="hover:opacity-100 block py-0.5">Snow Removal</Link></li>
                <li><Link to="/services" className="hover:opacity-100 block py-0.5">Cleaning</Link></li>
                <li><Link to="/services" className="hover:opacity-100 block py-0.5">Moving</Link></li>
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
    </div>
  );
}
