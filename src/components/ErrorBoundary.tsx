import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/config/legalConfig";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function readLocale(): "en" | "fr" {
  try {
    const stored = localStorage.getItem("premiere-locale");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr")) return "fr";
  } catch {
    /* ignore */
  }
  return "en";
}

function readPrefersDark(): boolean {
  try {
    if (document.documentElement.classList.contains("dark")) return true;
  } catch {
    /* ignore */
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

const COPY = {
  en: {
    title: "Something went wrong",
    body: "Please refresh the page. If it continues, visit Support — we’re here to help.",
    tryAgain: "Refresh",
    goHome: "Go home",
    getHelp: "Go to Support",
    email: "Email",
    phone: "Phone",
  },
  fr: {
    title: "Une erreur est survenue",
    body: "Actualisez la page. Si le problème continue, ouvrez Aide — nous sommes là.",
    tryAgain: "Actualiser",
    goHome: "Accueil",
    getHelp: "Aller à l’aide",
    email: "Courriel",
    phone: "Téléphone",
  },
} as const;

/** Standalone crash screen (no React Router / LanguageProvider required). */
export function AppErrorScreen({
  onRetry,
  locale: localeProp,
}: {
  onRetry?: () => void;
  locale?: "en" | "fr";
}) {
  const locale = localeProp ?? readLocale();
  const c = COPY[locale];
  const dark = readPrefersDark();

  const navy = "#12233f";
  const navyDeep = "#0b1628";
  const amber = "#e8a317";
  const paper = "#f7f3ec";
  const ink = "#121a28";
  const muted = dark ? "rgba(255,255,255,0.68)" : "rgba(18,26,40,0.62)";
  const surface = dark ? "rgba(26,26,26,0.92)" : "rgba(255,255,255,0.94)";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(18,35,63,0.12)";
  const text = dark ? "#f7f3ec" : ink;

  const btnBase: CSSProperties = {
    display: "block",
    width: "100%",
    padding: "12px 18px",
    borderRadius: 10,
    fontSize: "0.9375rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    textDecoration: "none",
    textAlign: "center",
    cursor: "pointer",
    fontFamily: "Manrope, system-ui, sans-serif",
    border: "none",
    transition: "transform 0.15s ease, opacity 0.15s ease",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
        color: text,
        background: dark
          ? `radial-gradient(1200px 700px at 12% -10%, rgba(55, 110, 200, 0.22), transparent 55%),
             radial-gradient(900px 500px at 90% 110%, rgba(232, 163, 23, 0.12), transparent 50%),
             linear-gradient(165deg, #0a0a0a 0%, ${navyDeep} 55%, #0a0a0a 100%)`
          : `radial-gradient(1100px 640px at 8% -8%, rgba(18, 35, 63, 0.12), transparent 55%),
             radial-gradient(900px 520px at 100% 100%, rgba(232, 163, 23, 0.16), transparent 48%),
             linear-gradient(165deg, ${paper} 0%, #efe8dc 48%, #e7eef8 100%)`,
        fontFamily: "Manrope, system-ui, -apple-system, sans-serif",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap"
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(18,35,63,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          opacity: dark ? 0.35 : 0.55,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: surface,
          boxShadow: dark
            ? "0 24px 60px rgba(0,0,0,0.45)"
            : "0 20px 50px -18px rgba(18, 35, 63, 0.22), 0 8px 20px -10px rgba(18, 35, 63, 0.1)",
          padding: "36px 28px 28px",
          textAlign: "center",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 4,
            borderRadius: 999,
            margin: "0 auto 22px",
            background: `linear-gradient(90deg, ${navy} 0%, ${amber} 100%)`,
          }}
        />

        <p
          style={{
            margin: "0 0 10px",
            fontFamily: "Instrument Serif, Georgia, serif",
            fontSize: "1.65rem",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: dark ? "#f7f3ec" : navy,
          }}
        >
          Première Services
        </p>

        <h1
          style={{
            fontFamily: "Instrument Serif, Georgia, serif",
            fontSize: "1.45rem",
            fontWeight: 400,
            margin: "0 0 12px",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            color: text,
          }}
        >
          {c.title}
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: muted,
            margin: "0 0 26px",
            lineHeight: 1.55,
            maxWidth: "32ch",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {c.body}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                ...btnBase,
                background: `linear-gradient(135deg, ${navy} 0%, #1a3d73 55%, #2a5a9e 100%)`,
                color: "#fff",
                boxShadow: "0 10px 24px -12px rgba(18, 35, 63, 0.65)",
              }}
            >
              {c.tryAgain}
            </button>
          ) : null}
          <a
            href="/support"
            style={{
              ...btnBase,
              background: dark ? "rgba(255,255,255,0.08)" : paper,
              color: dark ? "#f7f3ec" : navy,
              border: `1px solid ${border}`,
            }}
          >
            {c.getHelp}
          </a>
          <a
            href="/"
            style={{
              ...btnBase,
              background: "transparent",
              color: dark ? amber : navy,
              border: `1px solid ${dark ? "rgba(232,163,23,0.35)" : "rgba(18,35,63,0.22)"}`,
              fontWeight: 600,
            }}
          >
            {c.goHome}
          </a>
        </div>

        <div
          style={{
            borderTop: `1px solid ${border}`,
            paddingTop: 16,
            display: "grid",
            gap: 10,
            textAlign: "left",
            fontSize: "0.8125rem",
          }}
        >
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{ color: text, textDecoration: "none", lineHeight: 1.4 }}
          >
            <span style={{ color: muted, display: "block", fontSize: "0.7rem", marginBottom: 2 }}>
              {c.email}
            </span>
            {SUPPORT_EMAIL}
          </a>
          <a href={SUPPORT_PHONE_TEL} style={{ color: text, textDecoration: "none", lineHeight: 1.4 }}>
            <span style={{ color: muted, display: "block", fontSize: "0.7rem", marginBottom: 2 }}>
              {c.phone}
            </span>
            {SUPPORT_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Never log stacks or internals to the production console.
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <AppErrorScreen
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            try {
              window.location.assign(window.location.pathname + window.location.search);
            } catch {
              window.location.reload();
            }
          }}
        />
      );
    }
    return this.props.children;
  }
}
