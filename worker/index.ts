import { closeDb, db } from "@/server/db";
import { env } from "@/server/env";
import { pruneOldData } from "@/server/monitoring/scheduler";
import { tick } from "@/server/monitoring/tick";

const TICK_MS = 2_000;
const PRUNE_MS = 60 * 60 * 1000;

const config = env();
const policy = { allowHosts: config.MONITOR_ALLOW_HOSTS, allowHttp: config.MONITOR_ALLOW_HTTP };
let stopping = false;
let lastPrune = 0;

function log(level: "info" | "error", message: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, message, ...extra }));
}

async function loop() {
  log("info", "worker started", { allowHosts: policy.allowHosts, allowHttp: policy.allowHttp });
  while (!stopping) {
    const started = Date.now();
    try {
      const result = await tick(db(), { policy });
      if (result.checked > 0) log("info", "tick", { ...result, ms: Date.now() - started });
      if (started - lastPrune > PRUNE_MS) {
        await pruneOldData(db(), config.CHECK_RETENTION_DAYS);
        lastPrune = started;
      }
    } catch (error) {
      log("error", "tick failed", { error: error instanceof Error ? error.message : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, TICK_MS - (Date.now() - started))));
  }
  await closeDb();
  log("info", "worker stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

void loop();
