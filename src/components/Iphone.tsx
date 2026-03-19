import { cn } from "@/lib/utils";

interface IphoneProps {
  children: React.ReactNode;
  className?: string;
  /** Width of the phone frame (default 280px for content area) */
  width?: number;
}

export default function Iphone({ children, className = "", width = 280 }: IphoneProps) {
  return (
    <div
      className={cn("mx-auto flex flex-col items-center", className)}
      style={{ width: width + 40 }}
    >
      <div className="relative w-full rounded-[2.75rem] border-[10px] border-gray-800 dark:border-gray-700 bg-black p-2 shadow-2xl">
        <div
          className="absolute left-1/2 top-4 h-6 w-20 -translate-x-1/2 rounded-full bg-black dark:bg-gray-800"
          aria-hidden
        />
        <div
          className="overflow-hidden rounded-[1.5rem] bg-background"
          style={{ minHeight: "480px" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
