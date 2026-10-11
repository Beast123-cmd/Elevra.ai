import Link from "next/link";

type BrandProps = {
  className?: string;
};

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center bg-[#154e49] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] ${compact ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-[11px]"}`}>
      <svg viewBox="0 0 40 40" className={compact ? "h-[22px] w-[22px]" : "h-7 w-7"} fill="none" aria-hidden="true">
        <path
          d="M10 8v24M10 9h20M10 20h9M10 31h11"
          stroke="white"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m19 20 9-9m-5 0h5v5"
          stroke="#b9d8c9"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand({ className = "" }: BrandProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex shrink-0 items-center gap-3 text-[#172824] no-underline ${className}`}
      aria-label="Elevra home"
    >
      <span className="shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"><BrandMark /></span>
      <span className="flex items-baseline text-[20px] font-semibold leading-none tracking-[-.06em]">
        elevra<span className="ml-0.5 text-[.78em] font-medium tracking-[-.025em] text-[#718078]"><span className="text-[#9baaa2]">.</span>ai</span>
      </span>
    </Link>
  );
}
