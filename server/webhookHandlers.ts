import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Process webhook with stripe-replit-sync (this syncs Stripe data to DB)
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Parse webhook event to get session ID
    try {
      const event = JSON.parse(payload.toString());
      
      // Only handle checkout.session.completed events
      if (event.type !== 'checkout.session.completed') {
        return;
      }

      const sessionId = event.data?.object?.id;
      if (!sessionId) {
        console.log('No session ID in webhook event');
        return;
      }

      // Wait for stripe-replit-sync to finish syncing this specific session
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Query the specific session from stripe schema
      const result = await db.execute(
        sql`
          SELECT id, customer, amount_total, currency, metadata, payment_status, payment_intent
          FROM stripe.checkout_sessions
          WHERE id = ${sessionId}
            AND status = 'complete'
            AND payment_status = 'paid'
          LIMIT 1
        `
      );

      const session = result.rows[0] as any;
      if (!session) {
        console.log('Session not found or not completed:', sessionId);
        return;
      }

      // Check if already recorded
      const existing = await storage.findDonationByStripeSessionId(session.id);
      if (existing) {
        console.log('Donation already recorded:', session.id);
        return;
      }

      // Extract metadata
      const metadata = typeof session.metadata === 'string' 
        ? JSON.parse(session.metadata) 
        : session.metadata;

      if (!metadata?.userId) {
        console.log('Skipping session without userId:', session.id);
        return;
      }

      // Store donation record
      await storage.createDonation({
        userId: metadata.userId,
        amount: session.amount_total?.toString() || '0',
        currency: session.currency || 'USD',
        analyticsOptIn: metadata.analyticsOptIn === 'true',
        stripeSessionId: session.id,
        stripePaymentId: session.payment_intent,
      });

      console.log('Donation recorded:', session.id);
    } catch (error: any) {
      console.error('Error handling webhook event:', error.message);
    }
  }
}
