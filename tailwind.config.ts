import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#04060f",
        navy: { 950: "#05081a", 900: "#0a0e2a", 800: "#10163d", 700: "#1a2154" },
        brand: { 300: "#7dd8ff", 400: "#38bdf8", 500: "#2563eb", 600: "#4f46e5", 700: "#7c3aed" },
      },
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"] },
      boxShadow: {
        glow: "0 0 60px -12px rgba(79,70,229,.55)",
        card: "0 20px 50px -20px rgba(4,6,20,.55)",
        soft: "0 8px 30px -12px rgba(4,6,20,.18)",
      },
    },
  },
  plugins: [],
};
export default config;
