import { describe, expect, it } from "vitest";
import { join, resolve, sep } from "path";
import { UPLOAD_ROOT, LEGACY_UPLOAD_ROOT, UPLOAD_TYPES, uploadMime } from "./uploads";

/** The check the /uploads route makes before it reads anything. */
function insideRoot(root: string, segments: string[]): boolean {
  const target = resolve(join(root, ...segments));
  return target === root || target.startsWith(root + sep);
}

describe("uploadMime", () => {
  it("names the type for every extension we write", () => {
    for (const [mime, ext] of Object.entries(UPLOAD_TYPES)) {
      expect(uploadMime(`abc123.${ext}`)).toBe(mime);
    }
  });

  it("reads the extension case-insensitively", () => {
    expect(uploadMime("LOGO.PNG")).toBe("image/png");
  });

  it("refuses anything we do not write", () => {
    // .svg above all: it can carry script and is served from our own origin.
    for (const name of ["a.svg", "a.html", "a.js", "a.php", "a.png.txt"]) {
      expect(uploadMime(name)).toBeNull();
    }
  });

  it("refuses a name with no extension, or nothing before one", () => {
    for (const name of ["", "logo", ".png", "logo."]) {
      expect(uploadMime(name)).toBeNull();
    }
  });

  it("takes the last extension, not the first", () => {
    expect(uploadMime("a.png.gif")).toBe("image/gif");
  });
});

describe("upload roots", () => {
  it("keeps written uploads out of public/, which is snapshotted at boot", () => {
    expect(UPLOAD_ROOT.includes(`${sep}public${sep}`)).toBe(false);
    expect(UPLOAD_ROOT.endsWith(join("var", "uploads"))).toBe(true);
    expect(LEGACY_UPLOAD_ROOT.endsWith(join("public", "uploads"))).toBe(true);
  });

  it("serves a path that stays inside the root", () => {
    expect(insideRoot(UPLOAD_ROOT, ["panel1", "abc.png"])).toBe(true);
  });

  it("refuses a path that climbs out of it", () => {
    for (const segments of [
      ["..", "..", "prisma", "dev.db"],
      ["panel1", "..", "..", ".env"],
      ["..%2f..", ".env"].map(decodeURIComponent),
    ]) {
      expect(insideRoot(UPLOAD_ROOT, segments)).toBe(false);
    }
  });

  it("treats a root-anchored segment as relative rather than following it", () => {
    // join() does not honour a leading separator the way resolve() would, so
    // an absolute-looking segment lands under the root and is simply missing.
    expect(insideRoot(UPLOAD_ROOT, [resolve(sep, "etc", "passwd")])).toBe(true);
  });
});
