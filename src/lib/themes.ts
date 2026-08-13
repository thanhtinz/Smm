export type ThemeTokens = {
  light: Record<string, string>;
  dark: Record<string, string>;
  radius: string;
  font: string;
};

export type ThemeDefinition = {
  slug: string;
  name: string;
  description: string;
  layout: "classic" | "compact" | "canvas";
  tokens: ThemeTokens;
};

const sans = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

/**
 * Built-in skins. They are copied into the Theme table on first boot, after
 * which every token can be edited from Admin → Appearance.
 */
export const builtinThemes: ThemeDefinition[] = [
  {
    slug: "aurora",
    name: "Aurora",
    description: "Glassy violet gradients with a soft glow. The default look.",
    layout: "classic",
    tokens: {
      radius: "16px",
      font: sans,
      dark: {
        bg: "#0a0a14",
        bgAccent: "radial-gradient(1200px 600px at 15% -10%, #3b1d7a55, transparent), radial-gradient(900px 500px at 90% 0%, #0e4f7a55, transparent)",
        surface: "#12121f",
        surface2: "#1a1a2b",
        border: "#272740",
        text: "#f2f2f7",
        muted: "#9494ad",
        primary: "#8b5cf6",
        primaryFg: "#ffffff",
        accent: "#22d3ee",
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
      },
      light: {
        bg: "#f7f7fb",
        bgAccent: "radial-gradient(1100px 560px at 12% -12%, #ddd6fe88, transparent), radial-gradient(900px 480px at 92% -4%, #cffafe88, transparent)",
        surface: "#ffffff",
        surface2: "#f2f2f8",
        border: "#e3e3ee",
        text: "#15151f",
        muted: "#6b6b80",
        primary: "#7c3aed",
        primaryFg: "#ffffff",
        accent: "#0891b2",
        success: "#059669",
        warning: "#d97706",
        danger: "#dc2626",
      },
    },
  },
  {
    slug: "midnight",
    name: "Midnight",
    description: "Deep navy, high contrast, dense data tables.",
    layout: "compact",
    tokens: {
      radius: "10px",
      font: sans,
      dark: {
        bg: "#070d1a",
        bgAccent: "linear-gradient(180deg, #0b1832 0%, transparent 55%)",
        surface: "#0e1729",
        surface2: "#152238",
        border: "#1f2f4d",
        text: "#eaf1ff",
        muted: "#8296b5",
        primary: "#3b82f6",
        primaryFg: "#ffffff",
        accent: "#38bdf8",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      light: {
        bg: "#eef3fb",
        bgAccent: "linear-gradient(180deg, #dbe8fb 0%, transparent 55%)",
        surface: "#ffffff",
        surface2: "#f1f5fc",
        border: "#d7e2f2",
        text: "#0b1729",
        muted: "#5a6f8c",
        primary: "#2563eb",
        primaryFg: "#ffffff",
        accent: "#0284c7",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
    },
  },
  {
    slug: "citrus",
    name: "Citrus",
    description: "Warm amber accents on a cream canvas. Friendly and bright.",
    layout: "canvas",
    tokens: {
      radius: "20px",
      font: sans,
      dark: {
        bg: "#14100a",
        bgAccent: "radial-gradient(900px 480px at 80% -10%, #7c2d1255, transparent)",
        surface: "#1d1710",
        surface2: "#271f16",
        border: "#3a2f21",
        text: "#fdf6ec",
        muted: "#b0a08c",
        primary: "#f97316",
        primaryFg: "#1a1207",
        accent: "#facc15",
        success: "#4ade80",
        warning: "#fbbf24",
        danger: "#f87171",
      },
      light: {
        bg: "#fdf8f1",
        bgAccent: "radial-gradient(900px 480px at 85% -10%, #fed7aa88, transparent)",
        surface: "#ffffff",
        surface2: "#fbf3e8",
        border: "#eee0cd",
        text: "#241a0e",
        muted: "#7d6a53",
        primary: "#ea580c",
        primaryFg: "#ffffff",
        accent: "#ca8a04",
        success: "#15803d",
        warning: "#b45309",
        danger: "#b91c1c",
      },
    },
  },
  {
    slug: "emerald",
    name: "Emerald",
    description: "Calm green tones tuned for long admin sessions.",
    layout: "classic",
    tokens: {
      radius: "14px",
      font: sans,
      dark: {
        bg: "#06120e",
        bgAccent: "radial-gradient(1000px 500px at 20% -10%, #064e3b66, transparent)",
        surface: "#0d1b16",
        surface2: "#13251e",
        border: "#1e352c",
        text: "#eafaf3",
        muted: "#84a89a",
        primary: "#10b981",
        primaryFg: "#04241a",
        accent: "#5eead4",
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#fb7185",
      },
      light: {
        bg: "#f2faf6",
        bgAccent: "radial-gradient(1000px 500px at 18% -12%, #a7f3d088, transparent)",
        surface: "#ffffff",
        surface2: "#eefaf4",
        border: "#d3ece1",
        text: "#08211a",
        muted: "#4f7568",
        primary: "#059669",
        primaryFg: "#ffffff",
        accent: "#0d9488",
        success: "#047857",
        warning: "#b45309",
        danger: "#be123c",
      },
    },
  },
  {
    slug: "mono",
    name: "Mono",
    description: "Neutral greyscale with a single accent. Zero distraction.",
    layout: "minimal" as "classic",
    tokens: {
      radius: "8px",
      font: sans,
      dark: {
        bg: "#0c0c0d",
        bgAccent: "none",
        surface: "#141416",
        surface2: "#1c1c1f",
        border: "#2a2a2e",
        text: "#f4f4f5",
        muted: "#8f8f96",
        primary: "#e4e4e7",
        primaryFg: "#111113",
        accent: "#a1a1aa",
        success: "#4ade80",
        warning: "#facc15",
        danger: "#f87171",
      },
      light: {
        bg: "#fafafa",
        bgAccent: "none",
        surface: "#ffffff",
        surface2: "#f4f4f5",
        border: "#e4e4e7",
        text: "#111113",
        muted: "#71717a",
        primary: "#18181b",
        primaryFg: "#ffffff",
        accent: "#52525b",
        success: "#16a34a",
        warning: "#ca8a04",
        danger: "#dc2626",
      },
    },
  },
];

/** Renders a theme into the CSS custom properties consumed by globals.css. */
export function themeToCss(slug: string, tokens: ThemeTokens): string {
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `  --${kebab(k)}: ${v};`)
      .join("\n");

  return [
    `[data-theme="${slug}"][data-mode="dark"] {`,
    block(tokens.dark),
    `  --radius: ${tokens.radius};`,
    `  --font-sans: ${tokens.font};`,
    `}`,
    `[data-theme="${slug}"][data-mode="light"] {`,
    block(tokens.light),
    `  --radius: ${tokens.radius};`,
    `  --font-sans: ${tokens.font};`,
    `}`,
  ].join("\n");
}

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
