import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteOrigin, getOAuthRedirectOrigin } from "@/lib/authSiteUrl";
import { stashOAuthRedirect } from "@/lib/oauthRedirect";

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
  }) => Promise<void>;
  signIn: (emailOrName: string, password: string) => Promise<void>;
  /** Opens Google OAuth; creates an account on first sign-in. */
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function signalAppReady() {
  try {
    window.dispatchEvent(new Event("premiere-app-ready"));
    (window as Window & { __premiereMarkAppReady?: () => void }).__premiereMarkAppReady?.();
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncPlatformAdmin = (session: Session | null) => {
      if (!session?.access_token) return;
      void supabase.functions
        .invoke("ensure-platform-admin", { method: "POST" })
        .catch(() => {
          /* non-fatal: admin UI still uses env + profiles.is_platform_admin */
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      signalAppReady();
      syncPlatformAdmin(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      signalAppReady();
      syncPlatformAdmin(session);
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
  }) => {
    const { email, password, fullName, phone, emailLanguage = "en", referralCode } = params;
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
  };

  const signIn = async (emailOrName: string, password: string) => {
    const input = emailOrName.trim();
    let email = input;
    if (!input.includes("@")) {
      const { data, error: rpcError } = await supabase.rpc("get_email_for_name", { full_name: input });
      if (rpcError) throw rpcError;
      const resolved = typeof data === "string" ? data : Array.isArray(data) ? data[0] : (data as { get_email_for_name?: string } | null)?.get_email_for_name;
      email = (typeof resolved === "string" ? resolved : null) ?? "";
      if (!email || !email.includes("@")) {
        throw new Error("Name not found. Sign up first or use your email.");
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async (redirectPath = "/") => {
    const origin = getOAuthRedirectOrigin();
    const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/";
    stashOAuthRedirect(safeRedirect);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Dedicated callback route exchanges PKCE code; keep allow-list:
        // https://www.premiereservices.ca/auth/callback** and http://localhost:*/auth/callback**
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
