import { StudentNav } from "@/components/student/StudentNav";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <StudentNav />
      <div className="min-w-0">
        <header className="hidden h-14 items-center border-b border-slate-200 bg-white px-6 text-[11px] font-medium text-slate-600 md:flex md:px-10">
          Student dashboard
        </header>
        {children}
      </div>
    </div>
  );
}
