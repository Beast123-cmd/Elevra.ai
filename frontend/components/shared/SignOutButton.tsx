"use client";
import { Button } from "@/components/ui/button";
import { signOutAndLeave } from "./session";

/** Drop-in sign-out for any layout. Clears cached data, ends the session and leaves with a full page load. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <Button variant="ghost" size="sm" className={className} onClick={signOutAndLeave}>
      Sign out
    </Button>
  );
}
