import Link from "next/link";

type BrandProps = {
  className?: string;
};

export function Brand({ className = "" }: BrandProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex shrink-0 items-center gap-3 text-[#172824] no-underline ${className}`}
      aria-label="Elevra home"
    >
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#154e49] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] transition-transform duration-200 group-hover:scale-[1.03]">
        <svg viewBox="0 0 40 40" className="h-[25px] w-[25px]" fill="none" aria-hidden="true">
          <path
            d="M28.2 12.6a10.7 10.7 0 1 0 0 14.8"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M11.1 20h17.7"
            stroke="#b9d8c9"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex items-baseline text-[19px] font-semibold leading-none tracking-[-.055em]">
        elevra<span className="font-medium text-[#687a73]"><span className="text-[#9baaa2]">.</span>ai</span>
      </span>
    </Link>
  );
}
