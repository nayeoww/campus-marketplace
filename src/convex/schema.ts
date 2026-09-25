import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/**
 * CampusMart listing kinds:
 *  - `item`    -> buy & sell (textbooks, calculators, hostel gear, ...)
 *  - `service` -> freelance work offered by a student
 *  - `gig`     -> a short one-off task posted by a student
 */
export const listingKindValidator = v.union(
  v.literal("item"),
  v.literal("service"),
  v.literal("gig"),
);
export type ListingKind = Infer<typeof listingKindValidator>;

/**
 * `live` is what the marketplace feeds show. `reserved` means a deal is being
 * settled, `sold` is a completed sale and `closed` is a withdrawn post.
 */
export const listingStatusValidator = v.union(
  v.literal("live"),
  v.literal("reserved"),
  v.literal("sold"),
  v.literal("closed"),
);
export type ListingStatus = Infer<typeof listingStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /** Student profile that is completed after the campus email is verified. */
    profiles: defineTable({
      userId: v.id("users"),
      branch: v.string(),
      year: v.string(),
      hostel: v.optional(v.string()),
      bio: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /** Everything posted by students: items for sale, services and gigs. */
    listings: defineTable({
      kind: listingKindValidator,
      title: v.string(),
      description: v.string(),
      category: v.string(),
      price: v.optional(v.number()),
      priceNote: v.optional(v.string()),
      condition: v.optional(v.string()),
      location: v.optional(v.string()),
      turnaround: v.optional(v.string()),
      images: v.array(v.string()),
      sellerId: v.id("users"),
      status: listingStatusValidator,
      views: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_kind", ["kind", "status", "createdAt"])
      .index("by_seller", ["sellerId", "createdAt"])
      .index("by_created", ["createdAt"]),

    /** Shortlisted listings a student has saved for later. */
    saves: defineTable({
      userId: v.id("users"),
      listingId: v.id("listings"),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_listing", ["userId", "listingId"])
      .index("by_listing", ["listingId"]),

    /** Reports raised from a listing page, reviewed by the campus moderator. */
    reports: defineTable({
      listingId: v.id("listings"),
      reporterId: v.id("users"),
      reason: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_listing", ["listingId"]),

    /**
     * A thread between two students. `a`/`b` are always stored in a canonical
     * order so a pair of students only ever has one thread per listing.
     */
    conversations: defineTable({
      listingId: v.optional(v.id("listings")),
      a: v.id("users"),
      b: v.id("users"),
      aUnread: v.number(),
      bUnread: v.number(),
      aReadAt: v.number(),
      bReadAt: v.number(),
      lastMessageAt: v.number(),
      lastMessagePreview: v.string(),
      lastSenderId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_a", ["a", "lastMessageAt"])
      .index("by_b", ["b", "lastMessageAt"])
      .index("by_pair", ["a", "b", "listingId"]),

    messages: defineTable({
      conversationId: v.id("conversations"),
      senderId: v.id("users"),
      body: v.string(),
      createdAt: v.number(),
    }).index("by_conversation", ["conversationId", "createdAt"]),

    /**
     * One-time codes for campus sign-in. Convex owns the lifecycle: issue
     * (rate limited), deliver (action), then consume once verified.
     */
    otpCodes: defineTable({
      email: v.string(),
      code: v.string(),
      expiresAt: v.number(),
      attempts: v.number(),
      maxAttempts: v.number(),
      createdAt: v.number(),
      deliveredAt: v.optional(v.number()),
      consumedAt: v.optional(v.number()),
      failedReason: v.optional(v.string()),
    }).index("by_email", ["email", "createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
