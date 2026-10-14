import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { CAMPUS_DOMAIN, isCampusEmail } from "./helpers";

/**
 * Email sign-in codes, delivered and verified by MojoAuth.
 *
 * Convex stays the gatekeeper: it checks the campus domain, applies the same
 * cooldown and per-window caps as before, and keeps the audit trail in the
 * `otpCodes` table. MojoAuth generates the code, emails it and confirms it —
 * the code itself never passes through this deployment.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const MOJOAUTH_ENDPOINT = "https://api.mojoauth.com";

function normalize(email: string) {
  return email.trim().toLowerCase();
}

type MojoResponse = {
  state_id?: string;
  status?: string;
  authenticated?: boolean;
  message?: string;
  code?: number;
  oauth?: { access_token?: string };
};

function domainError() {
  return `CampusMart is open to SSIPMT students only. Use your @${CAMPUS_DOMAIN} email address.`;
}

/**
 * The MojoAuth key, read from whichever name the deployment uses. The official
 * docs call it MOJOAUTH_API_KEY; older setups used MOJOAUTH.
 */
function mojoKey() {
  return process.env.MOJOAUTH_API_KEY ?? process.env.MOJOAUTH;
}

function missingKeyError() {
  return new Error(
    "Sign-in is not configured yet — add your MojoAuth key as MOJOAUTH_API_KEY in the Keys tab.",
  );
}

/**
 * Called from the sign-in screen. Runs the gate checks, then asks MojoAuth to
 * email a fresh code for the address.
 */
export const request = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!isCampusEmail(email)) throw new Error(domainError());

    const gate = await ctx.runMutation(internal.mojoOtp.prepareGate, { email });
    if (!gate.allowed) throw new Error(gate.message);

    const apiKey = mojoKey();
    if (!apiKey) throw missingKeyError();

    const response = await fetch(`${MOJOAUTH_ENDPOINT}/users/emailotp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => ({}))) as MojoResponse;

    await ctx.runMutation(internal.mojoOtp.markSent, {
      id: gate.id,
      ok: response.ok,
      // MojoAuth hands back a state_id with the send; verification requires it.
      stateId: data.state_id,
      detail: response.ok ? undefined : `mojoauth ${response.status} ${data.message ?? ""}`.trim(),
    });

    if (!response.ok) {
      throw new Error(
        `The code could not be emailed (mail service replied ${response.status}). Try again in a moment.`,
      );
    }

    return { ok: true as const };
  },
});

/**
 * Confirms a code the student typed in, straight against MojoAuth. Runs inside
 * the Convex Credentials authorize step, so a pass here signs the session in.
 */
export const verify = internalAction({
  args: { email: v.string(), otp: v.string(), stateId: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const apiKey = mojoKey();
    if (!apiKey) throw missingKeyError();

    // MojoAuth verifies by challenge id, not by email. Keep the email-only
    // shape as a fallback for rows issued before the state id was stored.
    const body = args.stateId
      ? { state_id: args.stateId, otp: args.otp }
      : { email: args.email, otp: args.otp };

    const response = await fetch(`${MOJOAUTH_ENDPOINT}/users/emailotp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as MojoResponse;

    if (!response.ok) {
      return { authenticated: false as const, detail: data.message ?? `status ${response.status}` };
    }

    // Accept any success signal MojoAuth may return, but never override an
    // explicit `authenticated: false`.
    const authenticated =
      data.authenticated !== false &&
      (data.authenticated === true ||
        data.status === "success" ||
        Boolean(data.oauth?.access_token));

    return { authenticated, detail: undefined as string | undefined };
  },
});

/**
 * The MojoAuth challenge id for the newest live code on an address. Verification
 * cannot read the database itself, so `authorize` fetches it through this query
 * before calling `verify`.
 */
export const pendingChallenge = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    const rows = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(6);

    const active = rows.find((row) => !row.consumedAt);
    return { stateId: active?.stateId ?? null };
  },
});

/**
 * Domain check, resend cooldown, per-window cap, invalidation of older codes,
 * then a fresh audit row. Same policy `otp.issue` always applied.
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
      // The code lives in MojoAuth; this column only exists in the schema.
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
  args: {
    id: v.id("otpCodes"),
    ok: v.boolean(),
    stateId: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      deliveredAt: args.ok ? Date.now() : undefined,
      stateId: args.ok ? args.stateId : undefined,
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
