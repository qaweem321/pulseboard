import { z } from "zod";

const list = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Public URL of this app, used for OIDC redirects.
  APP_URL: z.string().url(),
  // Keycloak realm URL, e.g. http://localhost:8080/realms/pulseboard
  OIDC_ISSUER: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  // Encrypts the short-lived login cookie. Generate with `openssl rand -base64 32`.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  // Internal hosts monitors may reach. Everything private is blocked by default (SSRF protection).
  MONITOR_ALLOW_HOSTS: list,
  // Plain http:// monitors are allowed by default; set to "false" to require https.
  MONITOR_ALLOW_HTTP: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  CHECK_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Validates on first use and fails with every problem listed, not just the first one.
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}
