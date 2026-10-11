import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "./money";

// Uploads are runtime data, never build inputs or bundled source files.
const directory = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR || ".data/uploads",
  );
export async function storeUpload(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size || value.size > 5 * 1024 * 1024)
    throw new DomainError("Pilih fail PDF, PNG, atau JPEG (maksimum 5 MB).");
  const bytes = Buffer.from(await value.arrayBuffer());
  let mimeType: string, extension: string;
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    mimeType = "application/pdf";
    extension = "pdf";
  } else if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mimeType = "image/png";
    extension = "png";
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mimeType = "image/jpeg";
    extension = "jpg";
  } else throw new DomainError("Kandungan fail mesti PDF, PNG, atau JPEG.");
  const storedName = `${randomUUID()}.${extension}`;
  const fileName =
    path
      .basename(value.name)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 180) || `lampiran.${extension}`;
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  await writeFile(
    /* turbopackIgnore: true */ path.join(
      /* turbopackIgnore: true */ directory(),
      storedName,
    ),
    bytes,
    { mode: 0o600, flag: "wx" },
  );
  return { storedName, fileName, mimeType, size: bytes.length };
}
function location(storedName: string) {
  if (!/^[a-f0-9-]+\.(pdf|png|jpg)$/.test(storedName))
    throw new DomainError("Fail tidak sah.");
  return path.join(/* turbopackIgnore: true */ directory(), storedName);
}
export const readUpload = (storedName: string) =>
  readFile(/* turbopackIgnore: true */ location(storedName));
export const deleteUpload = (storedName: string) =>
  unlink(location(storedName)).catch(() => {});
