import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import FuzzyText from "@/components/FuzzyText";
import Layout from "@/components/Layout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center px-4">
          <FuzzyText
            baseIntensity={0.2}
            hoverIntensity={0.5}
            enableHover
            color="hsl(var(--primary))"
            fontSize="clamp(3rem, 15vw, 8rem)"
            className="block mx-auto mb-6"
          >
            404
          </FuzzyText>
          <p className="mb-6 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90 font-medium">
            Return to Home
          </a>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
