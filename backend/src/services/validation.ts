export function validSignature(extension: string, bytes: Buffer): boolean {
  if (extension === ".pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (extension === ".doc")
    return bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"));
  return (
    extension === ".docx" &&
    bytes.subarray(0, 4).equals(Buffer.from("504b0304", "hex"))
  );
}
