import { createHmac } from "node:crypto";
import type { AlertChannel } from "../db/schema";
import { alertText, buildRequest, sendAlert, type AlertEvent } from "./alerts";
import type { Requester } from "./check";

const channel = (extra: Partial<AlertChannel> = {}): AlertChannel => ({
  id: 1,
  name: "Ops",
  kind: "webhook",
  url: "https://hooks.example.com/pulse",
  secret: "s3cret",
  enabled: true,
  createdAt: new Date(),
  ...extra,
});

const down: AlertEvent = {
  event: "down",
  monitor: { id: 7, name: "API", url: "https://api.example.com" },
  incident: {
    id: 3,
    startedAt: new Date("2026-10-11T10:00:00Z"),
    resolvedAt: null,
    cause: "Connection refused",
  },
};

const up: AlertEvent = {
  ...down,
  event: "up",
  incident: { ...down.incident!, resolvedAt: new Date("2026-10-11T10:42:00Z") },
};

test("alert text says what happened and for how long", () => {
  expect(alertText(down)).toBe("🔴 API is DOWN (https://api.example.com). Cause: Connection refused.");
  expect(alertText(up)).toBe("🟢 API is back UP after 42 min (https://api.example.com).");
});

test("slack and discord get their own payload shapes", () => {
  expect(JSON.parse(buildRequest(channel({ kind: "slack" }), down).body)).toEqual({ text: alertText(down) });
  expect(JSON.parse(buildRequest(channel({ kind: "discord" }), down).body)).toEqual({
    content: alertText(down),
  });
});

test("webhooks are signed with a timestamped HMAC", () => {
  const now = new Date("2026-10-11T10:00:05Z");
  const { body, headers } = buildRequest(channel(), down, now);
  const [t, v1] = headers["x-pulseboard-signature"]!.split(",");
  const seconds = now.getTime() / 1000;
  expect(t).toBe(`t=${seconds}`);
  expect(v1).toBe(`v1=${createHmac("sha256", "s3cret").update(`${seconds}.${body}`).digest("hex")}`);
  expect(JSON.parse(body)).toMatchObject({
    event: "down",
    incident: { startedAt: "Oct 11, 2026, 10:00 UTC" },
  });
});

test("webhooks without a secret are sent unsigned", () => {
  expect(buildRequest(channel({ secret: null }), down).headers["x-pulseboard-signature"]).toBeUndefined();
});

test("sendAlert reports failures instead of throwing", async () => {
  const policy = { allowHosts: [], allowHttp: false };
  const rejecting: Requester = async () => {
    throw new Error("socket hang up");
  };
  const status500: Requester = async () => ({
    status: 500,
    headers: {},
    body: new Uint8Array(),
    url: "",
    truncated: false,
  });
  expect(await sendAlert(channel(), down, policy, rejecting)).toEqual({
    channelId: 1,
    ok: false,
    error: "socket hang up",
  });
  expect(await sendAlert(channel(), down, policy, status500)).toEqual({
    channelId: 1,
    ok: false,
    error: "HTTP 500",
  });
});
