import { CAMPUS_DOMAIN } from "./helpers";

/**
 * Delivery for the sign-in codes. Better Auth generates the code but does not
 * send it, so this is the one piece we own: a single Resend call per code.
 *
 * `RESEND_FROM_EMAIL` must be an address on a domain verified in Resend. Until
 * a domain is verified, Resend only delivers to the account owner's own address
 * from `onboarding@resend.dev`.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendOtpEmail(email: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Sign-in is not configured yet — add your Resend key as RESEND_API_KEY in the Keys tab.",
    );
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "CampusMart <onboarding@resend.dev>";

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${otp} is your CampusMart sign-in code`,
      html: otpEmail(otp),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `The code could not be emailed (mail service replied ${response.status}). ${detail}`.trim(),
    );
  }
}

function otpEmail(otp: string) {
  return `
  <div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;background:#e8ebed;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#b3421a;font-weight:700">
        CampusMart
      </p>
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#333333">
        Your CampusMart sign-in code
      </h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563">
        Enter this code to finish signing in. It expires in ten minutes and can be used once.
      </p>
      <div style="font-size:34px;font-weight:700;letter-spacing:.28em;color:#e05d38;background:#fdece5;border-radius:14px;padding:18px;text-align:center">
        ${otp}
      </div>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280">
        If you did not ask for this, you can ignore this email — nobody can sign in without the code.
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280">
        Only @${CAMPUS_DOMAIN} addresses can use CampusMart.
      </p>
    </div>
  </div>`;
}
