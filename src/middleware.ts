import { NextResponse, type NextRequest } from "next/server";
import { PANEL_HOST_HEADER } from "@/lib/panel-host";

/**
 * Copies the request host into a header the Node runtime can read.
 *
 * Middleware runs in the Edge runtime, a separate isolate, so it cannot look
 * the panel up itself and cannot hand anything to the render through module
 * state. Stamping a header is the one channel that crosses that boundary.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const headers = new Headers(request.headers);
  headers.set(PANEL_HOST_HEADER, host);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
