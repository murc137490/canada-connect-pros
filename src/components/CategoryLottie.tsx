import { useEffect, useState, type ReactNode } from "react";
import Lottie from "lottie-react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  className?: string;
  play?: boolean;
  fallback?: ReactNode;
};

/** Lazy-loads a public Lottie JSON; shows a fallback icon if loading fails. */
export default function CategoryLottie({ src, className, play = true, fallback }: Props) {
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setData(null);
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <div className={cn("flex items-center justify-center text-secondary", className)} aria-hidden>
        {fallback ?? <Search className="h-1/2 w-1/2" strokeWidth={1.75} />}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex items-center justify-center text-secondary/50", className)} aria-hidden>
        {fallback ?? <Search className="h-1/2 w-1/2 animate-pulse" strokeWidth={1.75} />}
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden>
      <Lottie
        animationData={data}
        loop
        autoplay={play}
        style={{ width: "100%", height: "100%" }}
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
    </div>
  );
}
