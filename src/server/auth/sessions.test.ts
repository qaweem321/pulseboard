import type { Db } from "../db";
import { sessions, users } from "../db/schema";
import { createTestDb } from "../testing/db";
import { resetDb } from "../testing/factories";
import { createSession, deleteSession, findSession } from "./sessions";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(() => resetDb(db));

const identity = {
  sub: "kc-123",
  email: "ada@example.com",
  name: "Ada",
  roles: ["offline_access", "editor"],
  idToken: "id.token.here",
};

test("a session round-trips and resolves the highest role", async () => {
  const { token } = await createSession(db, identity);
  expect(await findSession(db, token)).toEqual({
    sub: "kc-123",
    email: "ada@example.com",
    name: "Ada",
    role: "editor",
    idToken: "id.token.here",
  });
});

test("only a hash of the token is stored", async () => {
  const { token } = await createSession(db, identity);
  const [row] = await db.select().from(sessions);
  expect(row!.id).not.toBe(token);
  expect(row!.id).toMatch(/^[0-9a-f]{64}$/);
});

test("expired, unknown and deleted sessions are rejected", async () => {
  const now = new Date("2026-10-11T00:00:00Z");
  const { token } = await createSession(db, identity, now);
  expect(await findSession(db, token, new Date("2026-10-11T09:00:00Z"))).toBeNull();
  expect(await findSession(db, "nope", now)).toBeNull();
  await deleteSession(db, token);
  expect(await findSession(db, token, now)).toBeNull();
});

test("logging in again updates the user's profile", async () => {
  await createSession(db, identity);
  await createSession(db, { ...identity, name: "Ada Lovelace", roles: ["viewer"] });
  expect(await db.select({ name: users.name }).from(users)).toEqual([{ name: "Ada Lovelace" }]);
});
