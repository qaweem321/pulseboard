"use client";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useColorScheme } from "@mui/material/styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { hasRole, type Role } from "@/lib/roles";
import { useAppSelector } from "@/store/store";
import { Logo } from "./logo";

const NAV: { href: string; label: string; role: Role }[] = [
  { href: "/dashboard", label: "Monitors", role: "viewer" },
  { href: "/dashboard/incidents", label: "Incidents", role: "viewer" },
  { href: "/dashboard/status-pages", label: "Status pages", role: "viewer" },
  { href: "/dashboard/alerts", label: "Alerts", role: "admin" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/monitors");
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAppSelector((state) => state.ui.user);
  const items = NAV.filter((item) => hasRole(user?.role ?? null, item.role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Logo href="/dashboard" />
          <nav aria-label="Main" className="hidden gap-1 md:flex">
            {items.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <UserMenu />
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {items.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors ${
        active ? "bg-brand/10 text-brand" : "text-muted hover:bg-line/40 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

const THEME_MODES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

// Theme choice in the account menu. MUI saves it in this browser; "system" follows the device.
function ThemeChoice() {
  const { mode, setMode } = useColorScheme();
  return (
    <div className="px-4 py-2">
      <div id="theme-label" className="mb-1.5 text-xs text-muted">
        Theme
      </div>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        aria-labelledby="theme-label"
        value={mode ?? "system"}
        onChange={(_event, value: (typeof THEME_MODES)[number]["value"] | null) => value && setMode(value)}
      >
        {THEME_MODES.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

function UserMenu() {
  const user = useAppSelector((state) => state.ui.user);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu" aria-haspopup="menu">
        <Avatar sx={{ width: 30, height: 30, fontSize: 13, bgcolor: "primary.main" }}>{initials}</Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <div className="px-4 py-2">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted">{user.email}</div>
          <div className="mt-1 text-xs capitalize text-muted">Role: {user.role ?? "none"}</div>
        </div>
        <Divider />
        <ThemeChoice />
        <Divider />
        <form
          action="/api/auth/logout"
          method="post"
          className="px-2 pt-2"
          onSubmit={() => setSigningOut(true)}
        >
          <Button type="submit" fullWidth color="inherit" disabled={signingOut}>
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </form>
      </Menu>
    </>
  );
}
