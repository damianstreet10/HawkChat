import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hawk: {
          50: "#fafafa",
          100: "#e5e5e5",
          200: "#a3a3a3",
          300: "#737373",
          400: "#525252",
          500: "#404040",
          600: "#2e2e2e",
          700: "#1f1f1f",
          800: "#141414",
          900: "#0a0a0a",
          950: "#000000",
        },
        orange: {
          DEFAULT: "#ff5500",
          light: "#ff7a33",
          dark: "#e04a00",
          glow: "#ff6b1a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hawk-hero":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255, 85, 0, 0.12) 0%, transparent 55%), linear-gradient(180deg, #000000 0%, #0a0a0a 50%, #141414 100%)",
        "hawk-header":
          "linear-gradient(90deg, #000000 0%, #141414 50%, #000000 100%)",
        "hawk-orange": "linear-gradient(135deg, #e04a00 0%, #ff5500 50%, #ff7a33 100%)",
        "hawk-arc":
          "repeating-linear-gradient(-12deg, transparent, transparent 40px, rgba(255, 85, 0, 0.03) 40px, rgba(255, 85, 0, 0.03) 41px)",
      },
      boxShadow: {
        hawk: "0 4px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 85, 0, 0.1)",
        "hawk-glow": "0 0 28px rgba(255, 85, 0, 0.35)",
        "hawk-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
