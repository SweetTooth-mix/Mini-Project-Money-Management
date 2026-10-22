import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Only accept IDs that are safe to echo into a header and a log line.
 * Anything else is replaced, so a forged header cannot inject content.
 */
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && VALID.test(value);
}

export function newRequestId() {
  return randomUUID();
}

/**
 * Reuse an upstream request ID (nginx, a proxy or the platform) so one trace
 * spans hops, otherwise start a new one.
 */
export function requestIdFrom(request: Request): string {
  const header = request.headers.get(REQUEST_ID_HEADER);
  return isRequestId(header) ? header : newRequestId();
}

/** Headers to attach to a response so the caller can quote the ID in a report. */
export function responseHeaders(requestId: string): Record<string, string> {
  return { [REQUEST_ID_HEADER]: requestId };
}
