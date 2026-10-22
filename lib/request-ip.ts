import { isIP } from "node:net";
import { headers } from "next/headers";

/** Header-based client address used for rate limiting, never for authorisation. */
export type ClientAddress = {
  ip: string;
  source: "forwarded" | "real" | "unknown";
};

export type HeaderReader = (name: string) => string | null | undefined;

/**
 * Resolve the client address from proxy headers.
 *
 * Behind nginx (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`)
 * the left-most entry is the original client. Only syntactically valid
 * addresses are accepted, so a forged header cannot reach the throttle keys.
 */
export function resolveAddress(
  read: HeaderReader,
  trustProxyHeaders: boolean,
): ClientAddress {
  if (!trustProxyHeaders) return { ip: "unknown", source: "unknown" };
  const forwarded = read("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first && isIP(first)) return { ip: first, source: "forwarded" };
  }
  const real = read("x-real-ip")?.trim();
  if (real && isIP(real)) return { ip: real, source: "real" };
  return { ip: "unknown", source: "unknown" };
}

/**
 * Set TRUST_PROXY_HEADERS=false when the app is exposed directly, otherwise a
 * client could spoof the header and bypass the per-address limit.
 */
export async function clientAddress(): Promise<ClientAddress> {
  const store = await headers();
  return resolveAddress(
    (name) => store.get(name),
    process.env.TRUST_PROXY_HEADERS !== "false",
  );
}
