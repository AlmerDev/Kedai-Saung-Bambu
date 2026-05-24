import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        saung: {
          red: "#9B111E",
          dark: "#2A0908",
          orange: "#F97316",
          yellow: "#FFD166",
          cream: "#FFF7DF"
        }
      },
      boxShadow: {
        glow: "0 24px 80px rgba(249, 115, 22, 0.25)"
      }
    }
  },
  plugins: []
};
export default config;
