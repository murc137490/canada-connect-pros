import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  LiquidButtonPrimitive,
  type LiquidButtonProps as LiquidButtonPrimitiveProps,
} from "@/components/animate-ui/primitives/buttons/liquid";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-medium transition-[box-shadow,_color,_background-color,_border-color,_outline-color,_text-decoration-color,_fill,_stroke] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "[--liquid-button-background-color:hsl(var(--primary))] [--liquid-button-color:hsl(var(--primary-foreground))] text-primary-foreground hover:text-primary-foreground shadow-xs",
        destructive:
          "[--liquid-button-background-color:hsl(var(--destructive))] [--liquid-button-color:white] text-white shadow-xs focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        secondary:
          "[--liquid-button-background-color:hsl(var(--secondary))] [--liquid-button-color:hsl(var(--secondary-foreground))] text-secondary-foreground hover:text-secondary-foreground shadow-xs",
        ghost:
          "[--liquid-button-background-color:transparent] [--liquid-button-color:hsl(var(--foreground))] text-foreground hover:text-foreground shadow-xs",
      },
      size: {
        default: "min-h-[32px] px-3.5 py-1.5 has-[>svg]:px-3",
        sm: "min-h-[32px] rounded-[6px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "min-h-[40px] rounded-[6px] px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-[6px]",
        "icon-sm": "size-8 rounded-[6px]",
        "icon-lg": "size-10 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type LiquidButtonProps = LiquidButtonPrimitiveProps &
  VariantProps<typeof buttonVariants>;

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant, size, whiteUntilHover, ...props }, ref) => {
    return (
      <LiquidButtonPrimitive
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        whiteUntilHover={whiteUntilHover}
        {...props}
      />
    );
  }
);

LiquidButton.displayName = "LiquidButton";

export { LiquidButton, buttonVariants, type LiquidButtonProps };
