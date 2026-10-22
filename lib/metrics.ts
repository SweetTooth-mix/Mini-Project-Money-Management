// In-process request metrics, rendered in the Prometheus text format.
//
// Everything here is pure bookkeeping: no timers, no I/O, no imports from the
// framework, so the whole module is unit tested. The HTTP layer feeds it (see
// lib/metrics-http.ts) and /api/metrics renders it.

export const durationBuckets = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

// Bounded on purpose: a metrics endpoint that grows without limit is a memory
// leak with a nice name. Anything beyond this lands in route="other".
export const maxSeries = 200;

export type HttpSample = {
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

type Series = {
  method: string;
  route: string;
  buckets: number[];
  sum: number;
  count: number;
  statuses: Map<string, number>;
};

export function normalizeMethod(value: string): string {
  const method = value.toUpperCase();
  return ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method)
    ? method
    : "OTHER";
}

// Keeps label values bounded and readable: query strings and ids differ on
// every request and would otherwise create one time series per document.
export function normalizeRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) return "/";
  const normalized = segments.map((segment, index) =>
    index > 0 && looksLikeId(segment) ? ":id" : segment.slice(0, 40),
  );
  const route = "/" + normalized.join("/");
  return route.length > 120 ? "/other" : route;
}

function looksLikeId(segment: string): boolean {
  return (
    /^\d+$/.test(segment) ||
    /^c[a-z0-9]{20,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    )
  );
}

export function statusClass(status: number): string {
  if (!Number.isFinite(status) || status < 100) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

export function escapeLabel(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll('"', '\\"');
}

export class MetricsRegistry {
  private series = new Map<string, Series>();
  private errors = new Map<string, number>();
  private dropped = 0;
  private startedAt = Date.now();

  record({ method, route, status, durationMs }: HttpSample) {
    const label = `${normalizeMethod(method)} ${route}`;
    let entry = this.series.get(label);
    if (!entry) {
      if (this.series.size >= maxSeries) {
        this.dropped += 1;
        return;
      }
      entry = {
        method: normalizeMethod(method),
        route,
        buckets: durationBuckets.map(() => 0),
        sum: 0,
        count: 0,
        statuses: new Map(),
      };
      this.series.set(label, entry);
    }
    const seconds = Math.max(0, durationMs) / 1000;
    durationBuckets.forEach((bound, index) => {
      if (seconds <= bound) entry.buckets[index] += 1;
    });
    entry.sum += seconds;
    entry.count += 1;
    const bucket = statusClass(status);
    entry.statuses.set(bucket, (entry.statuses.get(bucket) ?? 0) + 1);
  }

  recordError(route: string) {
    const key = route || "/unknown";
    this.errors.set(key, (this.errors.get(key) ?? 0) + 1);
  }

  snapshot(now = Date.now()) {
    const requests = [...this.series.values()].flatMap((entry) =>
      [...entry.statuses.entries()].map(([status, count]) => ({
        method: entry.method,
        route: entry.route,
        status,
        count,
      })),
    );
    const durations = [...this.series.values()].map((entry) => ({
      method: entry.method,
      route: entry.route,
      buckets: [...entry.buckets],
      sum: entry.sum,
      count: entry.count,
    }));
    return {
      requests,
      durations,
      errors: [...this.errors.entries()].map(([route, count]) => ({
        route,
        count,
      })),
      dropped: this.dropped,
      uptimeSeconds: Math.max(0, (now - this.startedAt) / 1000),
    };
  }

  render(now = Date.now()): string {
    const snapshot = this.snapshot(now);
    const lines: string[] = [];

    lines.push(
      "# HELP kira_http_requests_total Completed HTTP requests by method, route and status class.",
      "# TYPE kira_http_requests_total counter",
    );
    for (const row of sortRows(snapshot.requests))
      lines.push(
        `kira_http_requests_total{method="${escapeLabel(row.method)}",route="${escapeLabel(row.route)}",status="${row.status}"} ${row.count}`,
      );

    lines.push(
      "# HELP kira_http_request_duration_seconds Request duration in seconds.",
      "# TYPE kira_http_request_duration_seconds histogram",
    );
    for (const row of sortRows(snapshot.durations)) {
      const labels = `method="${escapeLabel(row.method)}",route="${escapeLabel(row.route)}"`;
      durationBuckets.forEach((bound, index) =>
        lines.push(
          `kira_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${row.buckets[index]}`,
        ),
      );
      lines.push(
        `kira_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${row.count}`,
      );
      lines.push(
        `kira_http_request_duration_seconds_sum{${labels}} ${row.sum}`,
      );
      lines.push(
        `kira_http_request_duration_seconds_count{${labels}} ${row.count}`,
      );
    }

    lines.push(
      "# HELP kira_request_errors_total Unhandled server errors reported by the instrumentation hook.",
      "# TYPE kira_request_errors_total counter",
    );
    for (const row of snapshot.errors.sort(
      (a, b) => a.route.localeCompare(b.route) || a.count - b.count,
    ))
      lines.push(
        `kira_request_errors_total{route="${escapeLabel(row.route)}"} ${row.count}`,
      );

    lines.push(
      "# HELP kira_metrics_dropped_series_total Requests ignored after the series limit was reached.",
      "# TYPE kira_metrics_dropped_series_total counter",
      `kira_metrics_dropped_series_total ${snapshot.dropped}`,
      "# HELP kira_process_uptime_seconds Seconds since the process started collecting metrics.",
      "# TYPE kira_process_uptime_seconds gauge",
      `kira_process_uptime_seconds ${snapshot.uptimeSeconds.toFixed(3)}`,
    );

    return lines.join("\n") + "\n";
  }

  reset() {
    this.series.clear();
    this.errors.clear();
    this.dropped = 0;
    this.startedAt = Date.now();
  }
}

function sortRows<T extends { method: string; route: string }>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      a.route.localeCompare(b.route) ||
      a.method.localeCompare(b.method) ||
      ("status" in a && "status" in b
        ? String(a.status).localeCompare(String(b.status))
        : 0),
  );
}

// One registry per process, pinned to globalThis: Next.js can bundle the
// instrumentation hook and the route handler separately, and two module
// instances would mean /api/metrics always renders an empty registry. Values
// are still lost on restart, like any in-process counter.
const globalMetrics = globalThis as unknown as {
  kiraMetrics?: MetricsRegistry;
};
if (!globalMetrics.kiraMetrics)
  globalMetrics.kiraMetrics = new MetricsRegistry();
export const metrics = globalMetrics.kiraMetrics;
