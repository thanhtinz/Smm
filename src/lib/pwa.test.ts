import { describe, expect, it } from "vitest";
import {
  buildManifest,
  generatedIcon,
  iconsFor,
  initialsFrom,
  safeDisplay,
  safeStartUrl,
  shortNameFrom,
  GENERATED_ICON_PATH,
  type ManifestInput,
} from "./pwa";

const BASE: ManifestInput = {
  siteName: "Nova Panel",
  tagline: "Social media growth, delivered",
  logoText: "Nova",
  appName: "",
  shortName: "",
  iconUrl: "",
  logoUrl: "",
  startUrl: "/dashboard",
  display: "standalone",
  primary: "#8b5cf6",
  background: "#0a0a14",
  locale: "vi",
  direction: "ltr",
};

describe("shortNameFrom", () => {
  it("prefers what the operator typed", () => {
    expect(shortNameFrom({ shortName: "Nova SMM", logoText: "Nova", siteName: "Nova Panel" })).toBe("Nova SMM");
  });

  it("falls back to the logo text before the full site name", () => {
    expect(shortNameFrom({ shortName: "", logoText: "Nova", siteName: "Nova Panel Vietnam" })).toBe("Nova");
  });

  it("uses a short site name whole", () => {
    expect(shortNameFrom({ shortName: "", logoText: "", siteName: "Nova Panel" })).toBe("Nova Panel");
  });

  it("cuts a long one at a word rather than mid-word", () => {
    // "Nova Panel Vietnam" is 18; cutting at 12 would give "Nova Panel V".
    expect(shortNameFrom({ shortName: "", logoText: "", siteName: "Nova Panel Vietnam" })).toBe("Nova Panel");
  });

  it("falls back to a hard cut when the first word alone is too long", () => {
    expect(shortNameFrom({ shortName: "", logoText: "", siteName: "Supercalifragilistic" })).toBe("Supercalifra");
  });

  it("never exceeds twelve characters, even from the operator", () => {
    expect(shortNameFrom({ shortName: "A very long app name", logoText: "", siteName: "x" })).toHaveLength(12);
  });
});

describe("safeStartUrl", () => {
  it("keeps a path on this panel", () => {
    expect(safeStartUrl("/dashboard")).toBe("/dashboard");
    expect(safeStartUrl("  /dashboard/orders  ")).toBe("/dashboard/orders");
  });

  it("refuses another origin, however it is spelled", () => {
    // A manifest with an off-origin start_url is rejected whole, so this
    // would silently stop the panel being installable.
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "evil.test", ""]) {
      expect(safeStartUrl(bad)).toBe("/dashboard");
    }
  });

  it("refuses control characters and spaces inside the path", () => {
    expect(safeStartUrl("/dash board")).toBe("/dashboard");
    expect(safeStartUrl("/dash\tboard")).toBe("/dashboard");
    expect(safeStartUrl("/dash\u0000board")).toBe("/dashboard");
  });
});

describe("safeDisplay", () => {
  it("takes the three the spec defines and we offer", () => {
    expect(safeDisplay("standalone")).toBe("standalone");
    expect(safeDisplay("minimal-ui")).toBe("minimal-ui");
    expect(safeDisplay("browser")).toBe("browser");
  });

  it("falls back for anything else", () => {
    expect(safeDisplay("fullscreen")).toBe("standalone");
    expect(safeDisplay("")).toBe("standalone");
  });
});

