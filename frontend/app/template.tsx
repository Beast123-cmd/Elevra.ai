"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/shared/shell/ThemeToggle";
import { useTheme } from "@/components/shared/shell/theme";

const MOTION_CARDS = [
  "[data-motion-card]",
  "div.rounded-xl.border, section.rounded-xl.border, article.rounded-xl.border, aside.rounded-xl.border",
  "div.rounded-2xl.border, section.rounded-2xl.border, article.rounded-2xl.border, aside.rounded-2xl.border",
  "section.rounded-lg.border[class*='bg-card']",
].join(", ");

const MOTION_TEXT = [
  "[data-motion-text], h1",
].join(", ");
const MOTION_TARGETS = `${MOTION_CARDS}, ${MOTION_TEXT}`;
export default function Template({ children }: Readonly<{ children: ReactNode }>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const landingThemeRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useTheme();

  useLayoutEffect(() => {
    if (pathname?.startsWith("/login")) return;
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(MOTION_TARGETS));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => {
        if (!target.closest("[data-student-reveal]") && !target.closest("[aria-hidden='true']")) {
          target.classList.add(isMotionCard(target) ? "dashboard-card-reveal" : "dashboard-text-reveal");
        }
      });
      return;
    }

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
      if (!visible.length) return;
      requestAnimationFrame(() => visible.forEach((target) => {
        target.classList.remove("dashboard-motion-pending");
        target.classList.add(isMotionCard(target) ? "dashboard-card-reveal" : "dashboard-text-reveal");
        observer.unobserve(target);
      }));
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });

    const observeTarget = (target: HTMLElement) => {
      if (observed.has(target) || target.closest("[data-student-reveal]") || target.closest("[aria-hidden='true']")) return false;
      observed.add(target);
      target.classList.add("dashboard-motion-pending");
      observer.observe(target);
      return true;
    };
    targets.forEach(observeTarget);

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (pathname !== "/") return;
    const control = landingThemeRef.current;
    const signIn = document.querySelector<HTMLElement>('a[href="/login"]');
    if (!control || !signIn) return;

    const position = () => {
      const action = signIn.getBoundingClientRect();
      const width = control.getBoundingClientRect().width;
      control.style.left = `${Math.max(16, action.left - width - 12)}px`;
      control.style.top = `${Math.max(8, action.top)}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(document.documentElement);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position);
    };
  }, [pathname]);

  const signedOutPage = pathname === "/" || pathname === "/login";
  return (
    <>
      <div ref={rootRef} className={`route-transition ${pathname?.startsWith("/login") ? "login-transition" : ""}`}>{children}</div>
      {signedOutPage && pathname === "/" && <div ref={landingThemeRef} className="fixed left-4 top-4 z-[60]"><ThemeToggle /></div>}
    </>
  );
}

function isMotionCard(element: HTMLElement) {
  return element.hasAttribute("data-motion-card") || element.matches("div.rounded-xl.border, section.rounded-xl.border, article.rounded-xl.border, aside.rounded-xl.border, div.rounded-2xl.border, section.rounded-2xl.border, article.rounded-2xl.border, aside.rounded-2xl.border, section.rounded-lg.border[class*='bg-card']");
}
