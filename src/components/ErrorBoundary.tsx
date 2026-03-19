import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "linear-gradient(180deg, #f0f7f4 0%, #e8f0ec 100%)",
            color: "#1a1a1a",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#444", marginBottom: 16, textAlign: "center", maxWidth: 400 }}>
            The page could not load. Try refreshing. Check the browser console (F12) for errors.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: "#007A56",
              color: "white",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
