import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Every colour is a CSS variable (RGB triplet) defined in globals.css, once for
// light and once for dark, so a single class works in both modes.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Surfaces, lowest (cards) to highest (pressed states).
        surface: {
          DEFAULT: token("surface"),
          lowest: token("surface-lowest"),
          low: token("surface-low"),
          container: token("surface-container"),
          high: token("surface-high"),
          highest: token("surface-highest"),
        },
        // Text.
        ink: {
          DEFAULT: token("on-surface"),
          muted: token("on-surface-variant"),
          faint: token("ink-faint"),
        },
        // Borders.
        line: {
          DEFAULT: token("outline-variant"),
          strong: token("outline"),
        },
        // Brand: black (white in dark) with a lime marker colour.
        lime: {
          DEFAULT: token("lime"),
          dim: token("lime-dim"),
          ink: token("lime-ink"),
          foreground: token("on-lime"),
        },
        warn: {
          DEFAULT: token("warn"),
          soft: token("warn-soft"),
          ink: token("warn-ink"),
        },
        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
        },
        success: {
          DEFAULT: token("success"),
          soft: token("success-soft"),
        },
        chart: {
          1: token("chart-1"),
          2: token("chart-2"),
          3: token("chart-3"),
          4: token("chart-4"),
          5: token("chart-5"),
          6: token("chart-6"),
          other: token("chart-other"),
        },
        // shadcn primitives read these names; they map onto the tokens above.
        background: token("surface"),
        foreground: token("on-surface"),
        card: {
          DEFAULT: token("surface-lowest"),
          foreground: token("on-surface"),
        },
        popover: {
          DEFAULT: token("surface-lowest"),
          foreground: token("on-surface"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("on-primary"),
        },
        secondary: {
          DEFAULT: token("surface-container"),
          foreground: token("on-surface"),
        },
        muted: {
          DEFAULT: token("surface-container"),
          foreground: token("on-surface-variant"),
        },
        accent: {
          DEFAULT: token("surface-high"),
          foreground: token("on-surface"),
        },
        destructive: {
          DEFAULT: token("danger"),
          foreground: token("surface-lowest"),
        },
        border: token("outline-variant"),
        input: token("outline-variant"),
        ring: token("primary"),
      },
      fontFamily: {
        // Hindi: the Latin fonts have no Devanagari, so each stack falls back to Noto Sans Devanagari.
        sans: ["var(--font-sans)", "var(--font-devanagari)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-devanagari)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "var(--font-devanagari)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(var(--on-surface) / 0.04)",
        lift: "0 8px 24px -12px rgb(var(--on-surface) / 0.25)",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
