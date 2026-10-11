"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/Kpi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

interface UserRow { id: string; email: string; role: Role; student_id: string | null; faculty_id: string | null; created_at: string }
interface StudentRow { student_id: string; name: string; department: string; year: number; mentor_faculty_id: string | null }
interface FacultyRow { faculty_id: string; name: string; department: string }
interface Created { email: string; role: Role; temp_password: string }

const FIELD = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [form, setForm] = useState({ email: "", name: "", role: "student" as Role, student_id: "", faculty_id: "" });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<StudentRow[]>([]);
  const [mentorFor, setMentorFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [u, f] = await Promise.all([
      supabase.from("users").select("id,email,role,student_id,faculty_id,created_at").order("created_at", { ascending: false }),
      supabase.from("faculty").select("faculty_id,name,department").order("faculty_id"),
    ]);
    if (u.error) return setError(u.error.message);
    setUsers(u.data as UserRow[]);
    setFaculty((f.data ?? []) as FacultyRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser() {
    setCreating(true);
    try {
      const res = await api<Created>("/admin/users", {
        email: form.email.trim(), name: form.name.trim(), role: form.role,
        student_id: form.role === "student" ? form.student_id.trim() : undefined,
        faculty_id: form.role === "faculty" ? form.faculty_id.trim() : undefined,
      });
      setCreated(res);
      setForm({ email: "", name: "", role: "student", student_id: "", faculty_id: "" });
      load();
    } catch {
      toast.error("Could not create the account. Check the id exists and the email is not already used.");
    } finally {
      setCreating(false);
    }
  }

  async function search() {
    const term = q.trim();
    if (!term) return setMatches([]);
    const { data } = await supabase
      .from("students")
      .select("student_id,name,department,year,mentor_faculty_id")
      .or(`student_id.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(12);
    setMatches((data ?? []) as StudentRow[]);
  }

  async function assign(studentId: string) {
    const mentor = mentorFor[studentId];
    if (!mentor) return toast.error("Pick a mentor first.");
    try {
      await api(`/admin/students/${studentId}/mentor`, { mentor_faculty_id: mentor });
      toast.success(`Mentor for ${studentId} set to ${mentor}`);
      setMatches((m) => m.map((s) => (s.student_id === studentId ? { ...s, mentor_faculty_id: mentor } : s)));
    } catch {
      toast.error("Could not change the mentor.");
    }
  }

  const needle = filter.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => !needle || `${u.email} ${u.role} ${u.student_id ?? ""} ${u.faculty_id ?? ""}`.toLowerCase().includes(needle));
  const canCreate = form.email && form.name && (form.role === "admin" || (form.role === "student" ? form.student_id : form.faculty_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">User management</h1>
        <p className="text-sm text-muted-foreground">There is no self sign-up. Admins create every student and faculty login and assign mentors.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Create account</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={FIELD} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={FIELD} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select className={FIELD} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
            {form.role === "student" && (
              <input className={FIELD} placeholder="Student id, e.g. 42178" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            )}
            {form.role === "faculty" && (
              <select className={FIELD} value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}>
                <option value="">Select faculty record</option>
                {faculty.map((f) => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.faculty_id} · {f.name} ({f.department})
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button disabled={creating || !canCreate} onClick={createUser}>
            {creating ? "Creating…" : "Create account"}
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Assign mentor</h2>
          <div className="flex gap-2">
            <Input placeholder="Search student by id or name" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button variant="outline" onClick={search}>Search</Button>
          </div>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "No students found." : "Search for a student to change their mentor."}</p>
          ) : (
            <ul className="divide-y text-sm">
              {matches.map((s) => (
                <li key={s.student_id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <b>{s.name}</b> <span className="text-muted-foreground">{s.student_id} · {s.department} · Y{s.year} · mentor {s.mentor_faculty_id ?? "none"}</span>
                  </span>
                  <select className="h-8 rounded-md border border-input px-2 text-xs" value={mentorFor[s.student_id] ?? ""}
                    onChange={(e) => setMentorFor({ ...mentorFor, [s.student_id]: e.target.value })}>
                    <option value="">Mentor…</option>
                    {faculty.filter((f) => f.department === s.department).map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_id} · {f.name}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={() => assign(s.student_id)}>Assign</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Accounts{users ? ` (${users.length})` : ""}</h2>
          <Input className="ml-auto max-w-xs" placeholder="Filter by email, role or id" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {error ? (
          <EmptyState>Could not load users: {error}</EmptyState>
        ) : users === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <EmptyState>{users.length === 0 ? "No accounts yet." : "No accounts match that filter."}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Linked record</th><th className="p-2">Created</th></tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.email}</td>
                    <td className="p-2 capitalize">{u.role}</td>
                    <td className="p-2 text-muted-foreground">{u.student_id ?? u.faculty_id ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={created !== null} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>Share this temporary password with the user now. It is not shown again.</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-2 text-sm">
              <div>Email: <b>{created.email}</b> ({created.role})</div>
              <div className="flex items-center gap-2">
                Temporary password: <code className="rounded bg-muted px-2 py-1">{created.temp_password}</code>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(created.temp_password).then(() => toast.success("Copied"))}>Copy</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
