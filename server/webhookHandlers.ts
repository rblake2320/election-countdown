import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    // Verify and construct the event using Stripe's SDK
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    // Only handle checkout.session.completed events
    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object as any;
    const sessionId = session.id;

    if (!sessionId) {
      console.log('No session ID in webhook event');
      return;
    }

    // Check if already recorded
    const existing = await storage.findDonationByStripeSessionId(sessionId);
    if (existing) {
      console.log('Donation already recorded:', sessionId);
      return;
    }

    const metadata = session.metadata;
    if (!metadata?.userId) {
      console.log('Skipping session without userId:', sessionId);
      return;
    }

    // Store donation record
    await storage.createDonation({
      userId: metadata.userId,
      amount: session.amount_total?.toString() || '0',
      currency: session.currency || 'USD',
      analyticsOptIn: metadata.analyticsOptIn === 'true',
      stripeSessionId: sessionId,
      stripePaymentId: session.payment_intent,
    });

    console.log('Donation recorded:', sessionId);
  }
}
