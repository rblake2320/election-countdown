import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Age range enum values
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeRange = typeof AGE_RANGES[number];

// Vote intent enum values (red=Republican, blue=Democrat, independent=Third party, undecided=Hasn't decided)
export const VOTE_INTENTS = ["red", "blue", "independent", "undecided"] as const;
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
  intent: varchar("intent", { length: 20 }).notNull(), // red, blue, independent, undecided
  ageRange: varchar("age_range", { length: 10 }), // 18-24, 25-34, etc.
  state: varchar("state", { length: 2 }).notNull(), // Required: US state code
  city: varchar("city", { length: 100 }), // Optional
  sex: varchar("sex", { length: 20 }), // Optional: male, female, other, prefer_not_to_say
  customCandidate: varchar("custom_candidate", { length: 100 }), // Optional: for donors to specify a candidate
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("vote_intents_state_idx").on(table.state),
  index("vote_intents_party_idx").on(table.intent),
]);

// Vote history table - tracks all intent changes over time
export const voteHistory = pgTable("vote_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  previousIntent: varchar("previous_intent", { length: 20 }), // null for first vote
  newIntent: varchar("new_intent", { length: 20 }).notNull(),
  customCandidate: varchar("custom_candidate", { length: 100 }), // Track candidate changes too
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vote_history_user_idx").on(table.userId),
  index("vote_history_date_idx").on(table.createdAt),
]);

// Donations table
export const donations = pgTable("donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  stripeSessionId: varchar("stripe_session_id").unique(),
  stripePaymentId: varchar("stripe_payment_id"),
  amount: varchar("amount").notNull(), // Store as cents (string for precision)
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  analyticsOptIn: boolean("analytics_opt_in").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("donations_user_id_idx").on(table.userId),
]);

// User preferences for customization (quotes, theme, etc.)
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  preferredQuote: varchar("preferred_quote"), // null = random, "none" = hide, or specific quote id
  theme: varchar("theme", { length: 10 }).default("system"), // light, dark, system
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User sessions table - tracks login events and session duration
export const userSessions = pgTable("user_sessions_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  loginAt: timestamp("login_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  durationSeconds: integer("duration_seconds").default(0),
}, (table) => [
  index("user_sessions_user_idx").on(table.userId),
  index("user_sessions_login_idx").on(table.loginAt),
]);

// Countdown flips table - tracks when users switch between 2026 and 2028 views
export const countdownFlips = pgTable("countdown_flips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // nullable for anonymous tracking
  fromYear: varchar("from_year", { length: 10 }).notNull(),
  toYear: varchar("to_year", { length: 10 }).notNull(),
  flippedAt: timestamp("flipped_at").defaultNow().notNull(),
}, (table) => [
  index("countdown_flips_date_idx").on(table.flippedAt),
  index("countdown_flips_user_idx").on(table.userId),
]);

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
  customCandidate: z.string().max(100).optional(),
});

export const insertVoteHistorySchema = createInsertSchema(voteHistory).omit({
  id: true,
  createdAt: true,
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

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
});

export const insertCountdownFlipSchema = createInsertSchema(countdownFlips).omit({
  id: true,
  flippedAt: true,
});

// ─── User Events (granular click/view/interaction tracking for AI training) ───
export const USER_EVENT_TYPES = [
  "page_view",         // landed on a page
  "flip",              // flipped between countdown cards
  "view_duration",     // how long they stayed on a specific card
  "theme_toggle",      // toggled dark/light mode
  "register_click",    // clicked Register Now / Visit Vote.gov
  "share_click",       // clicked a share button (header share icon)
  "share_twitter",     // shared to Twitter/X
  "share_facebook",    // shared to Facebook
  "share_copy_link",   // copied share link
  "share_native",      // used native share API
  "share_timestamp",   // shared their join timestamp from profile
  "sign_in_click",     // clicked sign in
  "sign_up_complete",  // completed registration
  "vote_intent_submit",// submitted or changed vote intent
  "quote_shuffle",     // shuffled to a different quote
  "quote_hide",        // hid quotes
  "state_select",      // selected a state in voter registration
  "external_link",     // clicked an external link (vote.gov, etc.)
] as const;
export type UserEventType = typeof USER_EVENT_TYPES[number];

