"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { showCoinReward } from "./CoinRewardCelebration";

/** Idempotent check-in runs in the student shell, so visiting a particular page is not required. */
export function DailyLoginReward() {
  useEffect(() => {
    void api<{ awarded: boolean; coins: number }>("/daily-challenges/check-in", {})
      .then((reward) => { if (reward.awarded) showCoinReward(reward.coins); })
      .catch(() => undefined);
  }, []);
  return null;
}
