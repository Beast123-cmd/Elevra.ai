"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function StudentReveal({ children, className = "", delayMs = 0, animate = true }: { children: ReactNode; className?: string; delayMs?: number; animate?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!animate || !element) return;
    if (!("IntersectionObserver" in window)) {
      element.classList.remove("student-reveal-pending");
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.classList.add("student-reveal-in");
      element.classList.remove("student-reveal-pending");
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [animate]);
  const classes = [animate ? "student-reveal-pending" : "", className].filter(Boolean).join(" ");
  return <div ref={ref} data-student-reveal className={classes} style={{ animationDelay: `${delayMs}ms` }}>{children}</div>;
}
