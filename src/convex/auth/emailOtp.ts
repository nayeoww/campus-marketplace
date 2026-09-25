import { Email } from "@convex-dev/auth/providers/Email";
import type { ActionCtx } from "../_generated/server";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { internal } from "../_generated/api";

/**
 * The provider is only a bridge. It generates a six digit code and hands it to
 * `otp.issue` (rate limit + storage) — a Convex function. Nothing about the code
 * lifecycle lives outside the deployment, and no mail transport is involved:
 * the sign-in screen reads the code back from `otp.pendingCode`.
 *
 * The library passes its action context as a second argument to
 * `sendVerificationRequest` even though its typings omit it (the library's own
 * source carries a ts-expect-error for this), so it stays optional here.
 */
type OtpActionCtx = Pick<ActionCtx, "runMutation">;

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({
    identifier: email,
    token,
  }: {
    identifier: string;
    token: string;
  }, context?: unknown) {
    const ctx = context as OtpActionCtx | undefined;
    if (!ctx?.runMutation) {
      throw new Error("Sign-in is not available right now. Try again in a moment.");
    }

    const issued = await ctx.runMutation(internal.otp.issue, {
      email,
      code: token,
    });

    if (!issued.allowed) {
      throw new Error(issued.message);
    }
  },
});
