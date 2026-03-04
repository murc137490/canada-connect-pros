import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-suggestions`;

export default function HeroSection() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const navigate = useNavigate();
  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error("Search suggestions error:", error);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/services?q=${encodeURIComponent(query)}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setSuggestions([]);
    navigate(`/services?q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <img
        src={heroBg}
        alt="Canadian home services"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-hero-overlay" />

      <div className="container relative z-10 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-12 animate-fade-up">
            <p className="text-maple-200 text-sm mb-8 opacity-70">Where are you located?</p>
            <input
              type="text"
              placeholder="City or postal code"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="max-w-xs mx-auto glass-card rounded-full px-6 py-3 text-center text-foreground placeholder:text-muted-foreground outline-none text-sm"
            />
          </div>

          <div className="mb-8 animate-fade-up-delay">
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold text-gradient-hero leading-tight mb-8">
              What do we need to work on today?
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto animate-fade-up-delay-2">
            <div className="glass-card glass-hover rounded-3xl p-3 relative">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Describe your project or service need..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground px-4 py-4 text-lg"
                  />
                  {loading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Sparkles className="text-secondary animate-pulse" size={20} />
                    </div>
                  )}
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/20 dark:border-gray-700/30">
                  <div className="flex flex-wrap gap-2 px-2">
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="glass-card px-4 py-2 rounded-full text-sm text-foreground hover:bg-white/30 dark:hover:bg-gray-700/40 transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
