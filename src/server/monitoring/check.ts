import { safeRequest, SsrfError } from "@qaweem321/no-ssrf/node";
import { parseStatusRanges, statusMatches } from "@/lib/status-codes";
import type { Monitor } from "../db/schema";
import type { CheckOutcome } from "./transition";

export type CheckTarget = Pick<Monitor, "url" | "method" | "expectedStatus" | "keyword" | "timeoutMs">;

export type NetworkPolicy = {
  allowHosts: readonly string[];
  allowHttp: boolean;
};

export type Requester = typeof safeRequest;

// Runs one check. Never throws: every failure becomes an outcome with an error message.
export async function runCheck(
  target: CheckTarget,
  policy: NetworkPolicy,
  request: Requester = safeRequest,
): Promise<CheckOutcome> {
  const ranges = parseStatusRanges(target.expectedStatus);
  if (!ranges) return failure(`Invalid expected status "${target.expectedStatus}"`);
  const started = performance.now();
  try {
    const response = await request(target.url, {
      method: target.method,
      headers: { "user-agent": "Pulseboard/1.0 (+uptime monitor)", accept: "*/*" },
      timeoutMs: target.timeoutMs,
      maxRedirects: 5,
      // Monitors only need enough of the body to find a keyword.
      maxResponseBytes: target.keyword ? 1_000_000 : 64_000,
      allowHosts: policy.allowHosts,
      allowHttp: policy.allowHttp,
    });
    const responseMs = Math.round(performance.now() - started);
    if (!statusMatches(ranges, response.status)) {
      return {
        ok: false,
        statusCode: response.status,
        responseMs,
        error: `Unexpected status ${response.status}`,
      };
    }
    if (target.keyword && target.method !== "HEAD") {
      const body = new TextDecoder().decode(response.body);
      if (!body.includes(target.keyword)) {
        return {
          ok: false,
          statusCode: response.status,
          responseMs,
          error: `Keyword "${target.keyword}" not found`,
        };
      }
    }
    return { ok: true, statusCode: response.status, responseMs, error: null };
  } catch (error) {
    if (error instanceof SsrfError) return failure(`Blocked by network policy: ${error.message}`);
    return failure(describeError(error));
  }
}

function failure(error: string): CheckOutcome {
  return { ok: false, statusCode: null, responseMs: null, error };
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  const code = (error as NodeJS.ErrnoException).code;
  const messages: Record<string, string> = {
    ENOTFOUND: "DNS lookup failed",
    ECONNREFUSED: "Connection refused",
    ECONNRESET: "Connection reset",
    ETIMEDOUT: "Connection timed out",
    CERT_HAS_EXPIRED: "TLS certificate has expired",
    DEPTH_ZERO_SELF_SIGNED_CERT: "Self-signed TLS certificate",
    ERR_TLS_CERT_ALTNAME_INVALID: "TLS certificate does not match the host",
  };
  return (code && messages[code]) ?? error.message;
}
