import { StudentNav } from "@/components/student/StudentNav";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudentNav />
      {children}
    </>
  );
}
