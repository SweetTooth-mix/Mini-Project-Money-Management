import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { excelData, reportKinds } from "@/lib/excel";
import { DomainError } from "@/lib/money";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const run = promisify(execFile);
let active = 0;
const schema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12).default(1),
  format: z.enum(["zip", "pdf", "xlsx"]).default("zip"),
  report: z.enum(reportKinds).default("monthly"),
  document: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .optional(),
  gab: z.string().max(100).optional(),
  tumpang: z.string().max(100).optional(),
  rohani: z.string().max(100).optional(),
  tunjang: z.string().max(100).optional(),
});

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!(await currentUser()))
    return Response.json(
      { error: "Sila log masuk." },
      { status: 401, headers },
    );
  const parsed = schema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Pilihan laporan tidak sah." },
      { status: 400, headers },
    );
  const options = parsed.data;
  if (
    (options.format === "xlsx" || options.report === "document") &&
    !options.document
  )
    return Response.json(
      { error: "Pilih dokumen terlebih dahulu." },
      { status: 400, headers },
    );
  if (
    options.document &&
    (options.report !== "document" || options.format === "zip")
  )
    return Response.json(
      { error: "Format dokumen tidak sah." },
      { status: 400, headers },
    );
  if (active >= 2)
    return Response.json(
      { error: "Penjana sedang digunakan. Cuba lagi sebentar." },
      { status: 429, headers },
    );
  active++;
  let dir: string | undefined;
  try {
    const data = await excelData(options);
    dir = await mkdtemp(path.join(tmpdir(), "kira-report-"));
    const input = path.join(dir, "input.json"),
      output = path.join(dir, `output.${options.format}`);
    await writeFile(input, JSON.stringify(data), { mode: 0o600 });
    await run(
      process.env.EXCEL_PYTHON || ".venv/bin/python",
      [
        path.join(process.cwd(), "scripts/excel/generate.py"),
        input,
        output,
        "--format",
        options.format,
        "--report",
        options.report,
        "--month",
        String(options.month),
        ...(options.document ? ["--document", options.document] : []),
      ],
      { timeout: 110_000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const bytes = await readFile(output);
    const mime = {
      zip: "application/zip",
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[options.format];
    return new Response(bytes, {
      headers: {
        ...headers,
        "Content-Type": mime,
        "Content-Disposition": `${options.format === "pdf" ? "inline" : "attachment"}; filename="Kira-Rapi-${options.year}-${options.report}.${options.format}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError)
      return Response.json({ error: error.message }, { status: 400, headers });
    // Worker stderr can contain record values or paths; never expose it to a client or logs.
    console.error(
      "Report generation failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json(
      {
        error:
          "Laporan gagal dijana. Semak pemasangan Python/openpyxl dan LibreOffice pada server, kemudian cuba lagi.",
      },
      { status: 503, headers },
    );
  } finally {
    active--;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
