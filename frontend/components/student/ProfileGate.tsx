"use client";

import type { ReactNode } from "react";
import type { Profile } from "@/lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStudentProfile } from "./useStudentProfile";
import { StudentLoading } from "./StudentPage";

/** Shows loading, error and empty states for pages that need the student's profile, then renders children once it's ready. */
export function ProfileGate({ children }: { children: (profile: Profile) => ReactNode }) {
  const { state, mock, retry } = useStudentProfile();

  if (state.status === "loading") {
    return <StudentLoading rows={2} />;
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load your profile</CardTitle>
          <CardDescription>{state.message}. Try signing in again.</CardDescription>
          <Button onClick={retry} variant="outline" className="mt-2 w-fit">Retry</Button>
        </CardHeader>
      </Card>
    );
  }
  if (state.status === "empty") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No score yet</CardTitle>
          <CardDescription>Your score hasn&apos;t been calculated yet. Check back after the next data refresh.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <>
      {mock && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Showing sample data (?mock=1).</p>}
      {children(state.profile)}
    </>
  );
}
