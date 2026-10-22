import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const currentUser = cache(async () => {
  const token = (await cookies()).get("kira_session")?.value;
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  )
    return null;
  const { passwordHash: _, ...user } = session.user;
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Cross-user data — the activity trail — is for managers. A plain user is sent
 * back to the dashboard instead of seeing a permission error page.
 */
export async function requireManager() {
  const user = await requireUser();
  if (user.role === "USER") redirect("/dashboard");
  return user;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db.session.create({
    data: { userId, tokenHash: hash(token), expiresAt },
  });
  (await cookies()).set("kira_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    expires: expiresAt,
    path: "/",
  });
}

export async function endSession() {
  const cookieJar = await cookies();
  const token = cookieJar.get("kira_session")?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  cookieJar.delete("kira_session");
}
