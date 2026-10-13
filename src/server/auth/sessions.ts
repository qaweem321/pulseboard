import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { highestRole, type Role } from "@/lib/roles";
import type { Db } from "../db";
import { sessions, users } from "../db/schema";
import type { OidcIdentity } from "./oidc";

export const SESSION_COOKIE = "pb_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  role: Role | null;
  idToken: string | null;
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// Saves the user and opens a session. Returns the raw token for the cookie; only its hash is stored.
export async function createSession(db: Db, identity: OidcIdentity, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await db
    .insert(users)
    .values({ sub: identity.sub, email: identity.email, name: identity.name, lastLoginAt: now })
    .onConflictDoUpdate({
      target: users.sub,
      set: { email: identity.email, name: identity.name, lastLoginAt: now },
    });
  await db.insert(sessions).values({
    id: hash(token),
    userSub: identity.sub,
    roles: identity.roles,
    idToken: identity.idToken ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function findSession(db: Db, token: string, now = new Date()): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      sub: users.sub,
      email: users.email,
      name: users.name,
      roles: sessions.roles,
      idToken: sessions.idToken,
    })
    .from(sessions)
    .innerJoin(users, eq(users.sub, sessions.userSub))
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  return {
    sub: row.sub,
    email: row.email,
    name: row.name,
    role: highestRole(row.roles),
    idToken: row.idToken,
  };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hash(token)));
}
