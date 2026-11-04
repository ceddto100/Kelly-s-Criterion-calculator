// Upgrade checkout via the Stripe Payment Link configured in the Stripe
// dashboard (price and description are managed there, not in code).
//
// The backend webhook activates the subscription by matching the checkout
// email to the account email, so we prefill the signed-in user's email.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const STRIPE_PAYMENT_LINK: string =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/5kQ5kE2DOdxB1VidMjawo0O';

const fetchSignedInEmail = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/status`, { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.authenticated && data.user?.email ? String(data.user.email) : null;
  } catch {
    return null;
  }
};

export const buildPaymentLinkUrl = (email?: string | null): string => {
  const url = new URL(STRIPE_PAYMENT_LINK);
  if (email) url.searchParams.set('prefilled_email', email);
  return url.toString();
};

/** Send the user to the Stripe Payment Link, prefilled with their email. */
export const openUpgradeCheckout = async (email?: string | null): Promise<void> => {
  const resolvedEmail = email || (await fetchSignedInEmail());
  window.location.assign(buildPaymentLinkUrl(resolvedEmail));
};
