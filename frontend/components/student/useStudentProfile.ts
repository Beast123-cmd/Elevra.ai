"use client";

import { useContext, useEffect } from "react";
import type { Profile } from "@/lib/types";
import { StudentProfileContext } from "./StudentProfileProvider";

export type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; profile: Profile };

/** Reads the profile state shared by all student routes. */
export function useStudentProfile(): { state: ProfileState; mock: boolean } {
  const value = useContext(StudentProfileContext);
  if (!value) throw new Error("useStudentProfile must be used inside StudentProfileProvider");
  useEffect(() => {
    if (!value.mock && value.state.status === "loading") value.load();
  }, [value]);
  return { state: value.state, mock: value.mock };
}
