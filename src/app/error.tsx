"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">
        An unexpected error stopped this page from loading. Try again, and if it keeps happening, check the
        server logs{error.digest ? ` for error ${error.digest}` : ""}.
      </p>
      <button onClick={reset} className="mt-6 rounded-lg bg-brand px-4 py-2 font-semibold text-on-brand">
        Try again
      </button>
    </main>
  );
}
