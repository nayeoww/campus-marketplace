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
import { sendOtpEmail } from "./email";

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
 * The code is delivered by `sendOtpEmail`; `allowedAttempts` and `expiresIn`
 * mirror the limits the Convex side already enforces.
 */
export const authComponent = createClient<DataModel>(components.betterAuth);

type Ctx =
  | GenericActionCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericQueryCtx<DataModel>;

export const createAuth = (ctx: Ctx) =>
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
        async sendVerificationOTP({ email, otp }) {
          await sendOtpEmail(email, otp);
        },
      }),
    ],
  });
