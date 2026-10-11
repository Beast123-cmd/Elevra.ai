import { Suspense } from "react";
import { Notifications } from "@/components/student/Notifications";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-slate-500">Placement drives and announcements meant for you.</p>
      </header>
      <Suspense fallback={null}>
        <Notifications />
      </Suspense>
    </main>
  );
}
