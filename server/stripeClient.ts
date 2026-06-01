import Stripe from 'stripe';

function getStripeKeys() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    throw new Error(
      'STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables are required. ' +
      'Get these from https://dashboard.stripe.com/apikeys'
    );
  }

  return { secretKey, publishableKey };
}

export async function getUncachableStripeClient() {
  const { secretKey } = getStripeKeys();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = getStripeKeys();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = getStripeKeys();
  return secretKey;
}
