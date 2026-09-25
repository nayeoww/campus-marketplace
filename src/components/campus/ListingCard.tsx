import { Link } from "react-router";
import { ListingFrame } from "@/components/campus/Bits";
import {
  formatPrice,
  listingKicker,
  relativeTime,
  type ListingRow,
} from "@/lib/campus";

export function ListingCard({
  listing,
  lead = false,
}: {
  listing: ListingRow;
  lead?: boolean;
}) {
  const kicker = listingKicker(listing);

  return (
    <article className={`cm-card${lead ? " cm-card--lead" : ""}`}>
      <Link
        to={`/listing/${listing._id}`}
        className="cm-card__frame"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ListingFrame listing={listing} />
      </Link>

      <div className="cm-card__body">
        <p className="cm-card__kicker">
          {kicker.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </p>

        <h3 className="cm-card__title">
          <Link to={`/listing/${listing._id}`}>{listing.title}</Link>
        </h3>

        {lead && <p className="cm-card__excerpt">{listing.description}</p>}

        <p className="cm-card__price">
          {formatPrice(listing.price)}
          {listing.priceNote && <small>{listing.priceNote}</small>}
        </p>

        <div className="cm-card__foot">
          <span className="cm-card__seller">
            {listing.seller.verified && <i className="cm-card__dot" />}
            {listing.seller.name}
          </span>
          <span aria-hidden="true">·</span>
          <span>{relativeTime(listing.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function ListingGrid({
  listings,
  leadFirst = true,
}: {
  listings: ListingRow[];
  leadFirst?: boolean;
}) {
  return (
    <div className="cm-market-grid">
      {listings.map((listing, index) => (
        <ListingCard
          key={listing._id}
          listing={listing}
          lead={leadFirst && index === 0}
        />
      ))}
    </div>
  );
}
