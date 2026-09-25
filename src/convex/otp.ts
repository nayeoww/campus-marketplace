import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { CAMPUS_DOMAIN, isCampusEmail } from "./helpers";

/**
 * CampusMart verification codes, handled entirely by Convex.
 *
 * The auth provider is only a bridge: it hands the generated code to
 * `issue`, which rate limits and stores it, then to `deliver`, which emails it.
 * Everything else — expiry, attempts, cooldown, consumption — lives here.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

/** Shared delivery endpoint on the platform mail relay. */
const OTP_ENDPOINT = "https://auth.freebuff.app/send_otp";
const OTP_ENDPOINT_KEY = "fb_email_2crN1hqIArZP2bEfvjp5Qik4";

function normalize(email: string) {
  return email.trim().toLowerCase();
}

/** Called by the auth provider the moment a code is generated. */
export const issue = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);

    if (!isCampusEmail(email)) {
      return {
        allowed: false,
        message: `CampusMart is open to SSIPMT students only. Use your @${CAMPUS_DOMAIN} email address.`,
      };
    }

    const now = Date.now();
    const recent: Doc<"otpCodes">[] = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email).gte("createdAt", now - WINDOW_MS))
      .collect();

    const lastIssued = recent[recent.length - 1];
    if (lastIssued && now - lastIssued.createdAt < RESEND_COOLDOWN_MS) {
      return {
        allowed: false,
        message: `A code went out moments ago. Wait ${Math.ceil(
          (RESEND_COOLDOWN_MS - (now - lastIssued.createdAt)) / 1000,
        )} seconds before asking for another.`,
      };
    }

    if (recent.length >= MAX_CODES_PER_WINDOW) {
      const oldest = Math.min(...recent.map((row) => row.createdAt));
      const waitMinutes = Math.max(
        1,
        Math.ceil((oldest + WINDOW_MS - now) / 60000),
      );
      return {
        allowed: false,
        message: `That is ${MAX_CODES_PER_WINDOW} codes in ten minutes. Try again in ${waitMinutes} minute${
          waitMinutes === 1 ? "" : "s"
        }.`,
      };
    }

    // Only the newest code should ever work.
    for (const row of recent) {
      if (!row.consumedAt) {
        await ctx.db.patch(row._id, { consumedAt: now, expiresAt: now });
      }
    }

    const id = await ctx.db.insert("otpCodes", {
      email,
      code: args.code,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
    });

    return { allowed: true, id, expiresAt: now + CODE_TTL_MS };
  },
});

/** Emails the code. Convex action only — the frontend never sends mail. */
export const deliver = internalAction({
  args: { id: v.id("otpCodes"), email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(OTP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": OTP_ENDPOINT_KEY,
      },
      body: JSON.stringify({
        to: args.email,
        otp: args.code,
        appName: process.env.VLY_APP_NAME || "CampusMart",
      }),
    });

    await ctx.runMutation(internal.otp.markDelivered, {
      id: args.id,
      ok: response.ok,
      status: response.status,
    });

    if (!response.ok) {
      throw new Error(
        `We could not email your code (relay replied ${response.status}). Try again in a moment.`,
      );
    }

    return { ok: true };
  },
});

export const markDelivered = internalMutation({
  args: { id: v.id("otpCodes"), ok: v.boolean(), status: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      deliveredAt: args.ok ? Date.now() : undefined,
      failedReason: args.ok ? undefined : `relay status ${args.status}`,
    });
    return { ok: true };
  },
});

/**
 * Checks a code against the stored record. Called after the session is
 * confirmed so the record reflects reality (used for lockouts and auditing).
 */
export const confirmCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(6);

    const active = rows.find((row) => !row.consumedAt);
    if (!active) return { ok: false, reason: "no-active-code" as const };

    const now = Date.now();
    if (now > active.expiresAt) {
      await ctx.db.patch(active._id, { consumedAt: now });
      return { ok: false, reason: "expired" as const };
    }

    if (active.code !== args.code.trim()) {
      const attempts = active.attempts + 1;
      await ctx.db.patch(active._id, {
        attempts,
        consumedAt: attempts >= active.maxAttempts ? now : undefined,
      });
      return {
        ok: false,
        reason: attempts >= active.maxAttempts ? ("locked" as const) : ("mismatch" as const),
        attemptsLeft: Math.max(0, active.maxAttempts - attempts),
      };
    }

    await ctx.db.patch(active._id, { consumedAt: now });
    return { ok: true as const };
  },
});

/** Drives the "code sent / resend in 30s / attempts left" state on /auth. */
export const status = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) {
      return { active: false, expiresAt: null, retryInSeconds: 0, attemptsLeft: MAX_ATTEMPTS };
    }

    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(6);

    const active = rows.find((row) => !row.consumedAt);
    const lastIssued = rows[0];
    const now = Date.now();
    const cooldownLeft = lastIssued
      ? Math.max(0, Math.ceil((lastIssued.createdAt + RESEND_COOLDOWN_MS - now) / 1000))
      : 0;

    return {
      active: Boolean(active && active.expiresAt > now),
      expiresAt: active?.expiresAt ?? null,
      retryInSeconds: cooldownLeft,
      attemptsLeft: active ? Math.max(0, active.maxAttempts - active.attempts) : MAX_ATTEMPTS,
    };
  },
});
