"use client";
import { useEffect, useState } from "react";

/**
 * Concrete colours for charts. Recharts writes colours as SVG attributes, where CSS variables do not work reliably,
 * so charts read these instead. They mirror the tokens in app/globals.css; keep the two in step.
 */
const LIGHT = {
  ink: "#1B2420", muted: "#5B655F", grid: "#DDD7CB", paper: "#FBFAF6",
  primary: "#1E5A4E", ochre: "#B9802A", slate: "#3E5C76", brick: "#A8402D", plum: "#6B4E71", olive: "#7C8B58", stone: "#8C8577",
  red: "#A8402D", amber: "#B9802A", green: "#3F6E45", none: "#A39E92",
};
const DARK: typeof LIGHT = {
  ink: "#E7EAE3", muted: "#9DA8A0", grid: "#2C3832", paper: "#161E1A",
  primary: "#7FB8A4", ochre: "#DDB262", slate: "#8FAAC4", brick: "#E08A76", plum: "#B79AC0", olive: "#B5C38A", stone: "#7D776B",
  red: "#E08A76", amber: "#DDB262", green: "#93C08F", none: "#6F6A5F",
};
export type Palette = typeof LIGHT;

export function paletteFor(dark: boolean): Palette & { series: string[]; band: Record<string, string>; segment: Record<string, string>; tier: Record<string, string> } {
  const p = dark ? DARK : LIGHT;
  return {
    ...p,
    series: [p.primary, p.ochre, p.slate, p.brick, p.plum, p.olive],
    band: { Thriving: p.green, "On Track": p.primary, "Needs Attention": p.ochre, Critical: p.brick },
    tier: { Red: p.red, Amber: p.amber, Green: p.green, "Not assessed": p.none },
    segment: {
      "Silent disengagers": p.brick, "Academic stars, placement unready": p.plum, "Engaged but struggling": p.ochre,
      "Skilled but irregular": p.slate, "Placement-ready all-rounders": p.primary, "Steady middle": p.stone,
    },
  };
}

/** The chart palette for the current theme; re-renders when the theme is switched. */
export function usePalette() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return paletteFor(dark);
}

/** Shared Recharts props so every chart has the same axes, grid and tooltip. */
export function chartChrome(p: Palette) {
  return {
    grid: { stroke: p.grid, strokeDasharray: "2 4", vertical: false },
    axis: { stroke: p.grid, tick: { fill: p.muted, fontSize: 12 }, tickLine: false },
    tooltip: {
      contentStyle: { background: p.paper, border: `1px solid ${p.grid}`, borderRadius: 6, color: p.ink, fontSize: 12, boxShadow: "none" },
      labelStyle: { color: p.ink, fontWeight: 600 },
      cursor: { fill: p.grid, fillOpacity: 0.35 },
    },
  };
}