describe("iconsFor", () => {
  it("always offers the generated mark, so a bare panel is still installable", () => {
    const icons = iconsFor(BASE);
    expect(icons.every((i) => i.src === GENERATED_ICON_PATH)).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("puts an uploaded icon first and the fallback behind it", () => {
    const icons = iconsFor({ ...BASE, iconUrl: "/uploads/p1/abc.png", iconWidth: 512, iconHeight: 512 });
    expect(icons[0]).toEqual({ src: "/uploads/p1/abc.png", sizes: "512x512", purpose: "any" });
    expect(icons.at(-1)!.src).toBe(GENERATED_ICON_PATH);
  });

  it("uses the site logo when no app icon was uploaded", () => {
    expect(iconsFor({ ...BASE, logoUrl: "/uploads/p1/logo.png" })[0].src).toBe("/uploads/p1/logo.png");
  });

  it("declares the real size, not a size we wish it were", () => {
    // Claiming 512x512 for a 64-pixel logo gets it chosen for a 512 slot and
    // rendered blurry, with nothing in the manifest to explain why.
    const icons = iconsFor({ ...BASE, iconUrl: "/uploads/p1/small.png", iconWidth: 64, iconHeight: 64 });
    expect(icons[0].sizes).toBe("64x64");
  });

  it("says 'any' rather than guessing when the size is unknown", () => {
    expect(iconsFor({ ...BASE, iconUrl: "https://cdn.example.test/logo.png" })[0].sizes).toBe("any");
  });

  it("never calls an uploaded file maskable", () => {
    // A launcher believes it and crops to a circle; a wordmark loses its ends.
    const icons = iconsFor({ ...BASE, iconUrl: "/uploads/p1/wordmark.png", iconWidth: 512, iconHeight: 512 });
    expect(icons.find((i) => i.src.includes("wordmark"))!.purpose).toBe("any");
  });
});

describe("buildManifest", () => {
  it("describes the panel from its own branding with nothing filled in", () => {
    const manifest = buildManifest(BASE);
    expect(manifest.name).toBe("Nova Panel");
    expect(manifest.short_name).toBe("Nova");
    expect(manifest.description).toBe("Social media growth, delivered");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBe("#8b5cf6");
    expect(manifest.background_color).toBe("#0a0a14");
    expect(manifest.lang).toBe("vi");
    expect(manifest.dir).toBe("ltr");
  });

  it("lets the app name differ from the site name", () => {
    expect(buildManifest({ ...BASE, appName: "Nova SMM" }).name).toBe("Nova SMM");
  });

  it("leaves the description out rather than sending an empty one", () => {
    expect(buildManifest({ ...BASE, tagline: "   " }).description).toBeUndefined();
  });

  it("carries a right-to-left panel's direction", () => {
    expect(buildManifest({ ...BASE, direction: "rtl" }).dir).toBe("rtl");
  });

  it("still names something when every source is empty", () => {
    expect(buildManifest({ ...BASE, siteName: "", logoText: "", appName: "" }).name).toBe("Panel");
  });
});

describe("initialsFrom", () => {
  it("takes one letter from each of the first two words", () => {
    expect(initialsFrom("Nova Panel")).toBe("NP");
    expect(initialsFrom("Nova Panel Vietnam")).toBe("NP");
  });

  it("takes two letters from a single word", () => {
    expect(initialsFrom("Nova")).toBe("NO");
  });

  it("reads a Vietnamese name by character, not by byte", () => {
    expect(initialsFrom("Đông Á")).toBe("ĐÁ");
  });

  it("ignores words that are only punctuation", () => {
    expect(initialsFrom("— Nova —")).toBe("NO");
  });

  it("has something to draw even for a name with no letters", () => {
    expect(initialsFrom("   ")).toBe("•");
    expect(initialsFrom("!!!")).toBe("•");
  });
});

describe("generatedIcon", () => {
  it("draws a square canvas the colour fills to the edge", () => {
    // Edge to edge is what makes it safe to call maskable.
    const svg = generatedIcon("Nova Panel", "#8b5cf6", "#ffffff");
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain('<rect width="512" height="512" fill="#8b5cf6"/>');
    expect(svg).toContain(">NP<");
  });

  it("escapes a name that would otherwise close the tag", () => {
    const svg = generatedIcon('</text><script>alert(1)</script>', "#000", "#fff");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;");
  });

  it("escapes a colour that is not a colour", () => {
    expect(generatedIcon("Nova", '"/><script>x</script>', "#fff")).not.toContain("<script>");
  });
});
