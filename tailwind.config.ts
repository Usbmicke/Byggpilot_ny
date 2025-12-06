
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
        background: '#1E1F22', // Dark Grey (Discord-like)
        card: '#2B2D31',       // Slightly lighter grey for cards
        primary: '#5865F2',    // Modern Blurple (pop of color) or keeping to User's "Grey" request?
        // User said "gray and another gray... simple".
        // Let's use a Steel Blue/Grey for primary to separate it from bg but keep it professional.
        'primary-hover': '#4752C4',

        // Let's actually use the Plan's defined colors:
        // primary: '#4A90E2', 
        // 'primary-hover': '#5A98E4' -> This is blue. 
        // User said: "göra om alla sidor grå och annan grå nyans på allt"
        // Maybe Primary should be a lighter grey or white? 
        // "knappar mm... modernare"
        // Let's stick to the Plan's #4A90E2 for now as a "Modern" accent, but maybe desaturate it if it looks too blue.
        // Actually, let's try a very neutral "White/Grey" approach for buttons if possible, or the plan's blue.
        // Plan says: primary: '#4A90E2'. I will stick to the plan.

        foreground: '#F2F3F5',   // Off-white text
        'muted-foreground': '#B5BAC1', // Muted text
        border: '#404249', // Border color for inputs/cards
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
