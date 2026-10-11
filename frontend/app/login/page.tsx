"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

const DEMO = [
  { label: "Admin", email: "admin@demo.edu", hint: "Institution view, user management" },
  { label: "Faculty mentor", email: "faculty1@demo.edu", hint: "Action queue, interventions" },
  { label: "Student: at risk", email: "student.red@demo.edu", hint: "Improvement story" },
  { label: "Student: academic star", email: "student.star@demo.edu", hint: "Placement gap story" },
];

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn(e: string, p: string) {
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email: e, password: p });
    setBusy(false);
    if (error) {
      toast.error("Login failed. Check the email and password.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-blue-900">Elevra.ai</h1>
        <p className="text-sm text-slate-500">Student success intelligence for faculty, administrators and students.</p>
      </div>
      <Card className="p-5">
        <Tabs defaultValue="student">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="student">Student</TabsTrigger>
            <TabsTrigger value="faculty">Faculty</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
          {["student", "faculty", "admin"].map((r) => (
            <TabsContent key={r} value={r} className="space-y-3 pt-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button className="w-full" disabled={busy || !email || !password} onClick={() => signIn(email, password)}>
                Sign in as {r}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Evaluator quick access</h2>
        <p className="mb-3 text-xs text-slate-500">One click, no password needed. All data is synthetic.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEMO.map((d) => (
            <Button
              key={d.email}
              variant="outline"
              className="h-auto flex-col items-start py-2"
              disabled={busy}
              onClick={() => signIn(d.email, process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "")}
            >
              <span className="font-medium">{d.label}</span>
              <span className="text-xs font-normal text-slate-500">{d.hint}</span>
            </Button>
          ))}
        </div>
      </Card>
    </main>
  );
}
