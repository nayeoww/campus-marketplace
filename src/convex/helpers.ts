import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** The only email domain allowed to register on CampusMart. */
export const CAMPUS_DOMAIN = "ssipmt.com";

/**
 * India-only normalisation to E.164 (+91…), the form SMS providers expect.
 * Strips spaces, dashes and brackets, drops a leading 00 or 0, and prefixes
 * 91 when the student typed a 10-digit local number.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d{10,13}$/.test(digits)) return null;

  let body = digits.replace(/^\+/, "");
  if (body.startsWith("00")) body = body.slice(2);
  if (body.length === 10) {
    body = `91${body}`;
  } else if (body.startsWith("0") && body.length === 11) {
    body = `91${body.slice(1)}`;
  }
  // Anything else already carries the 91 country code.

  if (!/^91[6-9]\d{9}$/.test(body)) return null;
  return `+${body}`;
}

type Ctx = QueryCtx | MutationCtx;

export function isCampusEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${CAMPUS_DOMAIN}`);
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Sign in with your SSIPMT email to do that.");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("We could not find your account. Try signing in again.");
  }
  return user;
}

export async function getProfile(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** A student is verified once they have confirmed the code sent to their email. */
export function isVerifiedStudent(user: Doc<"users">) {
  return Boolean(user.emailVerificationTime);
}

export function isVerifiedCampusStudent(user: Doc<"users">) {
  return isCampusEmail(user.email) && isVerifiedStudent(user);
}

/**
 * Anyone posting, saving or messaging must have an account with a finished
 * student profile — anonymous guest sessions can only browse.
 */
export async function requireStudent(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (user.isAnonymous) {
    throw new Error(
      "Guest sessions can only browse. Register with your SSIPMT email to post on CampusMart.",
    );
  }
  if (!isVerifiedCampusStudent(user)) {
    throw new Error(
      "Verify your SSIPMT email before using student features on CampusMart.",
    );
  }
  const profile = await getProfile(ctx, user._id);
  if (!profile) {
    throw new Error(
      "Add your branch and year before posting on CampusMart. Open your profile to finish setup.",
    );
  }
  return { user, profile };
}

export type StudentIdentity = {
  _id: Id<"users">;
  name: string;
  branch: string | null;
  year: string | null;
  verified: boolean;
  campusAccount: boolean;
};

/** Batched, cached identity lookups so feeds stay cheap. */
export function identityLoader(ctx: Ctx) {
  const cache = new Map<string, StudentIdentity>();

  return async function load(userId: Id<"users">): Promise<StudentIdentity> {
    const hit = cache.get(userId);
    if (hit) return hit;

    const [user, profile] = await Promise.all([
      ctx.db.get(userId),
      getProfile(ctx, userId),
    ]);

    const identity: StudentIdentity = {
      _id: userId,
      name: user?.name?.trim() || user?.email?.split("@")[0] || "SSIPMT student",
      branch: profile?.branch ?? null,
      year: profile?.year ?? null,
      verified: user ? isVerifiedStudent(user) : false,
      campusAccount: isCampusEmail(user?.email),
    };

    cache.set(userId, identity);
    return identity;
  };
}

export async function lookupIdentity(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<StudentIdentity> {
  return await identityLoader(ctx)(userId);
}
