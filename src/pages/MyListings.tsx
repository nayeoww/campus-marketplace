import { AppShell } from "@/components/campus/AppShell";
import { Breadcrumbs, EmptyState, Loading, Notice } from "@/components/campus/Bits";
import { api } from "@/convex/_generated/api";
import {
  CAMPUS_NAME,
  KIND_META,
  formatPrice,
  relativeTime,
  statusLabel,
  type ListingRow,
  type ListingStatus,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const GROUP_ORDER: ListingStatus[] = ["live", "reserved", "sold", "closed"];

const GROUP_BLURB: Record<ListingStatus, string> = {
  live: "On the board right now.",
  reserved: "Someone has claimed it; keep it hidden until the handover happens.",
  sold: "Done and dusted. Renew it if the deal falls through.",
  closed: "Taken off the board.",
};

function Row({
  listing,
  onStatus,
  onDelete,
  busy,
}: {
  listing: ListingRow;
  onStatus: (status: ListingStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const meta = KIND_META[listing.kind];

  return (
    <div className="cm-table__row">
      <div className="cm-table__item">
        <div className="cm-table__thumb">
          {listing.images.length > 0 ? (
            <img src={listing.images[0]} alt="" />
          ) : (
            <span aria-hidden="true">{meta.mark}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <Link to={`/listing/${listing._id}`} className="cm-table__title">
            {listing.title}
          </Link>
          <p className="cm-card__kicker" style={{ marginTop: 5 }}>
            <span>{meta.noun}</span>
            <span>{listing.category}</span>
          </p>
        </div>
      </div>

      <span className="cm-meta">{formatPrice(listing.price)}</span>
      <span className="cm-meta">{listing.views} views</span>
      <span className="cm-meta">{relativeTime(listing.createdAt)}</span>

      <div className="cm-table__actions">
        <Link to={`/listing/${listing._id}/edit`} className="cm-textlink">
          Edit
        </Link>

        {listing.status === "live" && listing.kind === "item" && (
          <>
            <button
              type="button"
              className="cm-textlink"
              disabled={busy}
              onClick={() => onStatus("reserved")}
            >
              Reserved
            </button>
            <button
              type="button"
              className="cm-textlink"
              disabled={busy}
              onClick={() => onStatus("sold")}
            >
              Sold
            </button>
          </>
        )}

        {listing.status === "live" && listing.kind !== "item" && (
          <button
            type="button"
            className="cm-textlink"
            disabled={busy}
            onClick={() => onStatus("closed")}
          >
            Close
          </button>
        )}

        {listing.status === "reserved" && (
          <>
            <button
              type="button"
              className="cm-textlink"
              disabled={busy}
              onClick={() => onStatus("sold")}
            >
              Sold
            </button>
            <button
              type="button"
              className="cm-textlink"
              disabled={busy}
              onClick={() => onStatus("live")}
            >
              Back on sale
            </button>
          </>
        )}

        {(listing.status === "sold" || listing.status === "closed") && (
          <button
            type="button"
            className="cm-textlink"
            disabled={busy}
            onClick={() => onStatus("live")}
          >
            Renew
          </button>
        )}

        <button
          type="button"
          className="cm-textlink cm-textlink--danger"
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function MyListings() {
  const data = useQuery(api.listings.mine);
  const setStatus = useMutation(api.listings.setStatus);
  const removeListing = useMutation(api.listings.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatus = async (id: string, status: ListingStatus) => {
    setBusy(true);
    setError(null);
    try {
      await setStatus({ id: id as never, status });
      toast.success(`Marked as ${statusLabel(status).toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change did not save.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeListing({ id: id as never });
      toast.success("Post deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That post was not deleted.");
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts ?? { live: 0, reserved: 0, sold: 0, closed: 0 };
  const liveValue = (data?.listings ?? [])
    .filter((listing) => listing.status === "live")
    .reduce((total, listing) => total + (listing.price ?? 0), 0);

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[{ label: CAMPUS_NAME, to: "/" }, { label: "My listings" }]}
        />

        <header className="cm-page-head">
          <div>
            <p className="cm-eyebrow">
              Your posts
              <span className="cm-eyebrow__rule" />
              {counts.live} live
            </p>
            <h1 className="cm-display cm-h2 cm-page-head__title">
              Everything you have put on {CAMPUS_NAME}
            </h1>
            <p className="cm-lede" style={{ marginTop: 16 }}>
              Keep prices honest, mark things sold when they are gone, and renew
              a post if a deal falls through. The board stays useful when
              everybody updates it.
            </p>
          </div>
          <div className="cm-stack" style={{ gap: 14 }}>
            <p className="cm-note">
              Posts with photos and a real description get replies roughly twice
              as often.
            </p>
            <Link to="/post" className="cm-btn cm-btn--accent">
              Post something new
            </Link>
          </div>
        </header>

        <div className="cm-summary">
          <div className="cm-summary__cell">
            <span className="cm-label">Live</span>
            <strong>{counts.live}</strong>
          </div>
          <div className="cm-summary__cell">
            <span className="cm-label">Reserved</span>
            <strong>{counts.reserved}</strong>
          </div>
          <div className="cm-summary__cell">
            <span className="cm-label">Sold</span>
            <strong>{counts.sold}</strong>
          </div>
          <div className="cm-summary__cell">
            <span className="cm-label">Listed value</span>
            <strong>{formatPrice(liveValue)}</strong>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 18 }}>
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {data === undefined ? (
          <Loading label="Loading your posts" />
        ) : data.listings.length === 0 ? (
          <EmptyState
            eyebrow="Nothing posted yet"
            title="Your first post is the hardest one"
            body="Start with something you have finished with — a calculator, a textbook, a drawing board. It takes a minute and it stays free."
          >
            <div className="cm-actions">
              <Link to="/post" className="cm-btn cm-btn--accent">
                Post something
              </Link>
              <Link to="/market" className="cm-btn cm-btn--quiet">
                See what others are selling
              </Link>
            </div>
          </EmptyState>
        ) : (
          GROUP_ORDER.map((group) => {
            const rows = data.listings.filter((listing) => listing.status === group);
            if (rows.length === 0) return null;

            return (
              <section key={group} style={{ marginTop: 38 }}>
                <div className="cm-section-head">
                  <h2 className="cm-display cm-h3">
                    {statusLabel(group)}{" "}
                    <span className="cm-meta">
                      {rows.length} {rows.length === 1 ? "post" : "posts"}
                    </span>
                  </h2>
                  <span className="cm-section-head__meta">
                    {GROUP_BLURB[group]}
                  </span>
                </div>

                <div className="cm-table">
                  <div className="cm-table__head">
                    <span>Post</span>
                    <span>Price</span>
                    <span>Interest</span>
                    <span>Posted</span>
                    <span style={{ textAlign: "right" }}>Actions</span>
                  </div>
                  {rows.map((listing) => (
                    <Row
                      key={listing._id}
                      listing={listing}
                      busy={busy}
                      onStatus={(status) => handleStatus(listing._id, status)}
                      onDelete={() => handleDelete(listing._id, listing.title)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
