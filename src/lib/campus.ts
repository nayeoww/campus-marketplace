import type { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

export const CAMPUS_NAME = "CampusMart";
export const CAMPUS_SHORT = "SSIPMT";
export const CAMPUS_FULL =
  "Shri Shankaracharya Institute of Professional Management and Technology";
export const CAMPUS_CITY = "Mujhgahan";
export const CAMPUS_DOMAIN = "ssipmt.com";
export const CAMPUS_EMAIL_HINT = `name@${CAMPUS_DOMAIN}`;

export type ListingKind = "item" | "service";
export type ListingStatus = "live" | "reserved" | "sold" | "closed";

export type Seller = {
  _id: string;
  name: string;
  branch: string | null;
  year: string | null;
  verified: boolean;
  campusAccount: boolean;
};

export type ListingRow = Doc<"listings"> & {
  seller: Seller;
  saved: boolean;
  isOwner: boolean;
};

export const KIND_META: Record<
  ListingKind,
  {
    label: string;
    noun: string;
    route: string;
    mark: string;
    headline: string;
    blurb: string;
    cta: string;
  }
> = {
  item: {
    label: "Marketplace",
    noun: "For sale",
    route: "/market",
    mark: "For sale",
    headline: "Second-hand everything, one campus away",
    blurb:
      "Textbooks, calculators, electronics and hostel gear that students no longer need. Inspect it in person before you pay.",
    cta: "List an item",
  },
  service: {
    label: "Services",
    noun: "Service",
    route: "/services",
    mark: "Offered",
    headline: "Student skills, priced honestly",
    blurb:
      "Design, code, tutoring, repairs and notes — work done by seniors and classmates who have already sat the same exams.",
    cta: "Offer a service",
  },
};

export const CATEGORIES: Record<ListingKind, string[]> = {
  item: [
    "Books",
    "Electronics",
    "Hostel",
    "Fashion",
    "Calculators",
    "Notes",
    "Sports",
    "Other",
  ],
  service: [
    "Coding",
    "Design",
    "Writing",
    "Tutoring",
    "Video & Photo",
    "Repairs",
    "Events",
    "Other",
  ],
};

export const CONDITIONS = [
  "Brand new",
  "Like new",
  "Good condition",
  "Fair",
  "Well used",
];

export const BRANCHES = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Telecommunication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "AI & Data Science",
  "Management (MBA)",
];

export const YEARS = ["1st year", "2nd year", "3rd year", "4th year"];

export const HOSTELS = [
  "Boys Hostel A",
  "Boys Hostel B",
  "Girls Hostel",
  "Day scholar",
];

export const REPORT_REASONS = [
  "Already sold or unavailable",
  "Misleading details or photos",
  "Price does not match the description",
  "Not a student of SSIPMT",
  "Something unsafe or inappropriate",
];

export const MESSAGE_STARTERS: Record<ListingKind, string[]> = {
  item: [
    "Hi! Is this still available?",
    "Can I see it in person today?",
    "Would you take a slightly lower price?",
  ],
  service: [
    "Hi! Are you free this week?",
    "What do you need from me to start?",
    "Can you share samples of earlier work?",
  ],
};

export const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
] as const;

export function isCampusEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${CAMPUS_DOMAIN}`);
}

export function initialsOf(name: string | null | undefined) {
  if (!name) return "CM";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatPrice(price: number | null | undefined) {
  if (price === null || price === undefined) return "Open to offers";
  return `₹${new Intl.NumberFormat("en-IN").format(price)}`;
}

export function listingRef(id: string) {
  return `№ ${id.slice(-4).toUpperCase()}`;
}

export function relativeTime(timestamp: number) {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

export function joinedLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

/** The one-line metadata strip printed above a listing title. */
export function listingKicker(listing: {
  kind: ListingKind;
  category: string;
  condition?: string | null;
  turnaround?: string | null;
  location?: string | null;
  price?: number | null;
}) {
  const parts: string[] = [KIND_META[listing.kind].noun, listing.category];
  if (listing.kind === "item" && listing.condition) parts.push(listing.condition);
  if (listing.kind === "service" && listing.turnaround) parts.push(listing.turnaround);
  return parts;
}

/** Label/value rows for the spec table on a listing page. */
export function listingFacts(listing: ListingRow) {
  const facts: { label: string; value: string }[] = [
    { label: "Posted", value: relativeTime(listing.createdAt) },
  ];

  if (listing.category) facts.push({ label: "Category", value: listing.category });
  if (listing.kind === "item" && listing.condition) {
    facts.push({ label: "Condition", value: listing.condition });
  }
  if (listing.kind === "service" && listing.turnaround) {
    facts.push({ label: "Turnaround", value: listing.turnaround });
  }
  if (listing.location) facts.push({ label: "Handover", value: listing.location });
  facts.push({
    label: "Post",
    value: `${listingRef(listing._id)} · ${listing.views} view${listing.views === 1 ? "" : "s"}`,
  });

  return facts;
}

export function statusLabel(status: ListingStatus) {
  if (status === "live") return "Live";
  if (status === "reserved") return "Reserved";
  if (status === "sold") return "Sold";
  return "Closed";
}
