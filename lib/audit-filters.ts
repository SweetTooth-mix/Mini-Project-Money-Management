import { dateOnly } from "./money";
import { param, type Search } from "./search";

/** Audit rows shown per page in the dashboard. */
export const auditPageSize = 30;

/** Malaysia is UTC+8 all year; audit timestamps are displayed in this zone. */
const KL_OFFSET = "+08:00";

export type AuditFilters = {
  query: string;
  userId: string;
  action: string;
  from: string;
  to: string;
};

const safeDate = (value: string) => {
  if (!value) return "";
  try {
    dateOnly(value);
    return value;
  } catch {
    return "";
  }
};

/**
 * Normalise audit filters from the URL. Invalid dates are ignored rather than
 * throwing, so a stale bookmark still renders. A reversed range is swapped
 * instead of silently returning nothing.
 */
export function auditFilters(search: Search): AuditFilters {
  let from = safeDate(param(search, "from"));
  let to = safeDate(param(search, "to"));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    query: param(search, "q").trim().slice(0, 200),
    userId: param(search, "user").slice(0, 40),
    action: param(search, "action").slice(0, 60),
    from,
    to,
  };
}

/** Prisma filter shared by the page and the CSV export. */
export function auditWhere(filters: AuditFilters) {
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from
              ? { gte: new Date(`${filters.from}T00:00:00.000${KL_OFFSET}`) }
              : {}),
            ...(filters.to
              ? { lte: new Date(`${filters.to}T23:59:59.999${KL_OFFSET}`) }
              : {}),
          },
        }
      : {}),
    ...(filters.query
      ? {
          OR: [
            {
              detail: { contains: filters.query, mode: "insensitive" as const },
            },
            {
              user: {
                name: { contains: filters.query, mode: "insensitive" as const },
              },
            },
            {
              action: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}