export const userEvents = pgTable("user_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),         // null for anonymous visitors
  sessionId: varchar("session_id"),   // browser session fingerprint
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: text("event_data"),      // JSON string with event-specific metadata
  page: varchar("page", { length: 100 }), // which page/view they were on
  referrer: varchar("referrer", { length: 500 }), // where they came from
  userAgent: varchar("user_agent", { length: 500 }),
  ipHash: varchar("ip_hash", { length: 64 }), // hashed IP for bot detection, not raw IP
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("user_events_type_idx").on(table.eventType),
  index("user_events_user_idx").on(table.userId),
  index("user_events_session_idx").on(table.sessionId),
  index("user_events_date_idx").on(table.createdAt),
]);

// ─── Share Tracking (dedicated table for share analytics) ───
export const SHARE_PLATFORMS = [
  "twitter", "facebook", "copy_link", "native", "email", "sms", "other"
] as const;
export type SharePlatform = typeof SHARE_PLATFORMS[number];

export const shareEvents = pgTable("share_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),        // null for anonymous
  ecId: varchar("ec_id"),            // the sharer's public EC-ID
  platform: varchar("platform", { length: 20 }).notNull(), // twitter, facebook, copy_link, native
  contentType: varchar("content_type", { length: 50 }).notNull(), // "countdown", "vote_intent", "timestamp", "general"
  sharedUrl: varchar("shared_url", { length: 500 }),
  referralCode: varchar("referral_code", { length: 20 }), // unique per share for tracking downstream clicks
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("share_events_user_idx").on(table.userId),
  index("share_events_platform_idx").on(table.platform),
  index("share_events_date_idx").on(table.createdAt),
  index("share_events_referral_idx").on(table.referralCode),
]);

// ─── Referral Tracking (when someone arrives via a shared link) ───
export const referralVisits = pgTable("referral_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralCode: varchar("referral_code", { length: 20 }).notNull(), // matches shareEvents.referralCode
  referrerEcId: varchar("referrer_ec_id"), // who shared the link
  visitorSessionId: varchar("visitor_session_id"),
  visitorUserId: varchar("visitor_user_id"), // if they sign up
  convertedToSignup: boolean("converted_to_signup").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("referral_visits_code_idx").on(table.referralCode),
  index("referral_visits_date_idx").on(table.createdAt),
]);

// ─── Verification Codes (email + phone) ───
export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  codeType: varchar("code_type", { length: 10 }).notNull(), // "email" or "phone"
  code: varchar("code", { length: 6 }).notNull(), // 6-digit code
  target: varchar("target", { length: 100 }).notNull(), // email address or phone number
  used: boolean("used").default(false).notNull(),
  attempts: integer("attempts").default(0).notNull(), // track failed attempts
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("verification_codes_user_idx").on(table.userId),
  index("verification_codes_type_idx").on(table.codeType),
]);

// ─── Schemas ───
export const insertUserEventSchema = createInsertSchema(userEvents).omit({
  id: true,
  createdAt: true,
});

export const insertShareEventSchema = createInsertSchema(shareEvents).omit({
  id: true,
  createdAt: true,
});

export const insertReferralVisitSchema = createInsertSchema(referralVisits).omit({
  id: true,
  createdAt: true,
});

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertVoteIntent = z.infer<typeof insertVoteIntentSchema>;
export type VoteIntentRecord = typeof voteIntents.$inferSelect;

export type InsertVoteHistory = z.infer<typeof insertVoteHistorySchema>;
export type VoteHistoryRecord = typeof voteHistory.$inferSelect;

export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Donation = typeof donations.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

export type InsertCountdownFlip = z.infer<typeof insertCountdownFlipSchema>;
export type CountdownFlip = typeof countdownFlips.$inferSelect;

export type InsertUserEvent = z.infer<typeof insertUserEventSchema>;
export type UserEvent = typeof userEvents.$inferSelect;

export type InsertShareEvent = z.infer<typeof insertShareEventSchema>;
export type ShareEvent = typeof shareEvents.$inferSelect;

export type InsertReferralVisit = z.infer<typeof insertReferralVisitSchema>;
export type ReferralVisit = typeof referralVisits.$inferSelect;

export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;
export type VerificationCode = typeof verificationCodes.$inferSelect;
