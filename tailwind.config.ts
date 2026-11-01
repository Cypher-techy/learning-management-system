import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#020204",
        navy: { 950: "#050507", 900: "#09090d", 800: "#111118", 700: "#1b1b24" },
        brand: { 300: "#7dd3fc", 400: "#38bdf8", 500: "#2563eb", 600: "#4f46e5", 700: "#6d28d9" },
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["clamp(2.375rem, 1.22rem + 5.14vw, 4.75rem)", { lineHeight: "1.02", letterSpacing: "-0.035em", fontWeight: "800" }],
        h1: ["clamp(2.25rem, 1.82rem + 1.9vw, 3.5rem)", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "700" }],
        h2: ["clamp(1.875rem, 1.58rem + 1.3vw, 2.625rem)", { lineHeight: "1.14", letterSpacing: "-0.025em", fontWeight: "700" }],
        h3: ["clamp(1.5rem, 1.34rem + 0.7vw, 2rem)", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        h4: ["clamp(1.25rem, 1.16rem + 0.4vw, 1.5rem)", { lineHeight: "1.28", letterSpacing: "-0.015em", fontWeight: "600" }],
        h5: ["clamp(1.125rem, 1.08rem + 0.2vw, 1.25rem)", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.65" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        caption: ["0.8125rem", { lineHeight: "1.45" }],
        technical: ["0.8125rem", { lineHeight: "1.45", letterSpacing: "0.01em" }],
      },
      boxShadow: {
        glow: "0 0 54px -14px rgba(79,70,229,.48)",
        card: "0 20px 50px -20px rgba(0,0,0,.62)",
        soft: "0 8px 30px -12px rgba(0,0,0,.22)",
      },
    },
  },
  plugins: [],
};
export default config;
