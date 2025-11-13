// convex/lib/hash.ts

/**
 * Generates a SHA-256 hex digest using the Web Crypto API available in Convex functions.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Crypto API not available");
  }

  const digest = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
