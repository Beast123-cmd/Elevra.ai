import { MethodTrust } from "@/components/insights/MethodTrust";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Method &amp; Trust</h1>
        <p className="text-muted-foreground">How the score is calculated, how well the early warning works, and where its limits are.</p>
      </header>
      <MethodTrust />
    </div>
  );
}
