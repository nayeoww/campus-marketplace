import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  KIND_META,
  formatPrice,
  initialsOf,
  listingRef,
  type ListingKind,
} from "@/lib/campus";

type PlateSource = {
  _id: string;
  title: string;
  kind: ListingKind;
  category: string;
  price?: number | null;
  images?: string[];
};

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="cm-loading" role="status">
      <i />
      {label}
    </div>
  );
}

export function Notice({
  tone = "plain",
  children,
}: {
  tone?: "plain" | "error" | "warn" | "ok";
  children: ReactNode;
}) {
  const toneClass = tone === "plain" ? "" : ` cm-notice--${tone}`;
  return (
    <p className={`cm-notice${toneClass}`} role={tone === "error" ? "alert" : undefined}>
      <span>{children}</span>
    </p>
  );
}

export function Initials({
  name,
  small,
  accent,
}: {
  name?: string | null;
  small?: boolean;
  accent?: boolean;
}) {
  const classes = [
    "cm-initials",
    small ? "cm-initials--sm" : "",
    accent ? "cm-initials--accent" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{initialsOf(name)}</span>;
}

export function VerifiedBadge({
  verified,
  campusAccount = true,
  withWord = true,
}: {
  verified: boolean;
  campusAccount?: boolean;
  withWord?: boolean;
}) {
  if (!verified) {
    return <span className="cm-badge cm-badge--status">Not verified yet</span>;
  }
  if (!campusAccount) {
    return <span className="cm-badge cm-badge--status">Email verified</span>;
  }
  return (
    <span className="cm-badge cm-badge--verified">
      {withWord ? "Verified student" : "Verified"}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className="cm-badge cm-badge--status">{status}</span>;
}

/** The typographic stand-in used whenever a listing has no photos yet. */
export function Plate({
  listing,
  variant,
  showPrice = true,
}: {
  listing: PlateSource;
  variant?: "wide" | "tall";
  showPrice?: boolean;
}) {
  const meta = KIND_META[listing.kind];
  const classes = [
    "cm-plate",
    variant === "wide" ? "cm-plate--wide" : "",
    variant === "tall" ? "cm-plate--tall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-hidden="true">
      <div className="cm-plate__top">
        <span className="cm-mono">{listing.category}</span>
        <span className="cm-plate__ref">{listingRef(listing._id)}</span>
      </div>
      <span className="cm-plate__mark">{meta.mark}</span>
      <div className="cm-plate__foot">
        <span>No photo yet</span>
        {showPrice && <span>{formatPrice(listing.price)}</span>}
      </div>
    </div>
  );
}

/** Photo when the student uploaded one, designed plate when they did not. */
export function ListingFrame({
  listing,
  variant,
  imageIndex = 0,
}: {
  listing: PlateSource;
  variant?: "wide" | "tall";
  imageIndex?: number;
}) {
  const images = listing.images ?? [];
  if (images.length > 0) {
    return (
      <img
        src={images[Math.min(imageIndex, images.length - 1)]}
        alt={listing.title}
        loading="lazy"
      />
    );
  }
  return <Plate listing={listing} variant={variant} />;
}

export function EmptyState({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="cm-state">
      {eyebrow && <p className="cm-eyebrow">{eyebrow}</p>}
      <h3 className="cm-display cm-h3">{title}</h3>
      <p className="cm-lede">{body}</p>
      {children}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="cm-crumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
          {index < items.length - 1 && <span aria-hidden="true"> / </span>}
        </span>
      ))}
    </nav>
  );
}
