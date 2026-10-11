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
      className="group flex min-h-[76px] items-center justify-between gap-4 rounded-xl border border-border bg-muted px-4 py-4 no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-input hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-primary">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
