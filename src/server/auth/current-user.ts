import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasRole, type Role } from "@/lib/roles";
import { loginPath } from "@/lib/safe-next";
import { db } from "../db";
import { findSession, SESSION_COOKIE, type SessionUser } from "./sessions";

// One session lookup per request, however many components ask.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSession(db(), token) : null;
});

// For pages: logged-out visitors go to the login page and come back here afterwards.
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(loginPath(path));
  }
  return user;
}

export async function requireRole(required: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, required)) redirect("/dashboard?denied=1");
  return user;
}
