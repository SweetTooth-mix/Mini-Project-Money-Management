import { db } from "./db";
import { param, type Search } from "./queries";
import { auditFilters, auditPageSize, auditWhere } from "./audit-filters";

export {
  auditFilters,
  auditPageSize,
  auditWhere,
  type AuditFilters,
} from "./audit-filters";

export const auditExportLimit = 50_000;

const order = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export async function auditData(search: Search) {
  const filters = auditFilters(search);
  const where = auditWhere(filters);
  const requested = Math.max(
    1,
    Math.min(100000, Number.parseInt(param(search, "page")) || 1),
  );
  // Count first so an out-of-range page lands on the last page instead of
  // showing an empty table with no explanation.
  const [count, users, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(count / auditPageSize));
  const page = Math.min(pages, requested);
  const logs = await db.auditLog.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: order,
    skip: (page - 1) * auditPageSize,
    take: auditPageSize,
  });
  return {
    filters,
    logs,
    count,
    page,
    pages,
    users,
    actions: actions.map((row) => row.action),
  };
}

/** Rows for the CSV export. The audit log is read-only, so this is a plain read. */
export async function auditExportRows(search: Search) {
  const filters = auditFilters(search);
  return db.auditLog.findMany({
    where: auditWhere(filters),
    include: { user: { select: { name: true, email: true } } },
    orderBy: order,
    take: auditExportLimit,
  });
}
