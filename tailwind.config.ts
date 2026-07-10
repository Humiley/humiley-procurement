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
        // Poppins is the portal's face (its "Crextio" theme). Falls back to the system stack.
        sans: ["var(--font-poppins)", "Poppins", "Segoe UI", "system-ui", "Arial", "sans-serif"],
        // Doc-numbers/codes: the portal uses BARE `monospace` (browser default) so it renders
        // Consolas on Windows / Menlo on macOS — match it exactly (not Tailwind's SF-Mono stack).
        mono: ["monospace"],
      },
      borderRadius: {
        card: "24px", // portal Crextio: soft rounded cards everywhere
      },
      boxShadow: {
        // portal Crextio soft card shadow (0 14px 34px rgba(32,80,144,.09))
        card: "0 14px 34px rgba(32,80,144,0.09)",
        "card-hover": "0 20px 44px rgba(32,80,144,0.15), 0 4px 10px rgba(32,80,144,0.08)",
        topbar: "0 1px 3px rgba(32,80,144,0.06)",
        // floating white pill controls in the transparent topbar
        pill: "0 6px 18px rgba(32,80,144,0.08)",
        sidebar: "0 22px 48px rgba(23,58,107,0.28)",
      },
      backgroundImage: {
        // the portal's floating navy sidebar gradient + the airy page background
        sidebar: "linear-gradient(180deg,#1b417a 0%,#205090 55%,#1d6e6a 130%)",
        appbg:
          "radial-gradient(700px 360px at 92% -6%, rgba(0,176,96,.07), transparent 60%), radial-gradient(680px 360px at 4% 2%, rgba(32,80,144,.06), transparent 55%), linear-gradient(180deg,#f7f9fc 0%,#eef1f6 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
