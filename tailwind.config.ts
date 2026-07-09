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
        // === the Humiley Portal's exact :root tokens (templates/index.html) ===
        navy: "#205090",
        navyDeep: "#163866",
        navyLight: "#3168A8",
        emerald: "#00B060",
        emeraldDeep: "#008548",
        body: "#1F2937",   // --text-dark
        grey: "#5C6470",   // --text-light
        line: "#dde2ee",   // --line: borders, dividers, table rules
        panel: "#f0f2f8",  // --soft-bg: page/table-header ground
        tint: "#e8edf6",   // --light-tint: icon tiles, soft chips
        tintNavy: "#3168A8",
        tintLight: "#B5C8E5",
        danger: "#C00000",
        warning: "#F59E0B",
        info: "#8B5CF6",
        success: "#10B981",
      },
      fontFamily: {
        sans: ["Calibri", "Segoe UI", "system-ui", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(32,80,144,0.08)",
        "card-hover": "0 6px 16px rgba(32,80,144,0.14), 0 2px 4px rgba(32,80,144,0.08)",
        topbar: "0 1px 3px rgba(32,80,144,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
