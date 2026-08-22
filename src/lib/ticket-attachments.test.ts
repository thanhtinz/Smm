import { describe, expect, it } from "vitest";
import { planAttachments, displayName, ATTACHMENT_ROOT, type AttachmentLimits } from "./ticket-attachments";
import { UPLOAD_ROOT } from "./uploads";

const LIMITS: AttachmentLimits = { enabled: true, maxFiles: 3, maxBytes: 512 * 1024 };

const png = (size: number, name = "shot.png") => ({ name, type: "image/png", size });

describe("planAttachments", () => {
  it("takes what is inside the limits", () => {
    const plan = planAttachments([png(1000), png(2000)], LIMITS);
    expect(plan).toEqual({ ok: true, files: [png(1000), png(2000)] });
  });

  it("treats an untouched file input as nothing attached", () => {
    // An empty <input type="file"> still posts a File: zero bytes, no name.
    // Refusing it would make every reply without a screenshot unsendable.
    expect(planAttachments([{ name: "", type: "application/octet-stream", size: 0 }], LIMITS)).toEqual({
      ok: true,
      files: [],
    });
  });

  it("keeps quiet about the switch when nothing was attached anyway", () => {
    const off = { ...LIMITS, enabled: false };
    expect(planAttachments([{ name: "", type: "", size: 0 }], off)).toEqual({ ok: true, files: [] });
  });

  it("refuses an attachment when the operator has them switched off", () => {
    expect(planAttachments([png(10)], { ...LIMITS, enabled: false })).toEqual({ ok: false, error: "disabled" });
  });

  it("counts only the files actually picked", () => {
    const three = [png(10), png(10), png(10), { name: "", type: "", size: 0 }];
    expect(planAttachments(three, LIMITS).ok).toBe(true);
    expect(planAttachments([...three, png(10)], LIMITS)).toEqual({ ok: false, error: "tooMany" });
  });

  it("refuses a type it would not serve back, whatever the browser called it", () => {
    for (const type of ["image/svg+xml", "text/html", "application/pdf", "image/x-icon", ""]) {
      expect(planAttachments([{ name: "x", type, size: 10 }], LIMITS)).toEqual({ ok: false, error: "type" });
    }
  });

  it("refuses the file that is over the limit, not the batch average", () => {
    expect(planAttachments([png(10), png(512 * 1024 + 1)], LIMITS)).toEqual({ ok: false, error: "tooBig" });
    expect(planAttachments([png(512 * 1024)], LIMITS).ok).toBe(true);
  });

  it("checks the count before the types, so twenty files answer in one word", () => {
    const many = Array.from({ length: 20 }, () => ({ name: "x", type: "text/html", size: 10 }));
    expect(planAttachments(many, LIMITS)).toEqual({ ok: false, error: "tooMany" });
  });
});

describe("displayName", () => {
  it("keeps an ordinary name", () => {
    expect(displayName("order-not-running.png", "image/png")).toBe("order-not-running.png");
  });

  it("drops the directories a browser may send with it", () => {
    expect(displayName("C:\\Users\\me\\Desktop\\shot.png", "image/png")).toBe("shot.png");
    expect(displayName("../../etc/passwd.png", "image/png")).toBe("passwd.png");
  });

  it("strips control characters, which have no business in rendered text", () => {
    expect(displayName("sh\u0000o\u001bt\u007f.png", "image/png")).toBe("shot.png");
  });

  it("caps a name long enough to break the layout", () => {
    expect(displayName(`${"a".repeat(300)}.png`, "image/png")).toHaveLength(80);
  });

  it("names a file that arrived without one, after its own type", () => {
    expect(displayName("", "image/webp")).toBe("image.webp");
    expect(displayName("   ", "image/jpeg")).toBe("image.jpg");
  });
});

describe("where attachments are stored", () => {
  it("is not under the folder the public /uploads route reads", () => {
    // The public route asks only that the host is a panel we serve. A
    // customer's screenshot must be reachable only through the route that
    // checks who is asking.
    expect(ATTACHMENT_ROOT.startsWith(UPLOAD_ROOT)).toBe(false);
    expect(UPLOAD_ROOT.startsWith(ATTACHMENT_ROOT)).toBe(false);
  });
});
