import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  getProfile,
  identityLoader,
  isVerifiedCampusStudent,
  requireStudent,
  toE164,
} from "./helpers";

/** Threads are stored with a canonical pair so two students never fork a chat. */
function orderPair(first: Id<"users">, second: Id<"users">) {
  return first < second ? { a: first, b: second } : { a: second, b: first };
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Opens (or reuses) a thread with a seller and drops in the first message.
 * Used by both "Contact seller" on a listing and "Message" on a profile.
 */
export const start = mutation({
  args: {
    listingId: v.optional(v.id("listings")),
    otherUserId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    if (args.otherUserId === user._id) {
      throw new Error("You cannot message yourself.");
    }

    const body = args.body.trim().slice(0, 2000);
    if (!body) throw new Error("Write a message before sending it.");

    const counterpart = await ctx.db.get(args.otherUserId);
    if (!counterpart) throw new Error("That student is no longer on CampusMart.");
    const counterpartProfile = await getProfile(ctx, counterpart._id);
    if (!isVerifiedCampusStudent(counterpart) || !counterpartProfile) {
      throw new Error("You can only message verified CampusMart students.");
    }

    let listingTitle: string | null = null;
    if (args.listingId) {
      const listing = await ctx.db.get(args.listingId);
      if (!listing) throw new Error("That post is no longer available.");
      if (listing.sellerId !== args.otherUserId) {
        throw new Error("You can only message the seller about this post.");
      }
      listingTitle = listing.title;
    }

    const pair = orderPair(user._id, args.otherUserId);
    const now = Date.now();

    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) =>
        q.eq("a", pair.a).eq("b", pair.b).eq("listingId", args.listingId),
      )
      .unique();

    let isNewThread = false;
    if (!conversation) {
      const id = await ctx.db.insert("conversations", {
        listingId: args.listingId,
        a: pair.a,
        b: pair.b,
        aUnread: 0,
        bUnread: 0,
        aReadAt: now,
        bReadAt: now,
        lastMessageAt: now,
        lastMessagePreview: body.slice(0, 140),
        lastSenderId: user._id,
        createdAt: now,
      });
      conversation = (await ctx.db.get(id)) as Doc<"conversations">;
      isNewThread = true;
    }

    await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: user._id,
      body,
      createdAt: now,
    });

    const senderIsA = conversation.a === user._id;
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      lastMessagePreview: body.slice(0, 140),
      lastSenderId: user._id,
      aUnread: senderIsA ? conversation.aUnread : conversation.aUnread + 1,
      bUnread: senderIsA ? conversation.bUnread + 1 : conversation.bUnread,
      aReadAt: senderIsA ? now : conversation.aReadAt,
      bReadAt: senderIsA ? conversation.bReadAt : now,
    });

    // First contact about a listing: give the seller a heads-up by SMS if they
    // saved a number. Scheduled, so MessageBird problems cannot fail the
    // message; skipped quietly when there is no number or no key.
    if (isNewThread && listingTitle) {
      const phone = counterpartProfile.phone
        ? toE164(counterpartProfile.phone)
        : null;
      if (phone) {
        ctx.scheduler.runAfter(0, internal.sms.notifySeller, {
          to: phone,
          buyerName: user.name ?? "A student",
          listingTitle,
          preview: body.slice(0, 60),
        });
      }
    }

    return { conversationId: conversation._id };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return [];

    const [asA, asB] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_a", (q) => q.eq("a", viewerId))
        .order("desc")
        .take(80),
      ctx.db
        .query("conversations")
        .withIndex("by_b", (q) => q.eq("b", viewerId))
        .order("desc")
        .take(80),
    ]);

    const load = identityLoader(ctx);
    const rows = [...asA, ...asB].sort((x, y) => y.lastMessageAt - x.lastMessageAt);

    return await Promise.all(
      rows.map(async (conversation) => {
        const viewerIsA = conversation.a === viewerId;
        const otherId = viewerIsA ? conversation.b : conversation.a;
        const other = await load(otherId);
        const listing = conversation.listingId
          ? await ctx.db.get(conversation.listingId)
          : null;

        return {
          _id: conversation._id,
          other,
          initials: initialsOf(other.name),
          unread: viewerIsA ? conversation.aUnread : conversation.bUnread,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          lastSenderIsMe: conversation.lastSenderId === viewerId,
          listing: listing
            ? { _id: listing._id, title: listing.title, kind: listing.kind, price: listing.price ?? null }
            : null,
        };
      }),
    );
  },
});

export const unreadTotal = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return 0;

    const [asA, asB] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_a", (q) => q.eq("a", viewerId))
        .take(80),
      ctx.db
        .query("conversations")
        .withIndex("by_b", (q) => q.eq("b", viewerId))
        .take(80),
    ]);

    return [...asA, ...asB].reduce(
      (total, conversation) =>
        total + (conversation.a === viewerId ? conversation.aUnread : conversation.bUnread),
      0,
    );
  },
});

export const thread = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    if (conversation.a !== viewerId && conversation.b !== viewerId) return null;

    const viewerIsA = conversation.a === viewerId;
    const otherId = viewerIsA ? conversation.b : conversation.a;
    const load = identityLoader(ctx);
    const [other, listing, messages] = await Promise.all([
      load(otherId),
      conversation.listingId ? ctx.db.get(conversation.listingId) : Promise.resolve(null),
      ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .order("asc")
        .take(200),
    ]);

    return {
      _id: conversation._id,
      other,
      initials: initialsOf(other.name),
      unread: viewerIsA ? conversation.aUnread : conversation.bUnread,
      listing: listing
        ? { _id: listing._id, title: listing.title, kind: listing.kind, price: listing.price ?? null }
        : null,
      messages: messages.map((message) => ({
        _id: message._id,
        body: message.body,
        createdAt: message.createdAt,
        mine: message.senderId === viewerId,
      })),
    };
  },
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || (conversation.a !== user._id && conversation.b !== user._id)) {
      throw new Error("This conversation is not available.");
    }

    const body = args.body.trim().slice(0, 2000);
    if (!body) throw new Error("Write a message before sending it.");

    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: user._id,
      body,
      createdAt: now,
    });

    const senderIsA = conversation.a === user._id;
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      lastMessagePreview: body.slice(0, 140),
      lastSenderId: user._id,
      aUnread: senderIsA ? conversation.aUnread : conversation.aUnread + 1,
      bUnread: senderIsA ? conversation.bUnread + 1 : conversation.bUnread,
      aReadAt: senderIsA ? now : conversation.aReadAt,
      bReadAt: senderIsA ? conversation.bReadAt : now,
    });

    return { ok: true };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return { ok: false };

    const now = Date.now();
    if (conversation.a === user._id) {
      if (conversation.aUnread === 0) return { ok: true };
      await ctx.db.patch(conversation._id, { aUnread: 0, aReadAt: now });
    } else if (conversation.b === user._id) {
      if (conversation.bUnread === 0) return { ok: true };
      await ctx.db.patch(conversation._id, { bUnread: 0, bReadAt: now });
    }
    return { ok: true };
  },
});
