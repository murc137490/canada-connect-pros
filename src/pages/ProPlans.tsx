import Layout from "@/components/Layout";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import ProPlansContent from "@/components/ProPlansContent";
import MovingStarsBackground from "@/components/MovingStarsBackground";

export default function ProPlans() {
  const { resolvedTheme } = useTheme();

  return (
    <Layout>
      <div className="relative min-h-screen pt-16">
        <MovingStarsBackground
          starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
          className={cn(
            "absolute inset-0 z-0 rounded-none",
            resolvedTheme === "dark"
              ? "bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]"
              : "bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]"
          )}
          pointerEvents={false}
        />
        <div className="relative z-10 min-h-full pb-24">
          <div className="container py-12 md:py-16 px-4 md:px-6">
            <ProPlansContent />
          </div>
        </div>
      </div>
    </Layout>
  );
}
