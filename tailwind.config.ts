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
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"] },
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
