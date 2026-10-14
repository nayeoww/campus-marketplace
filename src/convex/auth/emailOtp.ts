import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { CAMPUS_DOMAIN, isCampusEmail } from "../helpers";

/**
 * Email sign-in for CampusMart.
 *
 * The student types the six-digit code Better Auth emailed them; `otp.verify`
 * checks it against Better Auth and only then hands Convex Auth a user id,
 * which creates the session. The provider id stays `email-otp` because the
 * client signs in with `signIn("email-otp", ...)`.
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

    const result = await ctx.runAction(internal.otp.verify, { email, otp });
    if (!result.authenticated) {
      // Wrong or expired: charge the attempt so repeated guessing locks out.
      await ctx.runMutation(internal.otp.bumpAttempts, { email });
      throw new Error(
        "That code did not match. Check the six digits and try again, or send a new code.",
      );
    }

    const { userId } = await ctx.runMutation(internal.otp.findOrCreateUser, {
      email,
    });
    await ctx.runMutation(internal.otp.consume, { email });

    return { userId };
  },
});
