import { createClient } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import type {
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

/**
 * Better Auth, wired in as the verifier behind Convex Auth.
 *
 * It owns exactly one job: generating a six-digit code for an address, emailing
 * it and checking it back. Users, profiles and sessions stay with Convex Auth —
 * so we deliberately do *not* install the `convex()` plugin or swap
 * `convex/auth.config.ts`, which would make Better Auth try to issue its own
 * Convex tokens and fight the existing sign-in. For the same reason there are
 * no HTTP routes mounted for it.
 *
 * `allowedAttempts` and `expiresIn` mirror the limits the Convex side already
 * enforces. Delivery is not done here — see `createAuth` below.
 */
export const authComponent = createClient<DataModel>(components.betterAuth);

type Ctx =
  | GenericActionCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericQueryCtx<DataModel>;

/**
 * `captureOtp` receives the code Better Auth just generated. We hand delivery
 * over to the caller rather than sending from inside the plugin, because Better
 * Auth dispatches `sendVerificationOTP` as a background task and swallows
 * anything it throws — a failed send would silently look like a success.
 */
export const createAuth = (ctx: Ctx, captureOtp?: (otp: string) => void) =>
  betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.CONVEX_SITE_URL,
    database: authComponent.adapter(ctx),
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        resendStrategy: "rotate",
        generateOTP() {
          // Same strength as Better Auth's default (CSPRNG), but handed to the
          // caller so it can be delivered with errors visible.
          const buffer = new Uint32Array(1);
          crypto.getRandomValues(buffer);
          const otp = String(buffer[0] % 1_000_000).padStart(6, "0");
          captureOtp?.(otp);
          return otp;
        },
        async sendVerificationOTP() {
          // Delivery is the caller's job; see `createAuth` above.
        },
      }),
    ],
  });
