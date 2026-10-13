import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import HomeCategories from "@/components/home/HomeCategories";
import HomeHowItWorks from "@/components/home/HomeHowItWorks";
import HomeProductShowcase from "@/components/home/HomeProductShowcase";
import HomeTrust from "@/components/home/HomeTrust";
import HomeProCta from "@/components/home/HomeProCta";
import { useAuth } from "@/contexts/AuthContext";
import { shouldShowJoinPros, useActiveVerifiedPro } from "@/hooks/useActiveVerifiedPro";

const Index = () => {
  const { user } = useAuth();
  const { activeVerifiedPro, ready: activeVerifiedProReady } = useActiveVerifiedPro(user?.id);
  const showBecomeProCta = shouldShowJoinPros(user?.id, activeVerifiedPro, activeVerifiedProReady);

  return (
    <Layout>
      <HeroSection />
      <HomeHowItWorks />
      <HomeCategories />
      <HomeProductShowcase />
      <HomeTrust />
      {showBecomeProCta && <HomeProCta />}
    </Layout>
  );
};

export default Index;
