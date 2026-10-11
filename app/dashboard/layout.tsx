import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [organization, pending] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: "main" } }),
    db.document.count({ where: { status: "PENDING" } }),
  ]);
  return (
    <Shell
      name={user.name}
      role={user.role}
      organization={organization.name}
      pending={pending}
      demo={process.env.SEED_DEMO === "true"}
    >
      {children}
    </Shell>
  );
}
