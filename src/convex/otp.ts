import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { CAMPUS_DOMAIN, isCampusEmail } from "./helpers";

/**
 * CampusMart verification codes, handled entirely by Convex.
 *
 * The auth provider is only a bridge: it hands the code to `issue`, which rate
 * limits and stores it. Everything else — expiry, attempts, cooldown,
 * consumption — lives here, and the sign-in screen reads the code back from
 * `pendingCode` instead of it being mailed. No external service is involved.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

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

/**
 * The code currently waiting to be entered, read back by the sign-in screen.
 *
 * CampusMart runs the whole code lifecycle inside Convex and hands the code
 * straight to the student, so there is no transport to configure. The trade-off
 * is deliberate and worth knowing: anyone who knows a valid @ssipmt.com address
 * can sign in as it, so connect a real transport (Resend, SMTP, anything the
 * provider can call) before opening this to the whole campus.
 */
export const pendingCode = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) return { code: null };

    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(3);

    const now = Date.now();
    const active = rows.find((row) => !row.consumedAt && row.expiresAt > now);

    return { code: active?.code ?? null };
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
