import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/server/auth/current-user";
import { StoreProvider } from "@/store/store-provider";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ui = { name: user.name, email: user.email, role: user.role };
  return (
    <StoreProvider user={ui}>
      <AppShell>
        {user.role ? (
          children
        ) : (
          <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-8 text-center">
            <h1 className="text-xl font-semibold">You don&apos;t have access yet</h1>
            <p className="mt-2 text-sm text-muted">
              You&apos;re signed in as {user.email}, but your account has no Pulseboard role. Ask an
              administrator to give you the <b>viewer</b>, <b>editor</b> or <b>admin</b> role in Keycloak,
              then sign in again.
            </p>
          </div>
        )}
      </AppShell>
    </StoreProvider>
  );
}
