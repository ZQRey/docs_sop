import { readFile, writeFile } from "node:fs/promises";
import { storagePath } from "./storage.service";
export async function convert(
  original: string,
  output: string,
  filename: string,
) {
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(await readFile(storagePath(original)))]),
    filename,
  );
  const response = await fetch(
    `${process.env.GOTENBERG_URL || "http://gotenberg:3000"}/forms/libreoffice/convert`,
    { method: "POST", body: form, signal: AbortSignal.timeout(120000) },
  );
  if (!response.ok)
    throw Object.assign(new Error("Не удалось конвертировать документ"), {
      status: 502,
    });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Invalid converter response");
  await writeFile(storagePath(output), bytes);
}
