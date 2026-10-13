# Design decisions

Why Pulseboard is built the way it is, and what each choice costs. Each section answers a question an
interviewer or contributor is likely to ask.

## 1. Why a separate worker instead of checking inside Next.js?

Next.js route handlers run per request; nothing guarantees they keep running between requests, and
serverless hosts freeze them. Checks have to run on a clock, so they live in a long-running worker
process.

**Trade-off:** two processes to deploy instead of one. Docker Compose hides this locally.

## 2. How do several workers avoid checking the same monitor twice?

`claimDueMonitors` selects due monitors with `FOR UPDATE SKIP LOCKED` and, in the same statement,
pushes their `next_check_at` forward. A second worker running at the same moment skips the locked
rows instead of waiting for them, and once the first commits, those monitors aren't due any more.
No Redis, no leader election.

**Trade-off:** if a worker crashes mid-check, that monitor waits one interval before it's checked
again. For uptime checks that is acceptable.

## 3. Why is the state machine a pure function?

`nextState(state, outcome)` has no I/O, so every rule (threshold, recovery, paused) is tested in
microseconds with plain values. `recordCheck` wraps it in a transaction and locks the monitor row, so
a concurrent pause or edit can't interleave with a state change.

## 4. Why both raw checks and daily rollups?

A monitor checked every 30 seconds produces about 260,000 rows in 90 days. The 90-day bars only need
one number per day, so every check also upserts a `daily_stats` row
(`ON CONFLICT DO UPDATE SET checks = checks + 1`). Raw checks are deleted after 30 days; rollups are kept.

**Trade-off:** one extra write per check, in exchange for status pages that never scan raw checks.

## 5. How are response-time charts kept fast for 30 days of data?

Postgres buckets the points (`date_bin('4 hours', checked_at, 'epoch')`), so every range returns
about 150 to 180 points whatever the raw volume. The chart fills empty buckets on the client, so the
line breaks where there was no data instead of joining across the gap.

## 6. Why Keycloak, and how does login work?

Keycloak is a widely used open-source identity provider. Teams self-hosting Pulseboard can plug in
their existing SSO, or federate Google and GitHub through Keycloak.

The flow is Authorization Code with PKCE, state and nonce (via `openid-client`). The three
single-use values travel in an encrypted cookie that expires after 10 minutes (A256GCM, via `jose`),
so any app instance can finish a login. After login the app keeps its own session in Postgres: the
cookie holds a random token, and the database stores only its SHA-256 hash.

**Why server-side sessions instead of keeping Keycloak's tokens in a cookie:** sessions can be
revoked instantly (logout, or deleting a row), cookies stay small, and access tokens never reach the
browser.

## 7. Where do roles come from?

From Keycloak realm roles: `viewer`, `editor` (which includes viewer) and `admin` (which includes
editor). A protocol mapper puts them into the ID token as `roles`. Pulseboard reads them at login,
so managing access happens in one place.

**Trade-off:** role changes apply at the user's next login (sessions last 8 hours).

## 8. Why REST route handlers plus RTK Query, and not Server Actions?

The dashboard is live: it polls every 30 seconds, invalidates related data after edits, and handles
expired sessions in one place. RTK Query covers all three. A plain JSON API is also usable by scripts
and CI pipelines. Server components are still used where they fit best: the public status page
renders on the server and is cached for 30 seconds.

## 9. Why both Material UI and Tailwind?

MUI provides accessible building blocks (dialogs, menus, autocomplete, form controls); Tailwind
handles layout and spacing without a custom CSS file per component. They share one palette: Tailwind
colors read MUI's CSS variables, and MUI's styles sit in their own CSS layer, so a Tailwind class
always overrides predictably. Dark mode is one `class` on `<html>` for both.

## 10. How is SSRF prevented?

Users type in URLs the server then fetches, which is the textbook setup for server-side request
forgery: `http://169.254.169.254/` would read cloud credentials. Every check and webhook goes through
[`no-ssrf`](https://github.com/qaweem321/no-ssrf), which rejects private and reserved addresses in the
URL, in every DNS answer (so DNS rebinding doesn't work) and after every redirect. Teams that monitor
internal services allowlist those hosts with `MONITOR_ALLOW_HOSTS`.

## 11. How are the database queries kept efficient?

- The dashboard list runs four independent queries in parallel (`Promise.all`) instead of one query
  per monitor.
- Status pages load 90-day bars for all their monitors in one query, and incident updates for all
  incidents in a second one.
- The demo seed inserts in chunks of 2,000 rows.
- Indexes match the access paths: due monitors (partial index on `next_check_at`), checks by monitor
  and time, and one open incident per monitor.

## 12. How is it tested?

- **Unit tests** for pure logic: the state machine, status-code parsing, uptime math, safe redirects.
- **SQL tests** on [PGlite](https://pglite.dev), real Postgres 17 compiled to WebAssembly, so
  `SKIP LOCKED`, `date_bin`, partial unique indexes and migrations run for real without Docker.
- **HTTP tests** against a local server for redirects, timeouts, keywords and SSRF blocking.
- **Component tests** with React Testing Library and the real Redux store, with `fetch` mocked.
- **CI** also applies the migrations to a real Postgres service container and builds both Docker images.
