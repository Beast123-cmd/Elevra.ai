"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, Coins, LoaderCircle, RefreshCw } from "lucide-react";
import { StudentReveal } from "./StudentReveal";

interface StoreItem { item_id: string; title: string; description: string; cost_coins: number; image_path: string; stock: number }
interface Redemption { id: number; item_id: string; coins_spent: number; status: "requested" | "approved" | "fulfilled" | "cancelled"; created_at: string; title: string }
interface StoreData { coin_balance: number; items: StoreItem[]; redemptions: Redemption[] }
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: StoreData };

const statusLabel: Record<Redemption["status"], string> = { requested: "Pickup requested", approved: "Approved", fulfilled: "Collected", cancelled: "Cancelled" };

export function StudentStore() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const reload = useCallback(() => { setState({ status: "loading" }); setRetry((value) => value + 1); }, []);

  useEffect(() => {
    let active = true;
    api<StoreData>("/store").then((data) => { if (active) setState({ status: "ready", data }); })
      .catch((error: Error) => { if (active) setState({ status: "error", message: error.message }); });
    return () => { active = false; };
  }, [retry]);

  async function redeem(item: StoreItem) {
    if (redeeming || item.stock < 1) return;
    setRedeeming(item.item_id); setNotice(null);
    try {
      await api("/store/redeem", { item_id: item.item_id });
      setNotice({ tone: "success", message: `${item.title} requested. Your campus team will share pickup details.` });
      reload();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not redeem this reward. Try again." });
    } finally { setRedeeming(null); }
  }

  return <main className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
    <StudentReveal><header className="mb-6 border-l-2 border-primary pl-4"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Earn it. Make it yours.</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Elevra rewards store</h1><p className="mt-1 text-sm text-muted-foreground">Trade your learning coins for a little campus pride.</p></header></StudentReveal>
    {state.status === "loading" && <Card className="rounded-xl border-border"><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading the rewards store…</CardContent></Card>}
    {state.status === "error" && <Card role="alert" className="rounded-xl border-border"><CardContent className="p-5"><h2 className="font-semibold text-foreground">Store unavailable</h2><p className="mt-1 text-sm text-muted-foreground">{state.message}</p><button onClick={reload} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></CardContent></Card>}
    {state.status === "ready" && <>
      <StudentReveal delayMs={70}><div className="mb-3 mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Choose your reward</h2><p className="mt-1 text-sm text-muted-foreground">Redemptions create a campus pickup request.</p></div><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"><Coins className="h-4 w-4" aria-hidden="true" />{state.data.coin_balance.toLocaleString()} coins</span><span className="text-xs text-muted-foreground">Limited stock · first come, first served</span></div></div></StudentReveal>
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`mb-4 rounded-lg border px-4 py-3 text-sm ${notice.tone === "success" ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>{notice.message}</p>}
      {state.data.items.length === 0 ? <Card className="rounded-xl border-border"><CardContent className="p-5"><h3 className="font-semibold text-foreground">No rewards are available right now</h3><p className="mt-1 text-sm text-muted-foreground">Check back soon for new Elevra merch.</p></CardContent></Card> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{state.data.items.map((item, index) => {
          const canAfford = state.data.coin_balance >= item.cost_coins;
          return <StudentReveal key={item.item_id} delayMs={Math.min(index, 4) * 70} className="h-full"><Card className="group h-full overflow-hidden rounded-xl border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted"><Image src={item.image_path} alt={item.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /></div>
            <CardContent className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-foreground">{item.title}</h3><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{item.cost_coins}</span></div>
              <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{item.description}</p><p className="mt-3 text-xs text-muted-foreground">{item.stock > 0 ? `${item.stock} available` : "Currently out of stock"}</p>
              <button type="button" disabled={!canAfford || item.stock < 1 || !!redeeming} onClick={() => redeem(item)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{redeeming === item.item_id ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Requesting…</> : item.stock < 1 ? "Out of stock" : canAfford ? "Redeem reward" : `Need ${item.cost_coins - state.data.coin_balance} more coins`}</button>
            </CardContent>
          </Card></StudentReveal>;
        })}</div>}

      <StudentReveal delayMs={140}><section className="mt-8" aria-labelledby="redemption-heading"><div className="mb-3 flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" /><h2 id="redemption-heading" className="text-lg font-semibold text-foreground">Your redemptions</h2></div>
        {state.data.redemptions.length === 0 ? <Card className="rounded-xl border-border bg-muted/40"><CardContent className="p-4 text-sm text-muted-foreground">Your first reward is waiting. Earn coins with today&apos;s challenges.</CardContent></Card> : <div className="overflow-hidden rounded-xl border border-border bg-card">{state.data.redemptions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-0"><div><p className="text-sm font-medium text-foreground">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p></div><div className="text-right"><p className="text-sm font-semibold text-foreground">−{item.coins_spent} coins</p><p className="text-xs text-primary">{statusLabel[item.status]}</p></div></div>)}</div>}
      </section></StudentReveal>
    </>}
  </main>;
}
