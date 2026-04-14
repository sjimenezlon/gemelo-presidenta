import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1120",
        aqua: "#22d3ee",
        river: "#0ea5e9",
      },
    },
  },
  plugins: [],
};
export default config;
