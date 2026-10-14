import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteOrigin, getOAuthRedirectOrigin } from "@/lib/authSiteUrl";
import { stashOAuthRedirect } from "@/lib/oauthRedirect";
import {
  classifyLoginIdentifier,
  LOGIN_EMAIL_NOT_CONFIRMED,
  LOGIN_INVALID_CREDENTIALS,
  LOGIN_TOO_MANY_ATTEMPTS,
  requestIdentifierSession,
  type LoginIdentifierKind,
} from "@/lib/loginIdentifier";

export const NAME_TAKEN_MESSAGE = "This name is already taken.";
export const EMAIL_ALREADY_IN_USE_MESSAGE = "EMAIL_ALREADY_IN_USE";

function isEmailAlreadyRegistered(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("already registered") || m.includes("user already exists") || m.includes("already been registered") || m.includes("email already") || m.includes("already in use");
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    emailLanguage?: "en" | "fr";
    referralCode?: string;
    username?: string;
  }) => Promise<{ hasSession: boolean }>;
  /** Password login with a Member ID or username (never email). */
  signIn: (identifier: string, password: string) => Promise<{ kind: LoginIdentifierKind; value: string }>;
  /** Opens Google OAuth; creates an account on first sign-in. */
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function signalAppReady() {
  try {
    // Keep the HTML boot splash up through OAuth return, AuthCallback owns dismissal.
    if (window.location.pathname.startsWith("/auth/callback")) return;
    window.dispatchEvent(new Event("altshift-app-ready"));
    (window as Window & { __altshiftMarkAppReady?: () => void }).__altshiftMarkAppReady?.();
  } catch {
    // ignore
  }
}

/** Call when a route finishes its own boot work (e.g. OAuth callback). */
export function markAltShiftAppReady() {
  try {
    window.dispatchEvent(new Event("altshift-app-ready"));
    (window as Window & { __altshiftMarkAppReady?: () => void }).__altshiftMarkAppReady?.();
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      signalAppReady();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    emailLanguage?: "en" | "fr";
    referralCode?: string;
    username?: string;
  }) => {
    const { email, password, fullName, phone, emailLanguage = "en", referralCode, username } = params;
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const trimmedPhone = phone?.trim() || "";
    if (!trimmedEmail) throw new Error("Email is required.");
    if (!trimmedName) throw new Error("Name is required.");
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          phone: trimmedPhone || undefined,
          email_language: emailLanguage === "fr" ? "fr" : "en",
          referral_code: referralCode?.trim() || undefined,
          // Requested login username; the database assigns a unique one if taken.
          username: username?.trim().toLowerCase() || undefined,
        },
        emailRedirectTo: `${getPublicSiteOrigin()}/auth/callback`,
      },
    });
    if (error) {
      if (isEmailAlreadyRegistered(error.message)) {
        throw new Error(EMAIL_ALREADY_IN_USE_MESSAGE);
      }
      throw error;
    }
    if (data.user?.id && trimmedPhone) {
      await supabase.from("profiles").update({ phone: trimmedPhone }).eq("user_id", data.user.id);
    }
    return { hasSession: !!data.session };
  };

  const signIn = async (identifier: string, password: string) => {
    const parsed = classifyLoginIdentifier(identifier);
    if (!parsed) {
      throw new Error(LOGIN_INVALID_CREDENTIALS);
    }
    if (parsed.kind === "email") {
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.value, password });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("email not confirmed")) throw new Error(LOGIN_EMAIL_NOT_CONFIRMED);
        if (message.includes("rate limit") || message.includes("too many requests")) throw new Error(LOGIN_TOO_MANY_ATTEMPTS);
        throw new Error(LOGIN_INVALID_CREDENTIALS);
      }
      return parsed;
    }
    const tokens = await requestIdentifierSession(parsed.value, password);
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) throw error;
    return parsed;
  };

  const signInWithGoogle = async (redirectPath = "/") => {
    const origin = getOAuthRedirectOrigin();
    const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/";
    stashOAuthRedirect(safeRedirect);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Dedicated callback route exchanges PKCE code; keep allow-list:
        // https://www.altshift.ca/auth/callback** and http://localhost:*/auth/callback**
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) throw error;
    // Browser should navigate; if not (popup blocked / skipBrowserRedirect), use URL
    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
  };

  const signOut = async () => {
    try {
      const { clearAdminMemberVerification } = await import("@/lib/adminMemberGate");
      clearAdminMemberVerification();
    } catch {
      /* ignore */
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
