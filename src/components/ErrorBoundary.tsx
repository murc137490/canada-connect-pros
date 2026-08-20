import { Component, type ErrorInfo, type ReactNode } from "react";
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

const COPY = {
  en: {
    title: "Something went wrong",
    body: "This page hit an unexpected error. You can try again, go home, or reach our support team — FAQ, email, and phone are on the Support page.",
    tryAgain: "Try again",
    goHome: "Go home",
    getHelp: "Get help on Support",
    email: "Email",
    phone: "Phone",
  },
  fr: {
    title: "Une erreur est survenue",
    body: "Cette page a rencontré une erreur inattendue. Vous pouvez réessayer, retourner à l’accueil, ou joindre notre équipe — FAQ, courriel et téléphone sont sur la page Aide.",
    tryAgain: "Réessayer",
    goHome: "Accueil",
    getHelp: "Obtenir de l’aide",
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(165deg, #f0f7f4 0%, #e4efe9 45%, #dce8e2 100%)",
        color: "#14201c",
        fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 20,
          border: "1px solid rgba(0, 122, 86, 0.18)",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 18px 50px rgba(20, 40, 32, 0.08)",
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#007A56",
          }}
        >
          Première Services
        </p>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 10px", lineHeight: 1.3 }}>{c.title}</h1>
        <p style={{ fontSize: "0.9rem", color: "#3d524a", margin: "0 0 22px", lineHeight: 1.55 }}>{c.body}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "11px 16px",
                borderRadius: 10,
                background: "#007A56",
                color: "white",
                border: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c.tryAgain}
            </button>
          ) : null}
          <a
            href="/support"
            style={{
              display: "block",
              padding: "11px 16px",
              borderRadius: 10,
              background: "#0f2744",
              color: "white",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {c.getHelp}
          </a>
          <a
            href="/"
            style={{
              display: "block",
              padding: "10px 16px",
              borderRadius: 10,
              background: "transparent",
              color: "#007A56",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "1px solid rgba(0, 122, 86, 0.35)",
            }}
          >
            {c.goHome}
          </a>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            paddingTop: 16,
            display: "grid",
            gap: 8,
            textAlign: "left",
            fontSize: "0.8rem",
          }}
        >
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1a3a30", textDecoration: "none" }}>
            <strong>{c.email}:</strong> {SUPPORT_EMAIL}
          </a>
          <a href={SUPPORT_PHONE_TEL} style={{ color: "#1a3a30", textDecoration: "none" }}>
            <strong>{c.phone}:</strong> {SUPPORT_PHONE}
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info.componentStack);
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
