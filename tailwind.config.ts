import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      fontFamily: {
        heading: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        brand: ['"Playfair Display"', 'Georgia', 'serif'],
        logo: ['"Righteous"', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        maple: {
          50: "hsl(30 80% 96%)",
          100: "hsl(30 78% 90%)",
          200: "hsl(30 76% 80%)",
          300: "hsl(30 75% 65%)",
          400: "hsl(30 75% 55%)",
          500: "hsl(30 75% 50%)",
          600: "hsl(30 70% 42%)",
          700: "hsl(30 65% 35%)",
        },
        navy: {
          50: "hsl(215 40% 96%)",
          100: "hsl(215 40% 90%)",
          200: "hsl(215 40% 80%)",
          300: "hsl(215 45% 60%)",
          400: "hsl(215 50% 40%)",
          500: "hsl(215 55% 30%)",
          600: "hsl(215 55% 20%)",
          700: "hsl(215 55% 15%)",
          800: "hsl(215 55% 10%)",
          900: "hsl(215 55% 6%)",
        },
        category: {
          home: "hsl(var(--cat-home))",
          business: "hsl(var(--cat-business))",
          events: "hsl(var(--cat-events))",
          lessons: "hsl(var(--cat-lessons))",
          pets: "hsl(var(--cat-pets))",
          wellness: "hsl(var(--cat-wellness))",
          cleaning: "hsl(var(--cat-cleaning))",
          outdoor: "hsl(var(--cat-outdoor))",
          automotive: "hsl(var(--cat-automotive))",
          tech: "hsl(var(--cat-tech))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
