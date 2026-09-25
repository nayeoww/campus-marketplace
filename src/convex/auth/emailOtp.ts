import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { CAMPUS_DOMAIN, isCampusEmail } from "../helpers";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // CampusMart is a closed campus marketplace: no code is ever sent to an
    // address outside the SSIPMT domain, so an outside account cannot exist.
    if (!isCampusEmail(email)) {
      throw new Error(
        `CampusMart is open to SSIPMT students only. Register with your @${CAMPUS_DOMAIN} email address.`,
      );
    }

    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "CampusMart",
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
