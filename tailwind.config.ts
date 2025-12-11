
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}", // Ensure safe-listed colors are picked up
  ],
  theme: {
    extend: {
      colors: {
        // PREMIUM GREY SCALE (Gemini/Google Dark Mode Inspired)
        background: '#09090b', // Zinc-950 (Deepest)
        card: '#18181b',       // Zinc-900 (Surface)
        subtle: '#27272a',     // Zinc-800 (Highlight)

        // BORDERS & LINES
        border: '#3f3f46',     // Zinc-700

        // TEXT
        foreground: '#f4f4f5', // Zinc-100 (Primary Text)
        'muted-foreground': '#a1a1aa', // Zinc-400 (Secondary Text)

        // ACTIONS (No Blue - "Grå och annan nyans av grå")
        primary: '#e4e4e7',    // Zinc-200 (Button Text / Accents)
        'primary-bg': '#3f3f46', // Zinc-700 (Button Background)
        'primary-hover': '#52525b', // Zinc-600 (Button Hover)

        // STATUS (Keep these colorful as requested)
        success: '#22c55e',    // Green-500
        warning: '#eab308',    // Yellow-500
        error: '#ef4444',      // Red-500
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  safelist: [
    { pattern: /bg-(blue|green|purple|amber|rose|indigo|teal|cyan)-100/ },
    { pattern: /text-(blue|green|purple|amber|rose|indigo|teal|cyan)-700/ },
    { pattern: /border-(blue|green|purple|amber|rose|indigo|teal|cyan)-200/ },
    { pattern: /ring-(blue|green|purple|amber|rose|indigo|teal|cyan)-500/ },
  ],
  plugins: [],
};
export default config;
