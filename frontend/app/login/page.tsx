"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "student", label: "Student", detail: "Progress and next steps" },
  { value: "faculty", label: "Faculty", detail: "Mentee action queue" },
  { value: "admin", label: "Admin", detail: "Cohort and campus insights" },
] as const;

const DEMO = [
  { label: "Admin", role: "admin", email: "admin@demo.edu", hint: "Institution overview" },
  { label: "Faculty mentor", role: "faculty", email: "faculty1@demo.edu", hint: "Mentor action queue" },
  { label: "Student · needs a check-in", role: "student", email: "student.red@demo.edu", hint: "Student improvement path" },
  { label: "Student · academic strength", role: "student", email: "student.star@demo.edu", hint: "Career readiness path" },
] as const;

type Role = (typeof ROLES)[number]["value"];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

  async function signIn(userEmail: string, userPassword: string, expectedRole: Role) {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email: userEmail.trim(), password: userPassword });
      if (error) {
        toast.error("We couldn’t sign you in. Check your details and try again.");
        return;
      }
      const actualRole = data.user.app_metadata.role as string | undefined;
      if (actualRole !== expectedRole) {
        await supabase.auth.signOut();
        toast.error(`This account is not registered as ${expectedRole}. Choose the matching role and try again.`);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Sign-in is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn(email, password, role);
  }

  function signInDemo(demoEmail: string, demoRole: Role) {
    if (!demoPassword) {
      toast.error("Demo accounts aren’t configured in this environment.");
      return;
    }
    setRole(demoRole);
    void signIn(demoEmail, demoPassword, demoRole);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900 no-underline" aria-label="Elevra home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-800 text-base font-semibold text-white">e</span>
            <span className="text-[17px] font-bold tracking-tight">elevra<span className="font-medium text-slate-500">.ai</span></span>
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-600 no-underline hover:text-teal-900">Back to home</Link>
        </header>

        <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-20 lg:py-16">
          <section className="pt-1 lg:pt-8">
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-teal-800">Your Elevra workspace</p>
            <h1 className="mt-3 max-w-md text-[34px] font-semibold leading-[1.12] tracking-[-.04em] text-slate-950 sm:text-[42px]">
              Welcome back. Let’s pick up where you left off.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Sign in with your campus account to continue to the workspace for your role.
            </p>

            <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
              {ROLES.map((item, index) => (
                <div key={item.value} className="flex items-center gap-4 py-4">
                  <span className="font-mono text-xs text-teal-800">0{index + 1}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{item.label}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs leading-5 text-slate-500">
              <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Your role determines which campus workspace opens after sign-in.
            </p>
          </section>

          <section className="space-y-4" aria-label="Sign in to Elevra">
            <Card className="rounded-xl border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-7">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Sign in</h2>
                <p className="mt-1 text-sm text-slate-500">Choose your role, then enter your campus account details.</p>
              </div>

              <Tabs value={role} onValueChange={(value) => setRole(value as Role)} className="mt-5">
                <TabsList className="grid h-11 w-full grid-cols-3 rounded-lg bg-slate-100 p-1">
                  {ROLES.map((item) => (
                    <TabsTrigger key={item.value} value={item.value} className="h-9 rounded-md text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm">
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {ROLES.map((item) => (
                  <TabsContent key={item.value} value={item.value} className="mt-5">
                    <form className="space-y-4" onSubmit={submit}>
                      <div className="space-y-1.5">
                        <label htmlFor="login-email" className="text-xs font-medium text-slate-700">Campus email</label>
                        <Input id="login-email" type="email" autoComplete="username" placeholder="name@college.edu" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} className="h-10 border-slate-300 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-teal-700" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="login-password" className="text-xs font-medium text-slate-700">Password</label>
                        <Input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} className="h-10 border-slate-300 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-teal-700" />
                      </div>
                      <Button type="submit" className="h-10 w-full bg-teal-800 text-white hover:bg-teal-900" disabled={busy || !email.trim() || !password}>
                        {busy ? "Signing in…" : `Continue as ${item.label.toLowerCase()}`}
                        {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    </form>
                  </TabsContent>
                ))}
              </Tabs>
            </Card>

            <Card className="rounded-xl border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Explore a demo workspace</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Use a sample account to see the experience. Demo records are synthetic.</p>
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {DEMO.map((demo) => (
                  <Button key={demo.email} type="button" variant="outline" className="h-auto min-h-[58px] justify-between border-slate-200 px-3 py-2.5 text-left hover:border-teal-700 hover:bg-teal-50/50" disabled={busy} onClick={() => signInDemo(demo.email, demo.role)}>
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">{demo.label}</span>
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{demo.hint}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </Card>
          </section>
        </div>

        <footer className="border-t border-slate-200 py-5 text-xs text-slate-500">
          Elevra.ai · Student success intelligence
        </footer>
      </div>
    </main>
  );
}
