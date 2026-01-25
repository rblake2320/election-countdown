import { db } from "./db";
import { eq, sql, count } from "drizzle-orm";
import {
  voteIntents,
  donations,
  userPreferences,
  type InsertVoteIntent,
  type VoteIntentRecord,
  type InsertDonation,
  type Donation,
  type InsertUserPreferences,
  type UserPreferences,
} from "@shared/schema";

export interface IStorage {
  // Vote intents
  getVoteIntent(userId: string): Promise<VoteIntentRecord | undefined>;
  upsertVoteIntent(data: InsertVoteIntent): Promise<VoteIntentRecord>;
  getAggregateStats(): Promise<{
    total: number;
    red: number;
    blue: number;
    undecided: number;
  }>;

  // Donations
  createDonation(data: InsertDonation): Promise<Donation>;
  getDonationsByUser(userId: string): Promise<Donation[]>;
  getDonationPrices(): Promise<any[]>;
  findDonationByStripeSessionId(sessionId: string): Promise<Donation | undefined>;

  // User preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(data: InsertUserPreferences): Promise<UserPreferences>;
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

  async upsertVoteIntent(data: InsertVoteIntent): Promise<VoteIntentRecord> {
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
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getAggregateStats(): Promise<{
    total: number;
    red: number;
    blue: number;
    undecided: number;
  }> {
    const results = await db
      .select({
        intent: voteIntents.intent,
        count: count(),
      })
      .from(voteIntents)
      .groupBy(voteIntents.intent);

    const stats = { total: 0, red: 0, blue: 0, undecided: 0 };
    for (const row of results) {
      const c = Number(row.count);
      stats.total += c;
      if (row.intent === "red") stats.red = c;
      else if (row.intent === "blue") stats.blue = c;
      else if (row.intent === "undecided") stats.undecided = c;
    }
    return stats;
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
}

export const storage = new DatabaseStorage();
