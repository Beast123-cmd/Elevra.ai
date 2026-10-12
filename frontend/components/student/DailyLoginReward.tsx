"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/** Idempotent check-in runs in the student shell, so visiting a particular page is not required. */
export function DailyLoginReward() {
  useEffect(() => {
    void api<{ awarded: boolean; coins: number; streak_days: number }>("/daily-challenges/check-in", {})
      .then((reward) => {
        if (reward.awarded) {
          toast.success(`+${reward.coins} Elevra coins`, {
            description: reward.streak_days % 7 === 0
              ? `${reward.streak_days}-day login streak — includes a 25 coin bonus.`
              : "Daily login reward added to your wallet.",
          });
        }
      })
      .catch(() => undefined);
  }, []);
  return null;
}
