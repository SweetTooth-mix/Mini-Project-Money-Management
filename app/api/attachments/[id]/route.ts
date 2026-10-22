import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";
import { log } from "@/lib/log";
import { requestIdFrom, responseHeaders } from "@/lib/request-id";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
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
        ...responseHeaders(requestId),
      },
    });
  } catch (error) {
    // Neither the stored name nor the filesystem path reaches the response or
    // the log line; the attachment ID is enough to investigate.
    log.error("attachment.read_failed", {
      requestId,
      attachmentId: record.id,
      errCode: (error as { code?: string }).code,
    });
    return Response.json(
      { error: "Fail tidak tersedia." },
      { status: 404, headers: responseHeaders(requestId) },
    );
  }
}
