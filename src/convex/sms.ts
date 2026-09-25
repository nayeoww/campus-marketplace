"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * SMS alerts through MessageBird (Bird).
 *
 * The one place CampusMart reaches outside campus: when a buyer opens a new
 * conversation about a listing, the seller gets a short text so the message
 * does not sit unseen. Everything else stays inside the app on purpose.
 *
 * Runs as a Node action (HTTP calls live here) and is scheduled from the
 * messaging mutation, so a MessageBird hiccup can never fail the message
 * itself. The phone number is resolved by the caller — this function only
 * delivers.
 */

const API_ROOT = "https://rest.messagebird.com";

/** Short, factual, and names the marketplace so the text is not confusing. */
function alertBody(buyerName: string, itemTitle: string, preview: string) {
  const clipped = preview.length > 60 ? `${preview.slice(0, 57)}…` : preview;
  return `CampusMart: ${buyerName} messaged you about "${itemTitle}": "${clipped}". Open CampusMart to reply.`;
}

export const notifySeller = internalAction({
  args: {
    to: v.string(),
    buyerName: v.string(),
    listingTitle: v.string(),
    preview: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.MESSAGEBIRD_API_KEY;
    if (!apiKey) {
      console.warn(
        `[CampusMart] MESSAGEBIRD_API_KEY is not set, so ${args.to} was not texted about a new message.`,
      );
      return { sent: false, reason: "no api key" as const };
    }

    // MessageBird's classic REST API takes application/x-www-form-urlencoded.
    const form = new URLSearchParams();
    form.set("recipients", args.to.replace(/^\+/, ""));
    form.set("originator", "CampusMart");
    form.set("body", alertBody(args.buyerName, args.listingTitle, args.preview));

    const response = await fetch(`${API_ROOT}/messages`, {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[CampusMart] MessageBird replied ${response.status}: ${detail.slice(0, 300)}`,
      );
      return { sent: false, reason: `messagebird ${response.status}` as const };
    }

    return { sent: true as const };
  },
});
