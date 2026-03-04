import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { serviceCategories, getAllServices } from "@/data/services";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServicePage() {
  const { categorySlug, serviceSlug } = useParams<{ categorySlug: string; serviceSlug: string }>();

  const category = serviceCategories.find((c) => c.slug === categorySlug);
  const allServices = getAllServices();
  const service = allServices.find(
    (s) => s.slug === serviceSlug && s.categorySlug === categorySlug
  );

  if (!category || !service) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Service not found</h1>
          <Button asChild>
            <Link to="/services">Back to Services</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-primary text-primary-foreground">
        <div className="container py-12">
          <Link
            to={`/services/${category.slug}`}
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-4"
          >
            <ArrowLeft size={16} />
            {category.name}
          </Link>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-2">
            {service.name}
          </h1>
          <p className="text-primary-foreground/70 text-lg">
            {category.name} · {service.subcategory}
          </p>
        </div>
      </div>

      <div className="container py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* CTA to view pros */}
          <div className="bg-card border rounded-2xl p-8 mb-8">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-4">
              Find {service.name} Professionals
            </h2>
            <p className="text-muted-foreground mb-6">
              Browse verified pros, compare prices, read reviews, and hire the best {service.name.toLowerCase()} professional near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
                asChild
              >
                <Link to={`/services/${category.slug}/${service.slug}/pros`}>
                  View Available Pros <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles size={20} className="text-secondary" />
              <h3 className="font-heading font-bold text-lg text-foreground">
                Are you a {service.name} professional?
              </h3>
            </div>
            <p className="text-muted-foreground mb-5">
              That could be <span className="font-semibold text-secondary">you</span> here! Join our growing network of Canadian service pros and start getting leads today.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
                asChild
              >
                <Link to="/join-pros">
                  Become a Pro <ArrowRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth?mode=signup">Create an Account</Link>
              </Button>
            </div>
          </div>

          <Button variant="ghost" asChild>
            <Link to={`/services/${category.slug}`} className="gap-2">
              <ArrowLeft size={16} /> Back to {category.name}
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
