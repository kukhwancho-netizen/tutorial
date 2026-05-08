import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7fb",
          500: "#3b6ea8",
          600: "#2f5a8c",
          700: "#244871",
        },
      },
    },
  },
  plugins: [],
};

export default config;
