import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
      <path
        d="M5 17h6l3-7 4 13 3-6h6"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Inside the app the logo goes to the dashboard; on public pages it goes to the landing page.
export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-ink no-underline">
      <LogoMark />
      <span className="text-lg">Pulseboard</span>
    </Link>
  );
}
