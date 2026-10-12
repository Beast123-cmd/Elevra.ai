"use client";

import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";

type CoinReward = { id: number; amount: number };
const EVENT_NAME = "elevra:coin-reward";

/** Fire after the server confirms a coin award. */
export function showCoinReward(amount: number) {
  if (typeof window !== "undefined" && Number.isFinite(amount) && amount > 0) {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { amount } }));
  }
}

export function CoinRewardCelebration() {
  const [reward, setReward] = useState<CoinReward | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    let id = 0;
    const onReward = (event: Event) => {
      const amount = (event as CustomEvent<{ amount?: number }>).detail?.amount;
      if (!Number.isFinite(amount) || !amount || amount <= 0) return;
      window.clearTimeout(id);
      sequence.current += 1;
      setReward({ id: sequence.current, amount });
      id = window.setTimeout(() => setReward(null), 1500);
    };
    window.addEventListener(EVENT_NAME, onReward);
    return () => {
      window.removeEventListener(EVENT_NAME, onReward);
      window.clearTimeout(id);
    };
  }, []);

  if (!reward) return null;
  return <div key={reward.id} role="status" aria-live="polite" className="coin-reward-float pointer-events-none fixed left-1/2 top-[4.5rem] z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/70 bg-card/95 py-2 pl-2 pr-4 text-foreground shadow-xl backdrop-blur">
    <span className="coin-reward-spin grid h-11 w-11 place-items-center rounded-full border-[3px] border-amber-200 bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 text-amber-950 shadow-inner">
      <Coins className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
    </span>
    <span className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-300">+{reward.amount}</span>
    <span className="text-sm font-semibold text-muted-foreground">coins</span>
  </div>;
}
