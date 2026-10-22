import { NextResponse, type NextRequest } from "next/server";

// This is the Next.js 16 "proxy" convention, the successor to middleware.ts.
//
// A per-request nonce replaces 'unsafe-inline' for scripts. Next.js reads the
// nonce from the CSP header on the request and stamps it onto the script tags
// it injects; the one hand-written inline script (the theme bootstrap in
// app/layout.tsx) reads the same value from the x-nonce request header.
//
// style-src keeps 'unsafe-inline': the app sets inline SVG fills and table
// column widths, and a nonce cannot cover style attributes.
//
// The Content-Security-Policy used to be a static header in next.config.ts.
// It lives here now because a nonce must be unique per response.
const isDev = process.env.NODE_ENV !== "production";
const frameAncestors = isDev ? "'self' https:" : "'none'";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Only HTML documents need a nonce. Static assets, images and API routes are
  // excluded: API responses set their own Content-Security-Policy (attachments
  // use "sandbox"), and two policies on one response would be intersected.
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
