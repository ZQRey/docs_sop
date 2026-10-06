import path from "node:path";
import { mkdir, unlink } from "node:fs/promises";
export const root = path.resolve(process.env.STORAGE_PATH || "./storage");
export async function initializeStorage() {
  await Promise.all(
    ["originals", "pdf"].map((dir) =>
      mkdir(path.join(root, dir), { recursive: true }),
    ),
  );
}
export function storagePath(relative: string) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root + path.sep))
    throw new Error("Invalid storage path");
  return resolved;
}
export async function removeFiles(paths: string[]) {
  for (const file of new Set(paths))
    await unlink(storagePath(file)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
}
