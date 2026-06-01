import { Router } from "express";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { verificationCodes } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

/** Generate a 6-digit code */
function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * POST /api/verify/email/send
 * Send a 6-digit verification code to the user's email
 */
router.post("/email/send", async (req, res) => {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, (req as any).user?.id));

    if (!user?.email) {
      return res.status(400).json({ error: "No email on file" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(verificationCodes).values({
      userId: (req as any).user?.id,
      codeType: "email",
      code,
      target: user.email,
      expiresAt,
    });

    // TODO: Send actual email via SendGrid/SES/etc.
    // For now, log it (in production, replace with real email send)
    console.log(`[VERIFY EMAIL] Code ${code} sent to ${user.email} for user ${user.ecId}`);

    // In development, return the code for testing
    const isDev = process.env.NODE_ENV !== "production";
    res.json({
      ok: true,
      message: "Verification code sent to your email",
      ...(isDev ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error("Email verification send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

/**
 * POST /api/verify/email/confirm
 * Verify the 6-digit code
 */
router.post("/email/confirm", async (req, res) => {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: "Invalid code format" });
    }

    // Find the latest unused code for this user
    const [record] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.userId, (req as any).user?.id),
          eq(verificationCodes.codeType, "email"),
          eq(verificationCodes.used, false),
        )
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (!record) {
      return res.status(400).json({ error: "No pending verification. Request a new code." });
    }

    // Check expiry
    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }

    // Check attempts (max 5)
    if (record.attempts >= 5) {
      return res.status(400).json({ error: "Too many attempts. Request a new code." });
    }

    // Increment attempts
    await db
      .update(verificationCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verificationCodes.id, record.id));

    // Check code
    if (record.code !== code) {
      return res.status(400).json({ error: "Incorrect code" });
    }

    // Mark code as used
    await db
      .update(verificationCodes)
      .set({ used: true })
      .where(eq(verificationCodes.id, record.id));

    // Update user's email verification status
    const [updatedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        // Check if phone is also verified to set fully verified
        ...((req as any).user.phoneVerified
          ? { isFullyVerified: true, verifiedAt: new Date(), trustScore: 80 }
          : { trustScore: 40 }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, (req as any).user?.id))
      .returning();

    res.json({
      ok: true,
      emailVerified: true,
      isFullyVerified: updatedUser.isFullyVerified,
    });
  } catch (err) {
    console.error("Email verification confirm error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/**
 * POST /api/verify/phone/send
 * Send a 6-digit verification code via SMS
 */
router.post("/phone/send", async (req, res) => {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: "Valid phone number required" });
    }

    // Save phone to user record
    await db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, (req as any).user?.id));

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(verificationCodes).values({
      userId: (req as any).user?.id,
      codeType: "phone",
      code,
      target: phone,
      expiresAt,
    });

    // TODO: Send actual SMS via Twilio
    // const twilio = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // await twilio.messages.create({ body: `Your Election Countdown code: ${code}`, from: process.env.TWILIO_PHONE, to: phone });
    console.log(`[VERIFY PHONE] Code ${code} sent to ${phone} for user ${(req as any).user?.ecId}`);

    const isDev = process.env.NODE_ENV !== "production";
    res.json({
      ok: true,
      message: "Verification code sent to your phone",
      ...(isDev ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error("Phone verification send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

/**
 * POST /api/verify/phone/confirm
 * Verify the phone 6-digit code
 */
router.post("/phone/confirm", async (req, res) => {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: "Invalid code format" });
    }

    const [record] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.userId, (req as any).user?.id),
          eq(verificationCodes.codeType, "phone"),
          eq(verificationCodes.used, false),
        )
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (!record) {
      return res.status(400).json({ error: "No pending verification. Request a new code." });
    }

    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }

    if (record.attempts >= 5) {
      return res.status(400).json({ error: "Too many attempts. Request a new code." });
    }

    await db
      .update(verificationCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verificationCodes.id, record.id));

    if (record.code !== code) {
      return res.status(400).json({ error: "Incorrect code" });
    }

    await db
      .update(verificationCodes)
      .set({ used: true })
      .where(eq(verificationCodes.id, record.id));

    // Update user's phone verification status
    const [user] = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, (req as any).user?.id));

    const [updatedUser] = await db
      .update(users)
      .set({
        phoneVerified: true,
        ...(user.emailVerified
          ? { isFullyVerified: true, verifiedAt: new Date(), trustScore: 80 }
          : { trustScore: 40 }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, (req as any).user?.id))
      .returning();

    res.json({
      ok: true,
      phoneVerified: true,
      isFullyVerified: updatedUser.isFullyVerified,
    });
  } catch (err) {
    console.error("Phone verification confirm error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/**
 * GET /api/verify/status
 * Get current verification status
 */
router.get("/status", async (req, res) => {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const [user] = await db
      .select({
        ecId: users.ecId,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        isFullyVerified: users.isFullyVerified,
        verifiedAt: users.verifiedAt,
        trustScore: users.trustScore,
      })
      .from(users)
      .where(eq(users.id, (req as any).user?.id));

    res.json(user);
  } catch (err) {
    console.error("Verification status error:", err);
    res.status(500).json({ error: "Failed to get status" });
  }
});

export default router;
