import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Age range enum values
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeRange = typeof AGE_RANGES[number];

// Vote intent enum values
export const VOTE_INTENTS = ["red", "blue", "undecided"] as const;
export type VoteIntent = typeof VOTE_INTENTS[number];

// US States for validation
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
] as const;

// Vote intents table - stores user voting intentions and demographics
export const voteIntents = pgTable("vote_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  intent: varchar("intent", { length: 20 }).notNull(), // red, blue, undecided
  ageRange: varchar("age_range", { length: 10 }), // 18-24, 25-34, etc.
  state: varchar("state", { length: 2 }).notNull(), // Required: US state code
  city: varchar("city", { length: 100 }), // Optional
  sex: varchar("sex", { length: 20 }), // Optional: male, female, other, prefer_not_to_say
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Donations table
export const donations = pgTable("donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  stripePaymentId: varchar("stripe_payment_id"),
  amount: varchar("amount").notNull(), // Store as string to avoid floating point issues
  currency: varchar("currency", { length: 3 }).default("USD"),
  analyticsOptIn: boolean("analytics_opt_in").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User preferences for customization (quotes, theme, etc.)
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  preferredQuote: varchar("preferred_quote"), // null = random, "none" = hide, or specific quote id
  theme: varchar("theme", { length: 10 }).default("system"), // light, dark, system
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for validation
export const insertVoteIntentSchema = createInsertSchema(voteIntents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  intent: z.enum(VOTE_INTENTS),
  ageRange: z.enum(AGE_RANGES).optional(),
  state: z.string().length(2),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
});

export const insertDonationSchema = createInsertSchema(donations).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertVoteIntent = z.infer<typeof insertVoteIntentSchema>;
export type VoteIntentRecord = typeof voteIntents.$inferSelect;

export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Donation = typeof donations.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
