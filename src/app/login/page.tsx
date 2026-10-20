import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { safeNextPath } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  expired: "Your sign-in took too long or was started in another browser. Please try again.",
  failed: "We couldn't sign you in. Please try again.",
  provider_unavailable:
    "The sign-in service (Keycloak) isn't reachable right now. Please try again in a minute.",
  rate_limited: "Too many sign-in attempts. Wait a minute and try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await currentUser()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const expired = params.expired === "1";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use your organization&apos;s single sign-on account.</p>
          {(error || expired) && (
            <p role="alert" className="mt-4 rounded-lg bg-down/10 px-3 py-2 text-sm text-down">
              {error ?? "Your session expired. Please sign in again."}
            </p>
          )}
          <a
            href={`/api/auth/login?next=${encodeURIComponent(next)}`}
            className="mt-6 block rounded-lg bg-brand px-4 py-2.5 text-center font-semibold text-on-brand no-underline"
          >
            Continue with Keycloak
          </a>
        </div>
      </div>
    </main>
  );
}
