import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { Search, ChevronRight, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Services() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const allServices = useMemo(() => getAllServices(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    return allServices.filter(
      (s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase()) ||
        s.subcategory.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allServices]);

  return (
    <Layout>
      <div className="bg-muted/50 border-b">
        <div className="container py-8">
          <h1 className="font-heading text-3xl font-extrabold text-foreground mb-4">
            All Services
          </h1>
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
        </div>
      </div>

      <div className="container py-10">
        {/* Search results */}
        {filtered ? (
          <div>
            <p className="text-sm text-muted-foreground mb-6">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{query}"
            </p>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No services found. Try a different search.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((s) => (
                  <Link
                    key={`${s.category}-${s.slug}`}
                    to={`/services/${s.categorySlug}/${s.slug}`}
                    className="flex items-center justify-between p-4 rounded-xl border bg-card card-hover cursor-pointer"
                  >
                    <div>
                      <h3 className="font-medium text-card-foreground">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">{s.category} · {s.subcategory}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Category browse */
          <div className="space-y-6">
            {serviceCategories.map((cat) => (
              <div key={cat.slug} className="border rounded-2xl overflow-hidden bg-card">
                <button
                  onClick={() => setExpandedCat(expandedCat === cat.slug ? null : cat.slug)}
                  className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <h2 className="font-heading font-bold text-lg text-card-foreground">{cat.name}</h2>
                    <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                      {cat.subcategories.reduce((a, s) => a + s.services.length, 0)} services
                    </span>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-muted-foreground transition-transform ${
                      expandedCat === cat.slug ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expandedCat === cat.slug && (
                  <div className="border-t px-5 pb-5">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.name} className="mt-5">
                        <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                          {sub.name}
                        </h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {sub.services.map((svc) => (
                            <Link
                              key={svc.slug}
                              to={`/services/${cat.slug}/${svc.slug}`}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                              <span className="text-sm text-card-foreground">{svc.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
