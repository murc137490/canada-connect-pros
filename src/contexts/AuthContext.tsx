import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
    emailLanguage?: "en" | "fr";
  }) => Promise<void>;
  signIn: (emailOrName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    emailLanguage?: "en" | "fr";
  }) => {
    const { email, password, fullName, emailLanguage = "en" } = params;
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    if (!trimmedEmail) throw new Error("Email is required.");
    if (!trimmedName) throw new Error("Name is required.");
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          email_language: emailLanguage === "fr" ? "fr" : "en",
        },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      if (isEmailAlreadyRegistered(error.message)) {
        throw new Error(EMAIL_ALREADY_IN_USE_MESSAGE);
      }
      throw error;
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

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
