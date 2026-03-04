import { useEffect } from "react";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".scroll-fade-in").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Layout>
      <HeroSection />
      <HowItWorks />

      <section className="py-24 scroll-fade-in">
        <div className="container text-center">
          <div className="glass-card glass-hover rounded-3xl p-12 max-w-3xl mx-auto">
            <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground mb-6">
              Are You a Service Professional?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of Canadian pros growing their business. Get leads, build your reputation, and reach more customers.
            </p>
            <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2" asChild>
              <Link to="/join-pros">
                Become a Pro <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
