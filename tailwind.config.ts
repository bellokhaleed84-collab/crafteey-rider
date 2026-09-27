import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#15181F",
        steel: "#3A4250",
        concrete: "#F3F1EA",
        brand: {
          DEFAULT: "#15181F",
          accent: "#E29A3E",
        },
        sunshine: "#F5C542",

        // True neutral near-black, not navy-tinted — matches the
        // black (not navy) dark-mode direction.
        "surface-dark": "#141414",
        "border-dark": "#2B2B2B",
        "ink-dark": "#F3F1EA",
        "steel-dark": "#A3A3A3",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;