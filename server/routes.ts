import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertVoteIntentSchema, insertUserPreferencesSchema, insertDonationSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { voteIntentLimiter, donationLimiter } from "./middleware/rateLimit";
import { requireTurnstile, isTurnstileConfigured } from "./middleware/turnstile";
import { z } from "zod";

// Threshold for showing aggregate bar
const AGGREGATE_THRESHOLD = 50000;
// Minimum group size for privacy
const MIN_GROUP_SIZE = 50;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup auth BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Get Stripe publishable key (for frontend)
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      return res.json({ publishableKey });
    } catch (error) {
      console.error("Error fetching Stripe config:", error);
      return res.status(500).json({ message: "Stripe not configured" });
    }
  });

  // Get aggregate stats (public endpoint, gated by threshold)
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getAggregateStats();
      
      if (stats.total < AGGREGATE_THRESHOLD) {
        return res.json({
          total: stats.total,
          showBar: false,
          threshold: AGGREGATE_THRESHOLD,
          message: `We need ${AGGREGATE_THRESHOLD - stats.total} more participants to show results.`,
        });
      }

      const redPercent = stats.total > 0 ? (stats.red / stats.total) * 100 : 50;
      const bluePercent = stats.total > 0 ? (stats.blue / stats.total) * 100 : 50;

      return res.json({
        total: stats.total,
        showBar: true,
        red: stats.red,
        blue: stats.blue,
        independent: stats.independent,
        undecided: stats.undecided,
        redPercent: Math.round(redPercent * 10) / 10,
        bluePercent: Math.round(bluePercent * 10) / 10,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get current user's vote intent
  app.get("/api/intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const intent = await storage.getVoteIntent(userId);
      return res.json(intent || null);
    } catch (error) {
      console.error("Error fetching intent:", error);
      return res.status(500).json({ message: "Failed to fetch intent" });
    }
  });

  // Submit or update vote intent (with rate limiting and bot protection)
  app.post("/api/intent", voteIntentLimiter, isAuthenticated, requireTurnstile, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get existing intent to track changes
      const existingIntent = await storage.getVoteIntent(userId);
      const previousIntent = existingIntent?.intent || null;
      
      // Check if user can specify custom candidate (requires $1+ donation)
      let customCandidate = req.body.customCandidate;
      if (customCandidate) {
        const donations = await storage.getDonationsByUser(userId);
        const totalDonated = donations.reduce((sum, d) => sum + (parseInt(String(d.amount)) || 0), 0);
        if (totalDonated < 100) { // 100 cents = $1
          customCandidate = undefined; // Strip custom candidate if not a donor
        }
      }
      
      const parsed = insertVoteIntentSchema.safeParse({
        ...req.body,
        customCandidate,
        userId,
      });

      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: parsed.error.flatten() 
        });
      }

      const result = await storage.upsertVoteIntent(parsed.data, previousIntent);
      return res.json(result);
    } catch (error) {
      console.error("Error saving intent:", error);
      return res.status(500).json({ message: "Failed to save intent" });
    }
  });

  // Get user preferences
  app.get("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prefs = await storage.getUserPreferences(userId);
      return res.json(prefs || { userId, preferredQuote: null, theme: "system" });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      return res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // Update user preferences
  app.post("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const parsed = insertUserPreferencesSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: parsed.error.flatten() 
        });
      }

      const result = await storage.upsertUserPreferences(parsed.data);
      return res.json(result);
    } catch (error) {
      console.error("Error saving preferences:", error);
      return res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // Get donation prices
  app.get("/api/donation-prices", async (req, res) => {
    try {
      const prices = await storage.getDonationPrices();
      return res.json({ prices });
    } catch (error) {
      console.error("Error fetching donation prices:", error);
      return res.status(500).json({ message: "Failed to fetch prices" });
    }
  });

  // Create donation checkout session (with rate limiting and bot protection)
  app.post("/api/donate", donationLimiter, isAuthenticated, requireTurnstile, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const email = req.user.claims.email;
      const { priceId, analyticsOptIn } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID required" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Create checkout session using real price ID
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: email,
        metadata: {
          userId,
          analyticsOptIn: analyticsOptIn ? 'true' : 'false',
        },
        success_url: `${req.protocol}://${req.get('host')}?donation=success`,
        cancel_url: `${req.protocol}://${req.get('host')}?donation=canceled`,
      });

      return res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating donation session:", error);
      return res.status(500).json({ message: "Failed to create donation session" });
    }
  });

  // Get user's donations
  app.get("/api/donations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const donations = await storage.getDonationsByUser(userId);
      return res.json({ donations });
    } catch (error) {
      console.error("Error fetching donations:", error);
      return res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  // Admin analytics endpoint - requires both authentication AND admin secret
  app.get("/api/admin/analytics", isAuthenticated, async (req: any, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Forbidden - invalid admin credentials" });
    }

    try {
      // Get vote intent breakdown
      const allVotes = await storage.getAllVoteIntents();
      
      const votesByIntent = {
        red: allVotes.filter(v => v.intent === 'red').length,
        blue: allVotes.filter(v => v.intent === 'blue').length,
        independent: allVotes.filter(v => v.intent === 'independent').length,
        undecided: allVotes.filter(v => v.intent === 'undecided').length,
        total: allVotes.length
      };

      // Breakdown by state
      const votesByState: Record<string, { red: number; blue: number; independent: number; undecided: number; total: number }> = {};
      allVotes.forEach(v => {
        if (!votesByState[v.state]) {
          votesByState[v.state] = { red: 0, blue: 0, independent: 0, undecided: 0, total: 0 };
        }
        if (v.intent === 'red' || v.intent === 'blue' || v.intent === 'independent' || v.intent === 'undecided') {
          votesByState[v.state][v.intent]++;
        }
        votesByState[v.state].total++;
      });

      // Breakdown by age range
      const votesByAge: Record<string, { red: number; blue: number; independent: number; undecided: number; total: number }> = {};
      allVotes.forEach(v => {
        const age = v.ageRange || 'not_provided';
        if (!votesByAge[age]) {
          votesByAge[age] = { red: 0, blue: 0, independent: 0, undecided: 0, total: 0 };
        }
        if (v.intent === 'red' || v.intent === 'blue' || v.intent === 'independent' || v.intent === 'undecided') {
          votesByAge[age][v.intent]++;
        }
        votesByAge[age].total++;
      });

      // Get donation totals
      const allDonations = await storage.getAllDonations();
      const donationStats = {
        totalDonations: allDonations.length,
        totalAmount: allDonations.reduce((sum, d) => sum + (parseInt(String(d.amount)) || 0), 0),
        analyticsOptInCount: allDonations.filter(d => d.analyticsOptIn).length
      };

      // Votes over time (by day)
      const votesOverTime: Record<string, number> = {};
      allVotes.forEach(v => {
        const date = v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : 'unknown';
        votesOverTime[date] = (votesOverTime[date] || 0) + 1;
      });

      // Get vote switching statistics
      const voteSwitchStats = await storage.getVoteSwitchStats();
      const switchingUsers = voteSwitchStats.length;
      const totalSwitches = voteSwitchStats.reduce((sum, s) => sum + Number(s.switchCount), 0);
      
      // Custom candidates from donors
      const customCandidates: Record<string, number> = {};
      allVotes.forEach(v => {
        if (v.customCandidate) {
          const candidate = v.customCandidate.toLowerCase().trim();
          customCandidates[candidate] = (customCandidates[candidate] || 0) + 1;
        }
      });

      return res.json({
        votesByIntent,
        votesByState,
        votesByAge,
        donationStats,
        votesOverTime,
        voteSwitching: {
          usersWhoSwitched: switchingUsers,
          totalSwitches: totalSwitches,
          topSwitchers: voteSwitchStats.slice(0, 10)
        },
        customCandidates,
        thresholdMet: allVotes.length >= AGGREGATE_THRESHOLD,
        currentThreshold: AGGREGATE_THRESHOLD
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Donor analytics endpoint - requires $1+ donation to access
  app.get("/api/donor/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has made at least $1 donation
      const userDonations = await storage.getDonationsByUser(userId);
      const totalDonated = userDonations.reduce((sum, d) => sum + (parseInt(String(d.amount)) || 0), 0);
      
      if (totalDonated < 100) { // 100 cents = $1
        return res.status(403).json({ 
          message: "Donate at least $1 to access detailed analytics",
          totalDonated: totalDonated / 100
        });
      }

      const allVotes = await storage.getAllVoteIntents();
      
      // Helper to convert percentage to range (handles zero division)
      const toRange = (percent: number): string => {
        if (isNaN(percent) || !isFinite(percent)) return "0-5%";
        const lower = Math.floor(percent / 5) * 5;
        const upper = lower + 5;
        return `${lower}-${upper}%`;
      };

      // Total vote breakdown with ranges
      const total = allVotes.length;
      
      // If no votes yet, return empty breakdown
      if (total === 0) {
        return res.json({
          votesByIntent: { redRange: "0-5%", blueRange: "0-5%", independentRange: "0-5%", undecidedRange: "0-5%", total: 0 },
          votesByState: {},
          votesByAge: {},
          thresholdMet: false,
          donorTier: totalDonated >= 10000 ? 'premium' : totalDonated >= 2500 ? 'supporter' : 'basic'
        });
      }
      
      const redCount = allVotes.filter(v => v.intent === 'red').length;
      const blueCount = allVotes.filter(v => v.intent === 'blue').length;
      const independentCount = allVotes.filter(v => v.intent === 'independent').length;
      const undecidedCount = allVotes.filter(v => v.intent === 'undecided').length;
      
      const votesByIntent = {
        redRange: toRange((redCount / total) * 100),
        blueRange: toRange((blueCount / total) * 100),
        independentRange: toRange((independentCount / total) * 100),
        undecidedRange: toRange((undecidedCount / total) * 100),
        total: total
      };

      // Breakdown by state (only show states with MIN_GROUP_SIZE+ votes)
      const stateGroups: Record<string, { red: number; blue: number; independent: number; undecided: number; total: number }> = {};
      allVotes.forEach(v => {
        if (!stateGroups[v.state]) {
          stateGroups[v.state] = { red: 0, blue: 0, independent: 0, undecided: 0, total: 0 };
        }
        if (v.intent === 'red' || v.intent === 'blue' || v.intent === 'independent' || v.intent === 'undecided') {
          stateGroups[v.state][v.intent]++;
        }
        stateGroups[v.state].total++;
      });
      
      const votesByState: Record<string, { redRange: string; blueRange: string; independentRange: string; undecidedRange: string; total: string }> = {};
      Object.entries(stateGroups).forEach(([state, data]) => {
        if (data.total >= MIN_GROUP_SIZE) {
          votesByState[state] = {
            redRange: toRange((data.red / data.total) * 100),
            blueRange: toRange((data.blue / data.total) * 100),
            independentRange: toRange((data.independent / data.total) * 100),
            undecidedRange: toRange((data.undecided / data.total) * 100),
            total: data.total >= 1000 ? `${Math.floor(data.total / 1000)}k+` : `${Math.floor(data.total / 10) * 10}+`
          };
        }
      });

      // Breakdown by age (only show groups with MIN_GROUP_SIZE+ votes)
      const ageGroups: Record<string, { red: number; blue: number; independent: number; undecided: number; total: number }> = {};
      allVotes.forEach(v => {
        const age = v.ageRange || 'not_provided';
        if (!ageGroups[age]) {
          ageGroups[age] = { red: 0, blue: 0, independent: 0, undecided: 0, total: 0 };
        }
        if (v.intent === 'red' || v.intent === 'blue' || v.intent === 'independent' || v.intent === 'undecided') {
          ageGroups[age][v.intent]++;
        }
        ageGroups[age].total++;
      });
      
      const votesByAge: Record<string, { redRange: string; blueRange: string; independentRange: string; undecidedRange: string; total: string }> = {};
      Object.entries(ageGroups).forEach(([age, data]) => {
        if (data.total >= MIN_GROUP_SIZE) {
          votesByAge[age] = {
            redRange: toRange((data.red / data.total) * 100),
            blueRange: toRange((data.blue / data.total) * 100),
            independentRange: toRange((data.independent / data.total) * 100),
            undecidedRange: toRange((data.undecided / data.total) * 100),
            total: data.total >= 1000 ? `${Math.floor(data.total / 1000)}k+` : `${Math.floor(data.total / 10) * 10}+`
          };
        }
      });

      return res.json({
        votesByIntent,
        votesByState,
        votesByAge,
        thresholdMet: allVotes.length >= AGGREGATE_THRESHOLD,
        donorTier: totalDonated >= 10000 ? 'premium' : totalDonated >= 2500 ? 'supporter' : 'basic'
      });
    } catch (error) {
      console.error("Error fetching donor analytics:", error);
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  return httpServer;
}
