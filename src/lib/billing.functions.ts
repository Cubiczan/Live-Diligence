import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createCheckoutSession as createStripeCheckoutSession } from "@/lib/stripe-billing.server";
import { toAllowedCheckoutRedirectUrl } from "@/lib/safe-redirect";
import { z } from "zod";

const PRO_PRICE_AMOUNT = 1900; // $19.00 in cents
const PRO_PRODUCT_NAME = "Live Diligence Pro";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ returnUrl: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email, stripe_customer_id").eq("id", userId).maybeSingle();

    const session = await createStripeCheckoutSession({
      userId,
      email: prof?.email || "",
      returnUrl: data.returnUrl,
      productName: PRO_PRODUCT_NAME,
      unitAmountCents: PRO_PRICE_AMOUNT,
    });

    const url = toAllowedCheckoutRedirectUrl(session.url);
    if (!url) throw new Error("Checkout session returned an invalid URL");
    return { url };
  });
