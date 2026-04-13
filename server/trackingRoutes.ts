import { Router } from "express";
import crypto from "crypto";
import { db } from "./db";
import { userEvents, shareEvents, referralVisits } from "@shared/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";

const router = Router();

/** Hash IP for privacy-safe bot detection */
function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "ec-salt-2026").digest("hex").slice(0, 16);
}

/**
 * POST /api/track/event
 * Generic event tracking — accepts any event type with metadata
 */
router.post("/event", async (req, res) => {
  try {
    const { eventType, eventData, page, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: "eventType required" });
    }

    const userId = (req as any).user?.id || null;
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "";

    await db.insert(userEvents).values({
      userId,
      sessionId: sessionId || null,
      eventType,
      eventData: eventData ? JSON.stringify(eventData) : null,
      page: page || null,
      referrer: req.headers.referer || null,
      userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
      ipHash: hashIp(ip),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Event tracking error:", err);
    res.json({ ok: true }); // Never fail client-side for tracking
  }
});

/**
 * POST /api/track/share
 * Track share actions with platform, content type, and referral code
 */
router.post("/share", async (req, res) => {
  try {
    const { platform, contentType, sharedUrl } = req.body;

    if (!platform || !contentType) {
      return res.status(400).json({ error: "platform and contentType required" });
    }

    const userId = (req as any).user?.id || null;
    const ecId = (req as any).user?.ecId || null;

    // Generate a unique referral code for this share
    const referralCode = crypto.randomBytes(6).toString("base64url").slice(0, 10);

    await db.insert(shareEvents).values({
      userId,
      ecId,
      platform,
      contentType,
      sharedUrl: sharedUrl || null,
      referralCode,
    });

    res.json({ ok: true, referralCode });
  } catch (err) {
    console.error("Share tracking error:", err);
    res.json({ ok: true });
  }
});

/**
 * POST /api/track/referral
 * Track when someone arrives via a shared link
 */
router.post("/referral", async (req, res) => {
  try {
    const { referralCode, sessionId } = req.body;

    if (!referralCode) {
      return res.status(400).json({ error: "referralCode required" });
    }

    const userId = (req as any).user?.id || null;

    // Look up who shared this
    const [share] = await db
      .select({ ecId: shareEvents.ecId })
      .from(shareEvents)
      .where(eq(shareEvents.referralCode, referralCode))
      .limit(1);

    await db.insert(referralVisits).values({
      referralCode,
      referrerEcId: share?.ecId || null,
      visitorSessionId: sessionId || null,
      visitorUserId: userId,
      convertedToSignup: false,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Referral tracking error:", err);
    res.json({ ok: true });
  }
});

/**
 * POST /api/track/flip (existing endpoint, now enhanced)
 * Track countdown card flips
 */
router.post("/flip", async (req, res) => {
  try {
    const { fromYear, toYear } = req.body;
    const userId = (req as any).user?.id || null;

    // Also log as a generic event for unified analytics
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "";
    await db.insert(userEvents).values({
      userId,
      eventType: "flip",
      eventData: JSON.stringify({ from: fromYear, to: toYear }),
      ipHash: hashIp(ip),
      userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Flip tracking error:", err);
    res.json({ ok: true });
  }
});

/**
 * GET /api/admin/events/export
 * Export all events as JSON for AI training (admin only)
 */
router.get("/admin/events/export", async (req, res) => {
  try {
    // TODO: Add admin auth check
    const events = await db
      .select()
      .from(userEvents)
      .orderBy(desc(userEvents.createdAt))
      .limit(10000);

    res.json({
      exportedAt: new Date().toISOString(),
      count: events.length,
      events,
    });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

/**
 * GET /api/admin/shares/export
 * Export all share events for analytics
 */
router.get("/admin/shares/export", async (req, res) => {
  try {
    const shares = await db
      .select()
      .from(shareEvents)
      .orderBy(desc(shareEvents.createdAt))
      .limit(10000);

    res.json({
      exportedAt: new Date().toISOString(),
      count: shares.length,
      shares,
    });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

/**
 * GET /api/admin/events/summary
 * Aggregate event summary for dashboard
 */
router.get("/admin/events/summary", async (req, res) => {
  try {
    const summary = await db
      .select({
        eventType: userEvents.eventType,
        total: count(),
      })
      .from(userEvents)
      .groupBy(userEvents.eventType)
      .orderBy(desc(count()));

    res.json({ summary });
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ error: "Summary failed" });
  }
});

export default router;
