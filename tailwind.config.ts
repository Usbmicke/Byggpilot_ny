
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
        background: '#131314', // NotebookLM Dark Background
        card: '#1E1F20',       // NotebookLM Card Surface
        primary: '#A8C7FA',    // Google Material 3 Muted Blue (Secondary/Primary)
        'primary-hover': '#82B1FF', // Slightly brighter on hover
        foreground: '#E3E3E3', // High contrast text
        'muted-foreground': '#C4C7C5', // Muted text
        border: '#444746', // Subtle border
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
