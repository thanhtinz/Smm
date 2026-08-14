/**
 * CSV, for spreadsheets rather than for parsers.
 *
 * Two things about that audience decide everything here. Excel reads a file
 * as the machine's local encoding unless it finds a byte-order mark, so
 * Vietnamese arrives as mojibake without one. And a spreadsheet treats a cell
 * beginning with =, +, - or @ as a formula — which matters because these
 * files carry service names from providers and links from customers, neither
 * of whom the panel controls.
 */

/** Excel needs this to read the file as UTF-8. */
export const BOM = "﻿";

/**
 * One value, safe to open.
 *
 * The leading apostrophe is what stops a spreadsheet running the cell: a name
 * like "=cmd|' /c calc'!A1" is a documented way to get code executed on
 * whoever opens the export, and provider catalogues are not trusted input.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  // Doubling the quote is how CSV escapes one; wrapping is only needed when
  // the value carries a delimiter, but wrapping always is simpler to read.
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

/**
 * A response that streams, so an export is not built in memory first. An
 * admin's order history can be larger than the process should hold, and a
 * truncated file that says nothing about being truncated is worse than a slow
 * one.
 */
export function csvResponse(
  filename: string,
  header: string[],
  rows: () => AsyncGenerator<unknown[]>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(BOM + csvRow(header)));
      try {
        for await (const row of rows()) controller.enqueue(encoder.encode(csvRow(row)));
      } catch (error) {
        // The file is already going out, so the failure is written into it
        // rather than swallowed into a half file that looks complete.
        controller.enqueue(encoder.encode(csvRow(["ERROR", error instanceof Error ? error.message : "export failed"])));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/** A name that sorts by date and says which panel it came from. */
export function csvFilename(kind: string, site: string): string {
  const slug = site.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "panel";
  return `${slug}-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
}
