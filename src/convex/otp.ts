import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { CAMPUS_DOMAIN, isCampusEmail } from "./helpers";

/**
 * CampusMart verification codes, handled entirely by Convex.
 *
 * The auth provider is only a bridge: it hands the generated code to
 * `issue`, which rate limits and stores it, then to `deliver`, which posts it
 * to CampusMart's own mail provider. Everything else — expiry, attempts,
 * cooldown, consumption — lives here, and no third-party relay is involved.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

/** CampusMart's own mail provider, called with the deployment's own key. */
const MAIL_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_SENDER = "CampusMart <onboarding@resend.dev>";

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
    const apiKey = process.env.RESEND_API_KEY;

    // Until a mail provider is connected the code is only written to the
    // Convex logs, so a fresh deployment is never a locked door.
    if (!apiKey) {
      console.warn(
        `[CampusMart] No RESEND_API_KEY is set. Sign-in code for ${args.email} is ${args.code}.`,
      );
      await ctx.runMutation(internal.otp.markDelivered, {
        id: args.id,
        ok: false,
        status: 0,
      });
      throw new Error(
        "Resend is not connected yet, so this email could not be sent.",
      );
    }

    const response = await fetch(MAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER,
        to: [args.email],
        subject: `${args.code} is your CampusMart sign-in code`,
        text: `Your CampusMart sign-in code is ${args.code}. It works for fifteen minutes. If you did not ask for it, ignore this email.`,
        html: `
          <div style="background:#f6f2ea;padding:36px 0;font-family:Helvetica,Arial,sans-serif;color:#1a1913;">
            <div style="max-width:540px;margin:0 auto;padding:0 26px;">
              <p style="margin:0 0 26px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7e7a67;">CampusMart &middot; SSIPMT student marketplace</p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Enter this code to finish signing in. It works for fifteen minutes.</p>
              <p style="margin:0 0 26px;font-size:34px;font-weight:bold;letter-spacing:0.2em;color:#1f6b4a;">${args.code}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#4b4838;">If you did not ask for this, ignore the email. Nothing happens until the code is entered.</p>
            </div>
          </div>
        `,
      }),
    });

    await ctx.runMutation(internal.otp.markDelivered, {
      id: args.id,
      ok: response.ok,
      status: response.status,
    });

    if (!response.ok) {
      throw new Error(
        `We could not email your code (mail provider replied ${response.status}). Try again in a moment.`,
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
      failedReason: args.ok
        ? undefined
        : args.status === 0
          ? "no mail provider connected"
          : `mail provider replied ${args.status}`,
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
