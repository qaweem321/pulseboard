import { closeDb, db } from "@/server/db";
import { hasMonitors, seedDemo } from "@/server/demo-seed";

// Adds demo monitors with 90 days of synthetic history. Does nothing if monitors already exist.
try {
  if (await hasMonitors(db())) {
    console.log("Monitors already exist; skipping the demo seed.");
  } else {
    const result = await seedDemo(db());
    console.log(
      `Seeded ${result.monitors} monitors, ${result.checks} checks and ${result.incidents} incidents.`,
    );
  }
} finally {
  await closeDb();
}
