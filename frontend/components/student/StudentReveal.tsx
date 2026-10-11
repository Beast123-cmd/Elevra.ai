"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function StudentReveal({ children, className = "", delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.classList.add("student-reveal-in");
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const style: CSSProperties = delayMs > 0 ? { animationDelay: `${delayMs}ms` } : {};
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
