import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        // Premium neutral accent for Kame.col dark surfaces, prices, selected states, and editorial links
        accent: {
          DEFAULT: "#F4F4F5",
          soft: "rgba(244, 244, 245, 0.88)",
          strong: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};
export default config;
