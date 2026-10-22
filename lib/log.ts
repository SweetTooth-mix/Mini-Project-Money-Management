/**
 * Structured logging.
 *
 * Every line is a single JSON object on stdout, so journald, Docker, Loki or
 * any log shipper can index it without parsing. Values are redacted and
 * truncated before they leave the process: log lines must never carry
 * credentials, session tokens or long user content.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const LOG_LEVELS = Object.keys(ORDER) as LogLevel[];

export function logLevelFromEnv(value?: string): LogLevel {
  const candidate = (value ?? "info").trim().toLowerCase();
  return (LOG_LEVELS as string[]).includes(candidate)
    ? (candidate as LogLevel)
    : "info";
}

export function levelEnabled(level: LogLevel, threshold: LogLevel) {
  return ORDER[level] >= ORDER[threshold];
}

/** Keys whose values must never be written to a log line. */
const SECRET_KEY =
  /pass|secret|token|cookie|authorization|session|database_url|dsn|api[-_]?key|key/i;
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_ARRAY = 20;

/** Remove credentials and cap size without mutating the caller's object. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string")
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[truncated ${value.length - MAX_STRING}]`
      : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (depth >= MAX_DEPTH) return "[depth limit]";
  if (Array.isArray(value))
    return value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      output[key] = SECRET_KEY.test(key)
        ? "[redacted]"
        : redact(item, depth + 1);
    return output;
  }
  return String(value);
}

export type SerializedError = {
  name: string;
  message: string;
  code?: string;
  stack?: string[];
};

export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error))
    return {
      name: "UnknownError",
      message: String(error).slice(0, MAX_STRING),
    };
  const code = (error as { code?: unknown }).code;
  const stack = error.stack?.split("\n").slice(0, 8);
  return {
    name: error.name,
    message: error.message.slice(0, MAX_STRING),
    ...(typeof code === "string" || typeof code === "number"
      ? { code: String(code) }
      : {}),
    ...(stack ? { stack } : {}),
  };
}

export type LogRecord = {
  time: string;
  level: LogLevel;
  message: string;
  service: string;
  [field: string]: unknown;
};

export function createRecord(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
  now: Date = new Date(),
  service = process.env.SERVICE_NAME ?? "kira-rapi",
): LogRecord {
  const { err, error, ...rest } = fields;
  return {
    time: now.toISOString(),
    level,
    message,
    service,
    ...(redact(rest) as Record<string, unknown>),
    ...(error !== undefined || err !== undefined
      ? { err: serializeError(error ?? err) }
      : {}),
  };
}

export type ErrorNotifier = (record: LogRecord) => Promise<void> | void;

/**
 * Optional error forwarding. Set ERROR_WEBHOOK_URL to receive error records as
 * JSON POSTs (a collector, a chat webhook, or an error tracker's ingest URL).
 * Failures are swallowed: reporting must never break a request.
 */
export function createNotifier(
  url: string | undefined,
  fetchImpl: typeof fetch | null | undefined = globalThis.fetch,
  timeoutMs = 2000,
): ErrorNotifier | null {
  if (!url || !fetchImpl) return null;
  return async (record) => {
    try {
      await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Deliberately silent: the log line already reached stdout.
    }
  };
}

let notifier: ErrorNotifier | null | undefined;

const getNotifier = () => {
  if (notifier === undefined)
    notifier = createNotifier(process.env.ERROR_WEBHOOK_URL);
  return notifier;
};

/** Write one structured line. Exposed for tests through `emitTo`. */
export function emit(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
  write: (line: string) => void = (line) => process.stdout.write(line),
) {
  if (!levelEnabled(level, logLevelFromEnv(process.env.LOG_LEVEL))) return;
  const record = createRecord(level, message, fields);
  write(`${JSON.stringify(record)}\n`);
  if (level === "error") {
    const forward = getNotifier();
    if (forward) void forward(record);
  }
  return record;
}

export const log = {
  debug: (message: string, fields?: Record<string, unknown>) =>
    emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) =>
    emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) =>
    emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) =>
    emit("error", message, fields),
};

/**
 * Log an unexpected failure. Use for errors the user should not see verbatim,
 * and pass a stable `event` name so alerts can be grouped.
 */
export function logError(
  event: string,
  error: unknown,
  fields: Record<string, unknown> = {},
) {
  return log.error(event, { ...fields, err: error });
}
