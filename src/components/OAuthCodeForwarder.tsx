import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * If Google/Supabase drops `?code=` on a non-callback path (legacy Site URL,
 * domain redirect, etc.), forward it to AuthCallback so PKCE can finish.
 */
export default function OAuthCodeForwarder() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.startsWith("/auth/callback")) return;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) return;
    // Ignore Square / other OAuth returns that also use ?code=
    if (location.pathname.startsWith("/dashboard") && params.has("square")) return;
    navigate(`/auth/callback${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
