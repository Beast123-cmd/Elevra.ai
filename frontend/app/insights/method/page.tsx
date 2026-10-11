import { MethodTrust } from "@/components/insights/MethodTrust";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Method &amp; Trust</h1>
        <p className="text-slate-500">How the score is calculated, how well the early warning works, and where its limits are.</p>
      </header>
      <MethodTrust />
    </main>
  );
}
