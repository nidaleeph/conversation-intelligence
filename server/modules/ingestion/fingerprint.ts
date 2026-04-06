import crypto from "node:crypto";

export function generateFingerprint(
  rawText: string,
  senderName: string,
  sourceGroup: string
): string {
  const normalized = rawText
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const input = `${normalized}|${senderName.toLowerCase()}|${sourceGroup.toLowerCase()}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}
