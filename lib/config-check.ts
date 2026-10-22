/**
 * Startup checks for settings that quietly weaken transport security.
 *
 * A missing `https` in `APP_URL` is the dangerous one: `lib/auth.ts` turns the
 * `Secure` flag on only when `APP_URL` starts with `https://`, so a production
 * server misconfigured as `http://` would ship its session cookie in clear over
 * the network. That has to stop the process, not appear in a log nobody reads.
 *
 * Loopback hosts are allowed because a container health check or a developer
 * running `docker compose --profile container` talks to `http://127.0.0.1`.
 * `ALLOW_INSECURE_HTTP=true` is the explicit escape hatch for anything else.
 */

type Env = Record<string, string | undefined>;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const isLoopback = (hostname: string) =>
  LOOPBACK.has(hostname) || hostname.endsWith(".localhost");

/** Build-time only; `next build` must not need a real deployment URL. */
export const isServing = (env: Env) =>
  env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";

/**
 * The reason production cannot start, or `null` when the configuration is safe.
 */
export function insecureAppUrl(env: Env): string | null {
  if (!isServing(env) || env.ALLOW_INSECURE_HTTP === "true") return null;
  const raw = env.APP_URL?.trim();
  if (!raw)
    return "APP_URL is not set: session cookies cannot be marked Secure and HSTS stays off.";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `APP_URL is not a valid URL: ${raw}`;
  }
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && isLoopback(url.hostname)) return null;
  return `APP_URL is ${raw}: production must use https so the session cookie is Secure and HSTS is sent. Set ALLOW_INSECURE_HTTP=true only for a throwaway environment.`;
}

/**
 * Settings that are legal but likely a mistake. Each line is emitted once at
 * startup so an operator sees it in the same place as everything else.
 */
export function configWarnings(env: Env): string[] {
  const warnings: string[] = [];
  const url = env.APP_URL?.trim() ?? "";
  if (
    isServing(env) &&
    env.TRUST_PROXY_HEADERS !== "true" &&
    /^https:\/\//.test(url)
  )
    warnings.push(
      "TRUST_PROXY_HEADERS is not true although APP_URL is https: per-address login throttling is inert until a proxy is trusted.",
    );
  if (
    env.TRUST_PROXY_HEADERS === "true" &&
    isServing(env) &&
    !/^https:\/\//.test(url)
  )
    warnings.push(
      "TRUST_PROXY_HEADERS is true but APP_URL is not https: forwarded headers are trusted on a plaintext deployment.",
    );
  if (env.METRICS_TOKEN && env.METRICS_TOKEN.length < 24)
    warnings.push("METRICS_TOKEN is shorter than 24 characters.");
  return warnings;
}
