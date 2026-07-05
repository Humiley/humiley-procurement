import type { Config } from "tailwindcss";

/**
 * Humiley brand theme (spec §10). 60/30/10 rule: ~60% white/light, ~30% navy, ~10% emerald.
 * Never introduce other brand colors; functional status colors (red/amber) are allowed.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#205090", // primary — headers, primary buttons, table headers
        emerald: "#00B060", // accent — success, highlights, CTAs (≤10% of surface)
        body: "#1F2937", // body text
        grey: "#5C6470", // secondary text, VN sublines
        panel: "#F7F9FC", // panel/card backgrounds
        tintNavy: "#3168A8",
        tintLight: "#B5C8E5",
        // functional status colors (not brand — semantics only)
        danger: "#DC2626",
        warning: "#D97706",
      },
      fontFamily: {
        sans: ["Calibri", "Segoe UI", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "0.5rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(31,41,55,0.08), 0 1px 2px rgba(31,41,55,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
