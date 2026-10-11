import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentUser()))
    return Response.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const record = await db.attachment.findUnique({
    where: { id: (await params).id },
  });
  if (!record)
    return Response.json({ error: "Fail tidak dijumpai." }, { status: 404 });
  try {
    const file = await readUpload(record.storedName);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return Response.json({ error: "Fail tidak tersedia." }, { status: 404 });
  }
}
