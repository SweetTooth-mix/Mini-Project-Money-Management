import { isIP } from "node:net";
import { headers } from "next/headers";

/** Header-based client address used for rate limiting, never for authorisation. */
export type ClientAddress = {
  ip: string;
  source: "forwarded" | "real" | "unknown";
};

export type HeaderReader = (name: string) => string | null | undefined;

/**
 * Trust is opt-in. An unset variable means the app is reachable directly, where
 * any client could send its own X-Forwarded-For and pick its own throttle
 * bucket. Deployments behind a proxy must say so explicitly.
 */
export const trustProxyHeaders = (env: Record<string, string | undefined>) =>
  env.TRUST_PROXY_HEADERS === "true";

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
 * Set TRUST_PROXY_HEADERS=true only when a reverse proxy you control sets the
 * header. Left unset, the per-address limit stays inert and only the per-email
 * limit applies — worse for detection, but impossible to spoof.
 */
export async function clientAddress(): Promise<ClientAddress> {
  const store = await headers();
  return resolveAddress(
    (name) => store.get(name),
    trustProxyHeaders(process.env),
  );
}
