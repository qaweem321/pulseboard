import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist or was removed.</p>
      <Link href="/" className="mt-6 rounded-lg bg-brand px-4 py-2 font-semibold text-on-brand no-underline">
        Back to the start
      </Link>
    </main>
  );
}
