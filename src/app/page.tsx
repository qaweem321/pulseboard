import Link from "next/link";
import { Logo } from "@/components/logo";
import { currentUser } from "@/server/auth/current-user";

const FEATURES = [
  {
    title: "Checks that don't cry wolf",
    body: "HTTP checks every 30 seconds to an hour, with status ranges, keyword matching and a failure threshold so one blip doesn't page anyone.",
  },
  {
    title: "Incidents, opened and closed for you",
    body: "A monitor that goes down opens an incident and alerts Slack, Discord or a signed webhook. Recovery closes it and tells you how long it lasted.",
  },
  {
    title: "Public status pages",
    body: "90-day uptime bars and incident updates your customers can read, without exposing internal URLs or error messages.",
  },
  {
    title: "Single sign-on with Keycloak",
    body: "OpenID Connect with PKCE. Viewer, editor and admin roles come straight from your Keycloak realm.",
  },
  {
    title: "Safe by default",
    body: "Monitor URLs can't reach your private network (SSRF protection) unless you allowlist a host.",
  },
  {
    title: "Yours to run",
    body: "One docker compose up: Postgres, Keycloak, the web app and a worker that scales out with SKIP LOCKED.",
  },
];

export default async function LandingPage() {
  const user = await currentUser();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo href="/" />
        <nav className="flex items-center gap-3 text-sm">
          <a
            href="https://github.com/qaweem321/pulseboard"
            className="text-muted no-underline hover:text-ink"
          >
            GitHub
          </a>
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white no-underline"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white no-underline"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-20 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand">
            Open-source uptime monitoring
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Know it&apos;s down before your customers do.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Pulseboard checks your sites and APIs around the clock, alerts your team the moment something
            breaks, and keeps a public status page up to date. Self-hosted, with single sign-on.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="rounded-lg bg-brand px-5 py-3 font-semibold text-white no-underline"
            >
              {user ? "Go to dashboard" : "Sign in"}
            </Link>
            <a
              href="https://github.com/qaweem321/pulseboard#quick-start"
              className="rounded-lg border border-line px-5 py-3 font-semibold text-ink no-underline"
            >
              Run it yourself
            </a>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-line bg-surface p-6">
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        MIT licensed · Built with Next.js, Postgres, Keycloak and D3
      </footer>
    </div>
  );
}
