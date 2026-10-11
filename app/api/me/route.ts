import { currentUser } from "@/lib/auth";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return Response.json({ error: "Log masuk diperlukan." }, { status: 401 });
  return Response.json(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
