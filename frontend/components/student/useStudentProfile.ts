"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MOCK_PROFILE } from "./mock-profile";

export type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; profile: Profile };

async function load(): Promise<Profile | null> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  const studentId = auth.user?.app_metadata?.student_id as string | undefined;
  if (!studentId) throw new Error("This account isn't linked to a student record");
  const { data, error } = await sb.from("scores").select("profile").eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.profile as Profile | undefined) ?? null;
}

/** Loads the signed-in student's own profile. `?mock=1` swaps in sample data for previewing. */
export function useStudentProfile(): { state: ProfileState; mock: boolean } {
  const mock = useSearchParams().get("mock") === "1";
  const [state, setState] = useState<ProfileState>({ status: "loading" });

  useEffect(() => {
    if (mock) {
      setState({ status: "ready", profile: MOCK_PROFILE });
      return;
    }
    let cancelled = false;
    load()
      .then((profile) => !cancelled && setState(profile ? { status: "ready", profile } : { status: "empty" }))
      .catch((e: Error) => !cancelled && setState({ status: "error", message: e.message }));
    return () => { cancelled = true; };
  }, [mock]);

  return { state, mock };
}
