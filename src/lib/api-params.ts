/** Parse a reseller API body from raw text and a Content-Type header. */
export function parseApiBody(raw: string, contentType: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  if (contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      // Fall through to urlencoded parsing.
    }
  }

  const form = new URLSearchParams(trimmed);
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

/** Accepts form-encoded, JSON, and multipart bodies, as clients differ. */
export async function readApiParams(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    } catch {
      return {};
    }
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return {};
  }

  return parseApiBody(raw, type);
}
