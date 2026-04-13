import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ecId: varchar("ec_id").unique(), // Permanent public ID like EC-A7K2M9, assigned at registration, never changes
  email: varchar("email").unique(),
  phone: varchar("phone", { length: 20 }),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  passwordSalt: varchar("password_salt"),
  // Verification status
  emailVerified: boolean("email_verified").default(false).notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  isFullyVerified: boolean("is_fully_verified").default(false).notNull(), // true when both email + phone verified
  verifiedAt: timestamp("verified_at"), // when full verification completed
  // Trust scoring
  trustScore: integer("trust_score").default(0).notNull(), // 0-100, increases with verification + activity
  flaggedAsBot: boolean("flagged_as_bot").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
