/**
 * Canonical **content hash** invariant: **SHA-256** over bytes, **lowercase hex** (64 chars).
 * String content uses **UTF-8** (`TextEncoder`), matching Node `createHash("sha256").update(string)`.
 *
 * Implemented with **Web Crypto** (`globalThis.crypto.subtle`) — browsers and **Node 19+**
 * (txtatelier CLI targets Node ≥22).
 */

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

/**
 * SHA-256 hex digest of raw bytes.
 */
export const computeHash = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes),
  );
  return bytesToHex(new Uint8Array(digest));
};

/**
 * SHA-256 hex digest of string content (UTF-8).
 */
export const computeContentHash = async (content: string): Promise<string> => {
  const encoded = new TextEncoder().encode(content);
  return computeHash(encoded);
};
