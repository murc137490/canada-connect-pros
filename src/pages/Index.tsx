import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import StarBorder from "@/components/StarBorder";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [hasProProfile, setHasProProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setHasProProfile(null); return; }
    (async () => {
      const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      setHasProProfile(!!data);
    })();
  }, [user]);

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

      {!hasProProfile && (
        <section className="py-12 md:py-24 scroll-fade-in">
          <div className="container px-4 md:px-6 text-center">
            <StarBorder
              as="div"
              color="#EABB1F"
              speed="7s"
              thickness={2}
              className="max-w-3xl mx-auto"
            >
              <div className="space-y-4 md:space-y-6">
              <h2 className="font-heading text-2xl md:text-4xl font-extrabold text-foreground">
                {t.index.areYouPro}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-6 md:mb-8 max-w-xl mx-auto leading-relaxed">
                {t.index.joinThousands}
              </p>
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2" asChild>
                <Link to="/join-pros">
                  {t.index.becomePro} <ArrowRight size={18} />
                </Link>
              </Button>
              </div>
            </StarBorder>
          </div>
        </section>
      )}
    </Layout>
  );
};

export default Index;
