import { db } from "./db";
import { eq, sql, count, desc } from "drizzle-orm";
import {
  voteIntents,
  voteHistory,
  donations,
  userPreferences,
  userSessions,
  countdownFlips,
  type InsertVoteIntent,
  type VoteIntentRecord,
  type InsertVoteHistory,
  type VoteHistoryRecord,
  type InsertDonation,
  type Donation,
  type InsertUserPreferences,
  type UserPreferences,
  type UserSession,
  type CountdownFlip,
} from "@shared/schema";

export interface IStorage {
  // Vote intents
  getVoteIntent(userId: string): Promise<VoteIntentRecord | undefined>;
  upsertVoteIntent(data: InsertVoteIntent, previousIntent?: string | null): Promise<VoteIntentRecord>;
  getAggregateStats(): Promise<{
    total: number;
    red: number;
    blue: number;
    independent: number;
    undecided: number;
  }>;

  // Vote history
  logVoteChange(data: InsertVoteHistory): Promise<VoteHistoryRecord>;
  getVoteHistory(userId: string): Promise<VoteHistoryRecord[]>;
  getAllVoteHistory(): Promise<VoteHistoryRecord[]>;
  getVoteSwitchStats(): Promise<{ userId: string; switchCount: number }[]>;

  // Donations
  createDonation(data: InsertDonation): Promise<Donation>;
  getDonationsByUser(userId: string): Promise<Donation[]>;
  getDonationPrices(): Promise<any[]>;
  findDonationByStripeSessionId(sessionId: string): Promise<Donation | undefined>;

  // User preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(data: InsertUserPreferences): Promise<UserPreferences>;

  // Admin analytics
  getAllVoteIntents(): Promise<VoteIntentRecord[]>;
  getVoteIntentsPage(offset: number, limit: number): Promise<VoteIntentRecord[]>;
  getAllDonations(): Promise<Donation[]>;

  // Session tracking
  upsertUserSession(userId: string): Promise<void>;
  getSessionStats(): Promise<{
    totalLogins: number;
    uniqueActiveUsersToday: number;
    avgSessionDurationSeconds: number;
  }>;

  // Countdown flip tracking
  recordCountdownFlip(userId: string | null, fromYear: string, toYear: string): Promise<void>;
  getFlipStats(): Promise<{ date: string; count: number }[]>;
}

export class DatabaseStorage implements IStorage {
  // Vote intents
  async getVoteIntent(userId: string): Promise<VoteIntentRecord | undefined> {
    const [result] = await db
      .select()
      .from(voteIntents)
      .where(eq(voteIntents.userId, userId));
    return result;
  }

