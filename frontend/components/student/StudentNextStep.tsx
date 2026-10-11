import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StudentNextStep({
  label = "NEXT STEP",
  title,
  description,
  href,
}: {
  label?: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[76px] items-center justify-between gap-4 rounded-xl border border-[#d5e2db] bg-[#edf4f0] px-4 py-4 no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:bg-[#e5efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 sm:px-5"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-[#286a62]">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-[#172824]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-600">{description}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[#286a62] transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
