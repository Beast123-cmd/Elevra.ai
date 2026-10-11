"use client";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";
import { clearQueryCache } from "./queryCache";

export interface Identity {
  userId: string;
  role: Role | "";
  studentId: string | null;
  facultyId: string | null;
}

/**
 * Who is signed in, read from the local session: no network round trip. The server has already verified the
 * session on every page load (middleware), and the database enforces what each person may read (RLS), so the
 * browser only needs this to decide what to show. Use `auth.getUser()` only when a fresh server check is required.
 */
export async function getIdentity(): Promise<Identity | null> {
  const { data } = await createClient().auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const meta = user.app_metadata ?? {};
  return {
    userId: user.id,
    role: (meta.role as Role | undefined) ?? "",
    studentId: (meta.student_id as string | undefined) ?? null,
    facultyId: (meta.faculty_id as string | undefined) ?? null,
  };
}

/** Sign out, forget cached data, and leave with a full page load so no protected page lingers in the browser. */
export async function signOutAndLeave(): Promise<void> {
  clearQueryCache();
  try {
    await createClient().auth.signOut();
  } finally {
    window.location.assign("/login");
  }
}