  async upsertVoteIntent(data: InsertVoteIntent, previousIntent?: string | null): Promise<VoteIntentRecord> {
    const [result] = await db
      .insert(voteIntents)
      .values(data)
      .onConflictDoUpdate({
        target: voteIntents.userId,
        set: {
          intent: data.intent,
          ageRange: data.ageRange,
          state: data.state,
          city: data.city,
          sex: data.sex,
          customCandidate: data.customCandidate,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Log the vote change to history
    await this.logVoteChange({
      userId: data.userId,
      previousIntent: previousIntent || null,
      newIntent: data.intent,
      customCandidate: data.customCandidate || null,
    });
    
    return result;
  }

  async getAggregateStats(): Promise<{
    total: number;
    red: number;
    blue: number;
    independent: number;
    undecided: number;
  }> {
    const results = await db
      .select({
        intent: voteIntents.intent,
        count: count(),
      })
      .from(voteIntents)
      .groupBy(voteIntents.intent);

    const stats = { total: 0, red: 0, blue: 0, independent: 0, undecided: 0 };
    for (const row of results) {
      const c = Number(row.count);
      stats.total += c;
      if (row.intent === "red") stats.red = c;
      else if (row.intent === "blue") stats.blue = c;
      else if (row.intent === "independent") stats.independent = c;
      else if (row.intent === "undecided") stats.undecided = c;
    }
    return stats;
  }

  // Vote history methods
  async logVoteChange(data: InsertVoteHistory): Promise<VoteHistoryRecord> {
    const [result] = await db.insert(voteHistory).values(data).returning();
    return result;
  }

  async getVoteHistory(userId: string): Promise<VoteHistoryRecord[]> {
    return db.select().from(voteHistory).where(eq(voteHistory.userId, userId)).orderBy(desc(voteHistory.createdAt));
  }

  async getAllVoteHistory(): Promise<VoteHistoryRecord[]> {
    return db.select().from(voteHistory).orderBy(desc(voteHistory.createdAt));
  }

  async getVoteSwitchStats(): Promise<{ userId: string; switchCount: number }[]> {
    const result = await db.execute(
      sql`
        SELECT user_id as "userId", COUNT(*) - 1 as "switchCount"
        FROM vote_history
        GROUP BY user_id
        HAVING COUNT(*) > 1
        ORDER BY "switchCount" DESC
      `
    );
    return result.rows as { userId: string; switchCount: number }[];
  }

  // Donations
  async createDonation(data: InsertDonation): Promise<Donation> {
    const [result] = await db.insert(donations).values(data).returning();
    return result;
  }

  async getDonationsByUser(userId: string): Promise<Donation[]> {
    return db.select().from(donations).where(eq(donations.userId, userId));
  }

  // Stripe data queries
  async getDonationPrices() {
    const result = await db.execute(
      sql`
        SELECT pr.id, pr.unit_amount, pr.currency, pr.metadata
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE p.name = 'Election Countdown Donation'
          AND pr.active = true
        ORDER BY pr.unit_amount ASC
      `
    );
    return result.rows;
  }

  async findDonationByStripeSessionId(sessionId: string): Promise<Donation | undefined> {
    const [result] = await db
      .select()
      .from(donations)
      .where(eq(donations.stripeSessionId, sessionId));
    return result;
  }

  // Admin analytics methods
  async getAllVoteIntents(): Promise<VoteIntentRecord[]> {
    return db.select().from(voteIntents);
  }

  async getVoteIntentsPage(offset: number, limit: number): Promise<VoteIntentRecord[]> {
    return db.select().from(voteIntents)
      .orderBy(voteIntents.createdAt, voteIntents.id)
      .limit(limit).offset(offset);
  }

  async getAllDonations(): Promise<Donation[]> {
    return db.select().from(donations);
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [result] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return result;
  }

  async upsertUserPreferences(data: InsertUserPreferences): Promise<UserPreferences> {
    const [result] = await db
      .insert(userPreferences)
      .values(data)
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          preferredQuote: data.preferredQuote,
          theme: data.theme,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Session tracking
  async upsertUserSession(userId: string): Promise<void> {
    const now = new Date();
    // Check for an existing session in the last 30 minutes
    const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const existing = await db.execute(
      sql`
        SELECT id, login_at, last_seen_at
        FROM user_sessions_analytics
        WHERE user_id = ${userId}
          AND last_seen_at > ${cutoff}
        ORDER BY last_seen_at DESC
        LIMIT 1
      `
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as { id: string; login_at: Date; last_seen_at: Date };
      const loginAt = new Date(row.login_at);
      const durationSeconds = Math.floor((now.getTime() - loginAt.getTime()) / 1000);
      await db.execute(
        sql`
          UPDATE user_sessions_analytics
          SET last_seen_at = ${now}, duration_seconds = ${durationSeconds}
          WHERE id = ${row.id}
        `
      );
    } else {
      // New session
      await db.insert(userSessions).values({
        userId,
        loginAt: now,
        lastSeenAt: now,
        durationSeconds: 0,
      });
    }
  }

  async getSessionStats(): Promise<{
    totalLogins: number;
    uniqueActiveUsersToday: number;
    avgSessionDurationSeconds: number;
  }> {
    const result = await db.execute(
      sql`
        SELECT
          COUNT(*) as total_logins,
          COUNT(DISTINCT CASE WHEN last_seen_at >= CURRENT_DATE THEN user_id END) as unique_active_users_today,
          COALESCE(AVG(NULLIF(duration_seconds, 0)), 0) as avg_duration_seconds
        FROM user_sessions_analytics
      `
    );
    const row = result.rows[0] as { total_logins: string | number; unique_active_users_today: string | number; avg_duration_seconds: string | number };
    return {
      totalLogins: Number(row.total_logins) || 0,
      uniqueActiveUsersToday: Number(row.unique_active_users_today) || 0,
      avgSessionDurationSeconds: Math.round(Number(row.avg_duration_seconds) || 0),
    };
  }

  // Countdown flip tracking
  async recordCountdownFlip(userId: string | null, fromYear: string, toYear: string): Promise<void> {
    await db.insert(countdownFlips).values({
      userId: userId || null,
      fromYear,
      toYear,
    });
  }

  async getFlipStats(): Promise<{ date: string; count: number }[]> {
    const result = await db.execute(
      sql`
        SELECT
          DATE(flipped_at) as date,
          COUNT(*) as count
        FROM countdown_flips
        GROUP BY DATE(flipped_at)
        ORDER BY date DESC
        LIMIT 30
      `
    );
    return (result.rows as any[]).map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    }));
  }
}

export const storage = new DatabaseStorage();
