import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

// Encrypts small JSON payloads (the login transaction) into a tamper-proof cookie value.
function key(secret: string) {
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

export async function seal(payload: Record<string, unknown>, secret: string, maxAgeSeconds: number) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(key(secret));
}

export async function unseal<T>(token: string, secret: string): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, key(secret));
    return payload as T;
  } catch {
    return null;
  }
}
