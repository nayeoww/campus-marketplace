import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { CAMPUS_DOMAIN, isCampusEmail } from "../helpers";

/**
 * Email sign-in for CampusMart, verified by MojoAuth.
 *
 * The student types the six-digit code MojoAuth emailed them; this provider
 * checks it against MojoAuth and only then hands Convex Auth a user id, which
 * creates the session. The name `emailOtp` is kept because the client signs in
 * with `signIn("email-otp", ...)`.
 */
export const emailOtp: ConvexCredentialsConfig = ConvexCredentials({
  id: "email-otp",
  authorize: async (credentials, ctx): Promise<{ userId: Id<"users"> } | null> => {
    const email = String(credentials.email ?? "").trim().toLowerCase();
    const otp = String(credentials.code ?? credentials.otp ?? "").trim();

    if (!isCampusEmail(email)) {
      throw new Error(
        `CampusMart is open to SSIPMT students only. Use your @${CAMPUS_DOMAIN} email address.`,
      );
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new Error("Enter the six digits from the email we sent you.");
    }

    // MojoAuth verifies against the challenge id it issued when the code was
    // sent, so fetch that before checking the digits.
    const { stateId } = await ctx.runQuery(internal.mojoOtp.pendingChallenge, {
      email,
    });

    const result = await ctx.runAction(internal.mojoOtp.verify, {
      email,
      otp,
      stateId: stateId ?? undefined,
    });
    if (!result.authenticated) {
      // Wrong or expired: charge the attempt so repeated guessing locks out.
      await ctx.runMutation(internal.mojoOtp.bumpAttempts, { email });
      throw new Error(
        "That code did not match. Check the six digits and try again, or send a new code.",
      );
    }

    const { userId } = await ctx.runMutation(internal.mojoOtp.findOrCreateUser, {
      email,
    });
    await ctx.runMutation(internal.mojoOtp.consume, { email });

    return { userId };
  },
});
