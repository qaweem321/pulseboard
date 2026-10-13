// Runs once when the server starts: fail fast on a bad configuration instead of on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("./server/env");
    env();
  }
}
