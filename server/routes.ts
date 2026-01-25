import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertVoteIntentSchema, insertUserPreferencesSchema } from "@shared/schema";
import { z } from "zod";

// Threshold for showing aggregate bar
const AGGREGATE_THRESHOLD = 50000;
// Minimum group size for privacy (prevent doxxing by aggregation)
const MIN_GROUP_SIZE = 50;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup auth BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Get aggregate stats (public endpoint, but gated by threshold)
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getAggregateStats();
      
      // Only show real stats if we've hit the threshold
      if (stats.total < AGGREGATE_THRESHOLD) {
        return res.json({
          total: stats.total,
          showBar: false,
          threshold: AGGREGATE_THRESHOLD,
          message: `We need ${AGGREGATE_THRESHOLD - stats.total} more participants to show results.`,
        });
      }

      // Calculate percentages
      const redPercent = stats.total > 0 ? (stats.red / stats.total) * 100 : 50;
      const bluePercent = stats.total > 0 ? (stats.blue / stats.total) * 100 : 50;

      return res.json({
        total: stats.total,
        showBar: true,
        red: stats.red,
        blue: stats.blue,
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

  // Submit or update vote intent
  app.post("/api/intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const parsed = insertVoteIntentSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: parsed.error.flatten() 
        });
      }

      const result = await storage.upsertVoteIntent(parsed.data);
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

  return httpServer;
}
