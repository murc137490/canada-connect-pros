import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirect = searchParams.get("redirect") || "/";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, fullName);
        toast({ title: "Account created!", description: "Check your email to confirm your account." });
      } else {
        await signIn(email, password);
        toast({ title: "Welcome back!" });
        navigate(redirect);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-16">
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <span className="text-4xl mb-4 block">⭐</span>
            <h1 className="font-heading text-2xl font-extrabold text-foreground">
              {mode === "login" ? "Welcome Back" : "Create Your Account"}
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              {mode === "login"
                ? "Log in to access your account and find local pros."
                : "Join Premiere Services to hire pros or offer your services."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Jane Smith" className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
              size="lg"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "login" ? "Log In" : "Create Account"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-secondary font-medium hover:underline"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
