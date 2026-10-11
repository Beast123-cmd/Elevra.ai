"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "admin", label: "Admin" },
] as const;

const DEMO = [
  { label: "Admin", role: "admin", email: "admin@demo.edu" },
  { label: "Faculty", role: "faculty", email: "faculty1@demo.edu" },
  { label: "Student · check-in", role: "student", email: "student.red@demo.edu" },
  { label: "Student · strong progress", role: "student", email: "student.star@demo.edu" },
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] px-4 py-10 text-slate-950 sm:px-6">
      <Link href="/" className="mb-6 flex items-center gap-2.5 text-slate-950 no-underline" aria-label="Elevra home">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#154e49] text-base font-semibold text-white">e</span>
        <span className="text-[17px] font-bold tracking-[-.04em]">elevra<span className="font-medium text-slate-500">.ai</span></span>
      </Link>

      <section className="w-full max-w-[420px] rounded-xl border border-[#e0e6e1] bg-white p-5 shadow-[0_18px_50px_-38px_rgba(23,40,36,.4)] sm:p-8" aria-labelledby="login-heading">
        <div className="text-center">
          <h1 id="login-heading" className="text-[23px] font-semibold tracking-[-.04em] text-[#172824]">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">Use your campus account to continue.</p>
        </div>

        <Tabs value={role} onValueChange={(value) => setRole(value as Role)} className="mt-6">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-md bg-[#f1f4f1] p-1">
            {ROLES.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="h-8 rounded text-xs font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[#154e49] data-[state=active]:shadow-sm">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ROLES.map((item) => (
            <TabsContent key={item.value} value={item.value} className="mt-5">
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-medium text-slate-700">Email</label>
                  <Input id="login-email" type="email" autoComplete="username" placeholder="name@college.edu" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} className="h-11 border-slate-300 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-[#286a62]" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-700">Password</label>
                  <Input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} className="h-11 border-slate-300 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-[#286a62]" />
                </div>
                <Button type="submit" className="h-11 w-full bg-[#154e49] text-sm font-semibold text-white hover:bg-[#103e3a]" disabled={busy || !email.trim() || !password}>
                  {busy ? "Signing in…" : "Continue"}{!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </form>
            </TabsContent>
          ))}
        </Tabs>

        <details className="mt-5 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer list-none text-center text-xs font-medium text-[#286a62] outline-none hover:text-[#154e49] focus-visible:ring-2 focus-visible:ring-[#286a62]">
            Try a demo account
          </summary>
          <p className="mt-3 text-center text-[11px] leading-4 text-slate-500">Demo workspaces use synthetic campus records.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO.map((demo) => (
              <Button key={demo.email} type="button" variant="outline" className="h-9 min-w-0 justify-center border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:border-[#b8cec3] hover:bg-[#f5f8f5] hover:text-[#154e49]" disabled={busy} onClick={() => signInDemo(demo.email, demo.role)}>
                <span className="truncate">{demo.label}</span>
              </Button>
            ))}
          </div>
        </details>
      </section>

      <p className="mt-5 text-center text-xs text-slate-500"><Link href="/" className="text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-[#154e49]">Back to Elevra</Link></p>
    </main>
  );
}
