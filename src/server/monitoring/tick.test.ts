import type { Db } from "../db";
import { alertChannels, alertDeliveries, monitors } from "../db/schema";
import { createTestDb } from "../testing/db";
import { createMonitor, resetDb } from "../testing/factories";
import type { Requester } from "./check";
import { tick } from "./tick";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(() => resetDb(db));

const policy = { allowHosts: [], allowHttp: true };

test("a failing monitor goes down and every enabled channel is alerted once", async () => {
  await createMonitor(db, { name: "API", url: "https://api.example.com", status: "up", failureThreshold: 1 });
  await db.insert(alertChannels).values([
    { name: "Slack", kind: "slack", url: "https://hooks.slack.com/x" },
    { name: "Off", kind: "discord", url: "https://discord.com/api/webhooks/x", enabled: false },
  ]);
  const sent: string[] = [];
  const request: Requester = async (url, options) => {
    if (String(url).startsWith("https://api.example.com")) {
      return { status: 502, headers: {}, body: new Uint8Array(), url: String(url), truncated: false };
    }
    sent.push(`${options?.method} ${String(url)} ${String(options?.body)}`);
    return { status: 200, headers: {}, body: new Uint8Array(), url: String(url), truncated: false };
  };

  expect(await tick(db, { policy, request })).toEqual({ checked: 1, alerts: 1 });
  expect(sent).toEqual([
    'POST https://hooks.slack.com/x {"text":"🔴 API is DOWN (https://api.example.com). Cause: Unexpected status 502."}',
  ]);
  expect(await db.select().from(alertDeliveries)).toMatchObject([{ event: "down", ok: true }]);
  const [monitor] = await db.select().from(monitors);
  expect(monitor?.status).toBe("down");

  // Not due again yet: nothing to do.
  expect(await tick(db, { policy, request })).toEqual({ checked: 0, alerts: 0 });
});
