import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { identityLoader, requireStudent } from "./helpers";
import { listingKindValidator, listingStatusValidator } from "./schema";

const MAX_IMAGES = 6;
const FEED_POOL = 120;
const MAX_PRICE = 500000;

type Sort = "recent" | "price_low" | "price_high";

const sortValidator = v.optional(
  v.union(v.literal("recent"), v.literal("price_low"), v.literal("price_high")),
);

function clean(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function validateImages(images: string[]) {
  if (images.length > MAX_IMAGES) {
    throw new Error(`Add up to ${MAX_IMAGES} photos per post.`);
  }
  return images.filter((image) => typeof image === "string" && image.length > 0 && image.length < 600);
}

function normalizePrice(price: number | undefined) {
  if (price === undefined) return undefined;
  if (Number.isNaN(price) || price < 0) {
    throw new Error("Enter a price of zero or more.");
  }
  if (price > MAX_PRICE) {
    throw new Error("That price looks too high for a campus listing.");
  }
  return Math.round(price);
}

async function decorate(
  ctx: QueryCtx,
  rows: Doc<"listings">[],
  viewerId: Id<"users"> | null,
) {
  const load = identityLoader(ctx);
  let savedIds = new Set<string>();
  if (viewerId) {
    const saves = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .take(300);
    savedIds = new Set(saves.map((save) => save.listingId as string));
  }

  return await Promise.all(
    rows.map(async (listing) => ({
      ...listing,
      seller: await load(listing.sellerId),
      saved: savedIds.has(listing._id),
      isOwner: viewerId === listing.sellerId,
    })),
  );
}

/**
 * The marketplace feed. Reading is open so anyone can window-shop a campus,
 * while posting, saving and messaging stay behind the student gate.
 */
export const feed = query({
  args: {
    kind: listingKindValidator,
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sort: sortValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 36, 1), 60);
    const sort: Sort = args.sort ?? "recent";

    const pool = await ctx.db
      .query("listings")
      .withIndex("by_kind", (q) => q.eq("kind", args.kind).eq("status", "live"))
      .order("desc")
      .take(FEED_POOL);

    const needle = args.search?.trim().toLowerCase() ?? "";
    const load = identityLoader(ctx);

    const matched: Doc<"listings">[] = [];
    for (const listing of pool) {
      if (args.category && listing.category !== args.category) continue;
      if (needle) {
        const seller = await load(listing.sellerId);
        const haystack = `${listing.title} ${listing.description} ${listing.category} ${seller.name}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      matched.push(listing);
    }

    if (sort === "price_low") {
      matched.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sort === "price_high") {
      matched.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }

    return {
      total: matched.length,
      listings: await decorate(ctx, matched.slice(0, limit), viewerId),
    };
  },
});

export const byId = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) return null;
    const viewerId = await getAuthUserId(ctx);
    const [view] = await decorate(ctx, [listing], viewerId);

    const related = await ctx.db
      .query("listings")
      .withIndex("by_kind", (q) => q.eq("kind", listing.kind).eq("status", "live"))
      .order("desc")
      .take(24);

    return {
      listing: view,
      related: (await decorate(ctx, related.filter((row) => row._id !== listing._id).slice(0, 3), viewerId)),
    };
  },
});

/** Everything the signed-in student has posted, in any status. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return { listings: [], counts: { live: 0, reserved: 0, sold: 0, closed: 0 } };
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_seller", (q) => q.eq("sellerId", viewerId))
      .order("desc")
      .take(120);

    const counts = { live: 0, reserved: 0, sold: 0, closed: 0 };
    for (const row of rows) counts[row.status] += 1;

    return { listings: await decorate(ctx, rows, viewerId), counts };
  },
});

export const saved = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return [];
    const saves = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", viewerId))
      .order("desc")
      .take(60);

    const rows: Doc<"listings">[] = [];
    for (const save of saves) {
      const listing = await ctx.db.get(save.listingId);
      if (listing && listing.status !== "closed") rows.push(listing);
    }
    return await decorate(ctx, rows, viewerId);
  },
});

export const campusStats = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").take(400);
    const sellers = new Set(listings.map((row) => row.sellerId as string));
    return {
      listings: listings.filter((row) => row.status === "live").length,
      items: listings.filter((row) => row.kind === "item" && row.status === "live").length,
      services: listings.filter((row) => row.kind === "service" && row.status === "live").length,
      students: sellers.size,
    };
  },
});

export const create = mutation({
  args: {
    kind: listingKindValidator,
    title: v.string(),
    description: v.string(),
    category: v.string(),
    price: v.optional(v.number()),
    priceNote: v.optional(v.string()),
    condition: v.optional(v.string()),
    location: v.optional(v.string()),
    turnaround: v.optional(v.string()),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);

    const title = clean(args.title, 90);
    if (title.length < 4) {
      throw new Error("Give your post a title of at least 4 characters.");
    }
    const description = args.description.trim().slice(0, 2000);
    if (description.length < 15) {
      throw new Error("Add a description of at least 15 characters so buyers know what they get.");
    }
    const category = clean(args.category, 40);
    if (!category) {
      throw new Error("Pick a category for your post.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("listings", {
      kind: args.kind,
      title,
      description,
      category,
      price: normalizePrice(args.price),
      priceNote: args.priceNote ? clean(args.priceNote, 40) : undefined,
      condition: args.condition ? clean(args.condition, 40) : undefined,
      location: args.location ? clean(args.location, 60) : undefined,
      turnaround: args.turnaround ? clean(args.turnaround, 60) : undefined,
      images: validateImages(args.images),
      sellerId: user._id,
      status: "live",
      views: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  },
});

export const update = mutation({
  args: {
    id: v.id("listings"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    price: v.optional(v.number()),
    priceNote: v.optional(v.string()),
    condition: v.optional(v.string()),
    location: v.optional(v.string()),
    turnaround: v.optional(v.string()),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing || listing.sellerId !== user._id) {
      throw new Error("You can only edit posts that you created.");
    }

    const title = clean(args.title, 90);
    if (title.length < 4) {
      throw new Error("Give your post a title of at least 4 characters.");
    }
    const description = args.description.trim().slice(0, 2000);
    if (description.length < 15) {
      throw new Error("Add a description of at least 15 characters so buyers know what they get.");
    }

    await ctx.db.patch(args.id, {
      title,
      description,
      category: clean(args.category, 40),
      price: normalizePrice(args.price),
      priceNote: args.priceNote ? clean(args.priceNote, 40) : undefined,
      condition: args.condition ? clean(args.condition, 40) : undefined,
      location: args.location ? clean(args.location, 60) : undefined,
      turnaround: args.turnaround ? clean(args.turnaround, 60) : undefined,
      images: validateImages(args.images),
      updatedAt: Date.now(),
    });

    return { id: args.id };
  },
});

export const setStatus = mutation({
  args: { id: v.id("listings"), status: listingStatusValidator },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing || listing.sellerId !== user._id) {
      throw new Error("You can only change posts that you created.");
    }
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing || listing.sellerId !== user._id) {
      throw new Error("You can only delete posts that you created.");
    }

    const saves = await ctx.db
      .query("saves")
      .withIndex("by_listing", (q) => q.eq("listingId", args.id))
      .take(200);
    for (const save of saves) {
      await ctx.db.delete(save._id);
    }

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_listing", (q) => q.eq("listingId", args.id))
      .take(200);
    for (const report of reports) {
      await ctx.db.delete(report._id);
    }

    const views = await ctx.db
      .query("listingViews")
      .withIndex("by_listing", (q) => q.eq("listingId", args.id))
      .take(200);
    for (const view of views) {
      await ctx.db.delete(view._id);
    }
    if (views.length === 200) {
      await ctx.scheduler.runAfter(
        0,
        internal.listings.deleteListingViewsBatch,
        { listingId: args.id },
      );
    }

    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const deleteListingViewsBatch = internalMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const views = await ctx.db
      .query("listingViews")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .take(200);
    for (const view of views) {
      await ctx.db.delete(view._id);
    }
    if (views.length === 200) {
      await ctx.scheduler.runAfter(
        0,
        internal.listings.deleteListingViewsBatch,
        args,
      );
    }
  },
});

export const toggleSave = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("That post is no longer available.");

    const existing = await ctx.db
      .query("saves")
      .withIndex("by_user_listing", (q) =>
        q.eq("userId", user._id).eq("listingId", args.listingId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    await ctx.db.insert("saves", {
      userId: user._id,
      listingId: args.listingId,
      createdAt: Date.now(),
    });
    return { saved: true };
  },
});

export const report = mutation({
  args: {
    listingId: v.id("listings"),
    reason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("That post is no longer available.");
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_reporter_listing", (q) =>
        q.eq("reporterId", user._id).eq("listingId", args.listingId),
      )
      .unique();
    if (existing) {
      throw new Error("You have already reported this post.");
    }

    await ctx.db.insert("reports", {
      listingId: args.listingId,
      reporterId: user._id,
      reason: clean(args.reason, 80),
      note: args.note ? clean(args.note, 400) : undefined,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

export const bumpViews = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const { user } = await requireStudent(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing) return { ok: false };
    const existing = await ctx.db
      .query("listingViews")
      .withIndex("by_user_listing", (q) =>
        q.eq("userId", user._id).eq("listingId", args.id),
      )
      .unique();
    if (existing) return { ok: true };

    await ctx.db.insert("listingViews", {
      userId: user._id,
      listingId: args.id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.id, { views: listing.views + 1 });
    return { ok: true };
  },
});

/** Upload ticket for Convex file storage; the client POSTs the file to this URL. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStudent(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Turns an uploaded file id into the public URL we store on the listing. */
export const imageUrl = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireStudent(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("That upload could not be processed. Try again.");
    return { url };
  },
});
