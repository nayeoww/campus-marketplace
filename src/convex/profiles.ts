import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import {
  CAMPUS_DOMAIN,
  getProfile,
  isCampusEmail,
  isVerifiedStudent,
  lookupIdentity,
  toE164,
} from "./helpers";

const BRANCHES = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Telecommunication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "AI & Data Science",
  "Management (MBA)",
] as const;

const YEARS = ["1st year", "2nd year", "3rd year", "4th year"] as const;

function normalize(value: string, max: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > max) {
    return trimmed.slice(0, max);
  }
  return trimmed;
}

/**
 * The signed-in student, their profile and the flags the interface needs to
 * decide between "browse", "finish your profile" and "verified student".
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const profile = await getProfile(ctx, userId);
    const campusAccount = isCampusEmail(user.email);

    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      isAnonymous: Boolean(user.isAnonymous),
      emailVerified: isVerifiedStudent(user),
      campusAccount,
      canTrade: !user.isAnonymous && profile !== null,
      memberSince: user._creationTime,
      campusDomain: CAMPUS_DOMAIN,
      profile: profile
        ? {
            _id: profile._id,
            branch: profile.branch,
            year: profile.year,
            hostel: profile.hostel ?? null,
            bio: profile.bio ?? null,
            // Private to the student; only ever used for their own alerts.
            phone: profile.phone ?? null,
          }
        : null,
    };
  },
});

/** Create or update the student profile. Required before posting anything. */
export const saveProfile = mutation({
  args: {
    name: v.string(),
    branch: v.string(),
    year: v.string(),
    hostel: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in with your SSIPMT email to continue.");
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("We could not find your account.");

    const name = normalize(args.name, 60);
    if (name.length < 2) {
      throw new Error("Enter the name your classmates would recognise.");
    }

    const branch = normalize(args.branch, 80);
    if (!BRANCHES.includes(branch as (typeof BRANCHES)[number])) {
      throw new Error("Pick your branch from the list.");
    }

    const year = normalize(args.year, 20);
    if (!YEARS.includes(year as (typeof YEARS)[number])) {
      throw new Error("Pick your current year of study.");
    }

    const now = Date.now();
    const existing = await getProfile(ctx, userId);
    const bio = args.bio ? normalize(args.bio, 280) : undefined;
    const hostel = args.hostel ? normalize(args.hostel, 60) : undefined;

    // An empty string clears the number; anything else must be a valid
    // Indian mobile in E.164 form or the save is rejected.
    let phone: string | undefined;
    let phoneInvalid = false;
    if (args.phone === "") {
      phone = undefined;
    } else if (args.phone) {
      const normalized = toE164(args.phone);
      if (!normalized) {
        phoneInvalid = true;
      }
      phone = normalized ?? undefined;
    }

    if (phoneInvalid) {
      throw new Error(
        "That phone number does not look like an Indian mobile. Include all 10 digits, with or without +91.",
      );
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        branch,
        year,
        bio,
        hostel,
        phone,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        branch,
        year,
        bio,
        hostel,
        phone,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(userId, { name });

    return { ok: true };
  },
});

/** Public student card, used on listing pages and in conversations. */
export const byId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await lookupIdentity(ctx, args.userId);
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
      .order("desc")
      .take(60);

    const live = listings.filter((listing) => listing.status === "live");
    const sold = listings.filter((listing) => listing.status === "sold");
    const profile = await getProfile(ctx, args.userId);

    return {
      ...identity,
      bio: profile?.bio ?? null,
      hostel: profile?.hostel ?? null,
      joinedAt: (await ctx.db.get(args.userId))?._creationTime ?? null,
      liveCount: live.length,
      soldCount: sold.length,
      liveListings: live.slice(0, 6),
    };
  },
});
