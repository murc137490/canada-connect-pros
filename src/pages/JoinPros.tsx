import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Users, Star, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const benefits = [
  {
    icon: TrendingUp,
    title: "Grow Your Business",
    description: "Get matched with customers actively looking for your services across Canada.",
  },
  {
    icon: Users,
    title: "Reach More Customers",
    description: "Access thousands of homeowners and businesses in your area.",
  },
  {
    icon: Star,
    title: "Build Your Reputation",
    description: "Collect reviews and ratings that help you stand out from the competition.",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Get paid securely and on time through our trusted payment system.",
  },
];

export default function JoinPros() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="bg-primary text-primary-foreground">
        <div className="container py-16 text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-4">
            Join the <span className="text-maple-300">Premiere Services</span> Pro Network
          </h1>
          <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto">
            Connect with customers in your area, grow your business, and be part of Canada's fastest-growing service marketplace.
          </p>
        </div>
      </div>

      {/* Benefits */}
      <section className="py-16">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card border rounded-2xl p-6 card-hover">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                  <b.icon size={24} className="text-secondary" />
                </div>
                <h3 className="font-heading font-bold text-foreground mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign Up CTA / Login Gate */}
      <section className="py-16 bg-muted/50">
        <div className="container max-w-lg text-center">
          {user ? (
            <>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-muted-foreground mb-6">
                Fill out your profile to start receiving job requests.
              </p>
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
                Complete Your Pro Profile <ArrowRight size={18} />
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Lock size={28} className="text-primary" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
                Log In to Become a Pro
              </h2>
              <p className="text-muted-foreground mb-6">
                You need to create an account or log in to access the Pro registration page.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2" asChild>
                  <Link to="/auth?mode=signup&redirect=/join-pros">
                    Create Account <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/auth?mode=login&redirect=/join-pros">Log In</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
