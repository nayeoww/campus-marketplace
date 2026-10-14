import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { createAuth } from "./betterAuth";
import { CAMPUS_DOMAIN, isCampusEmail } from "./helpers";

/**
 * Student sign-in codes.
 *
 * Better Auth generates and checks the six-digit code; Convex stays the
 * gatekeeper — campus domain, resend cooldown, per-window caps, attempt
 * counting and the audit trail in `otpCodes`. Convex Auth then turns a
 * successful check into a real session (see auth/emailOtp.ts).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

function normalize(email: string) {
  return email.trim().toLowerCase();
}

function domainError() {
  return `CampusMart is open to SSIPMT students only. Use your @${CAMPUS_DOMAIN} email address.`;
}

/**
 * Called from the sign-in screen. Runs the gate checks, then asks Better Auth
 * to generate a code and email it.
 */
export const request = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) throw new Error(domainError());

    const gate = await ctx.runMutation(internal.otp.prepareGate, { email });
    if (!gate.allowed) throw new Error(gate.message);

    try {
      await createAuth(ctx).api.sendVerificationOTP({
        body: { email, type: "sign-in" },
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      await ctx.runMutation(internal.otp.markSent, { id: gate.id, ok: false, detail });
      throw new Error(
        "The code could not be emailed just now. Try again in a moment.",
      );
    }

    await ctx.runMutation(internal.otp.markSent, { id: gate.id, ok: true });
    return { ok: true as const };
  },
});

/**
 * Confirms a typed code through Better Auth. Runs inside the Convex Credentials
 * authorize step, so a pass here signs the session in. `signInEmailOTP` both
 * verifies and consumes the code, and registers the address the first time.
 */
export const verify = internalAction({
  args: { email: v.string(), otp: v.string() },
  handler: async (ctx, args) => {
    try {
      await createAuth(ctx).api.signInEmailOTP({
        body: { email: normalize(args.email), otp: args.otp },
      });
      return { authenticated: true as const, detail: undefined as string | undefined };
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      return { authenticated: false as const, detail };
    }
  },
});

/**
 * Domain check, resend cooldown, per-window cap and invalidation of older
 * codes, then a fresh audit row.
 */
export const prepareGate = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) {
      return { allowed: false as const, message: domainError(), id: undefined as unknown as never };
    }

    const now = Date.now();
    const recent: Doc<"otpCodes">[] = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email).gte("createdAt", now - WINDOW_MS))
      .collect();

    const lastIssued = recent[recent.length - 1];
    if (lastIssued && now - lastIssued.createdAt < RESEND_COOLDOWN_MS) {
      return {
        allowed: false as const,
        message: `A code went out moments ago. Wait ${Math.ceil(
          (RESEND_COOLDOWN_MS - (now - lastIssued.createdAt)) / 1000,
        )} seconds before asking for another.`,
        id: undefined as unknown as never,
      };
    }

    if (recent.length >= MAX_CODES_PER_WINDOW) {
      const oldest = Math.min(...recent.map((row) => row.createdAt));
      const waitMinutes = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 60000));
      return {
        allowed: false as const,
        message: `That is ${MAX_CODES_PER_WINDOW} codes in ten minutes. Try again in ${waitMinutes} minute${
          waitMinutes === 1 ? "" : "s"
        }.`,
        id: undefined as unknown as never,
      };
    }

    // Only the newest request should ever be verifiable.
    for (const row of recent) {
      if (!row.consumedAt) {
        await ctx.db.patch(row._id, { consumedAt: now, expiresAt: now });
      }
    }

    const id = await ctx.db.insert("otpCodes", {
      email,
      // The code lives in Better Auth; this column only exists in the schema.
      code: "",
      expiresAt: now + WINDOW_MS,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
    });

    return { allowed: true as const, message: undefined as string | undefined, id };
  },
});

export const markSent = internalMutation({
  args: { id: v.id("otpCodes"), ok: v.boolean(), detail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      deliveredAt: args.ok ? Date.now() : undefined,
      failedReason: args.ok ? undefined : args.detail ?? "delivery failed",
    });
    return { ok: true };
  },
});

/** Charges one wrong attempt against the newest live code for the address. */
export const bumpAttempts = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(6);

    const active = rows.find((row) => !row.consumedAt);
    if (!active) return { left: 0, locked: false as const };

    const attempts = active.attempts + 1;
    const locked = attempts >= active.maxAttempts;
    await ctx.db.patch(active._id, {
      attempts,
      consumedAt: locked ? Date.now() : undefined,
      failedReason: locked ? "locked after repeated wrong codes" : undefined,
    });

    return { left: Math.max(0, active.maxAttempts - attempts), locked };
  },
});

/** Retires the audit row once its code has been used or superseded. */
export const consume = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(6);

    const active = rows.find((row) => !row.consumedAt);
    if (active) await ctx.db.patch(active._id, { consumedAt: Date.now() });
    return { ok: true };
  },
});

/**
 * The user behind a verified address. Existing students keep their account;
 * a first-time address gets one with the email already marked verified — the
 * code proving ownership is exactly what that flag stands for.
 */
export const findOrCreateUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) throw new Error(domainError());

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      if (!existing.emailVerificationTime) {
        await ctx.db.patch(existing._id, { emailVerificationTime: Date.now() });
      }
      return { userId: existing._id };
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email,
      emailVerificationTime: now,
    });
    return { userId };
  },
});
