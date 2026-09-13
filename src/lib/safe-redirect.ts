/** Hardcoded origin — reconstructed hrefs are never the raw (tainted) input. */
const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";
const STRIPE_CHECKOUT_HOST = "checkout.stripe.com";
const MAX_CHECKOUT_URL_LENGTH = 2048;

/**
 * Allowlist a Stripe Checkout URL before any navigation.
 * Rejects non-https, credentials, unexpected hosts, and protocol-relative paths.
 * Returns a newly constructed href from the hardcoded origin, or null.
 */
export function toAllowedCheckoutRedirectUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const candidate = raw.trim();
  if (candidate.length === 0 || candidate.length > MAX_CHECKOUT_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.hostname !== STRIPE_CHECKOUT_HOST) return null;
  if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) return null;

  const safe = new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, STRIPE_CHECKOUT_ORIGIN);
  if (safe.protocol !== "https:" || safe.hostname !== STRIPE_CHECKOUT_HOST) return null;
  return safe.href;
}

/** Navigate only after allowlisting. Uses assign() so href is never set from raw input. */
export function redirectToAllowedCheckoutUrl(raw: unknown): boolean {
  const url = toAllowedCheckoutRedirectUrl(raw);
  if (!url) return false;
  window.location.assign(url);
  return true;
}
