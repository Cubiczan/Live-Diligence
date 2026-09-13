import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/agent.functions";
import { createCheckoutSession } from "@/lib/billing.functions";
import { redirectToAllowedCheckoutUrl } from "@/lib/safe-redirect";
import { ShieldCheck, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const fetchProfile = useServerFn(getProfile);
  const checkoutFn = useServerFn(createCheckoutSession);
  const q = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const checkout = useMutation({
    mutationFn: () => checkoutFn({ data: { returnUrl: `${window.location.origin}/billing` } }),
    onSuccess: (r) => {
      if (!redirectToAllowedCheckoutUrl(r.url)) {
        toast.error("Checkout returned an invalid URL");
      }
    },
    onError: (e: any) => toast.error(e.message || "Checkout failed"),
  });

  const plan = q.data?.profile.plan ?? "free";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber">Billing</p>
      <h1 className="mt-1 font-display text-4xl">Plan & subscription</h1>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className={`rounded-xl border p-7 ${plan === "free" ? "border-amber/40 glow-amber" : "border-border"} bg-card`}>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Free {plan === "free" && "· current"}</div>
          <div className="mt-3 font-display text-4xl">$0</div>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Zap className="mt-0.5 h-4 w-4 text-amber" /> 3 memos / month</li>
            <li className="flex gap-2"><Zap className="mt-0.5 h-4 w-4 text-amber" /> Flash synthesis model</li>
          </ul>
        </div>
        <div className={`rounded-xl border p-7 ${plan === "pro" ? "border-amber/40 glow-amber" : "border-border"} bg-card`}>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Pro {plan === "pro" && "· current"}</div>
          <div className="mt-3 font-display text-4xl">$19<span className="text-base text-muted-foreground">/mo</span></div>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber" /> Unlimited memos</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber" /> Pro synthesis model (gemini-2.5-pro)</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber" /> Priority agent runtime</li>
          </ul>
          {plan === "pro" ? (
            <div className="mt-6 rounded-md border border-border px-4 py-2 text-center text-xs text-muted-foreground">You're on Pro — thanks.</div>
          ) : (
            <button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {checkout.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 font-mono text-[11px] text-muted-foreground">
        Stripe test mode. Use card 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </div>
  );
}
