import { FacultyNav } from "@/components/faculty/FacultyNav";

// Insights pages are for admin and faculty, so they share the faculty/admin navigation (owned by Lane B).
export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FacultyNav />
      {children}
    </>
  );
}
