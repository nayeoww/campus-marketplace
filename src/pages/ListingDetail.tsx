import { AppShell } from "@/components/campus/AppShell";
import {
  Breadcrumbs,
  EmptyState,
  Initials,
  Loading,
  Notice,
  Plate,
  VerifiedBadge,
} from "@/components/campus/Bits";
import { ListingCard } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import {
  CAMPUS_NAME,
  KIND_META,
  MESSAGE_STARTERS,
  REPORT_REASONS,
  formatPrice,
  listingFacts,
  relativeTime,
  statusLabel,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

type DialogKind = "message" | "report" | null;

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const listingId = id as never;
  const navigate = useNavigate();
  const { isAuthenticated, canTrade } = useCampusUser();

  const result = useQuery(api.listings.byId, id ? { id: listingId } : "skip");
  const bumpViews = useMutation(api.listings.bumpViews);
  const toggleSave = useMutation(api.listings.toggleSave);
  const sendMessage = useMutation(api.messaging.start);
  const submitReport = useMutation(api.listings.report);
  const setStatus = useMutation(api.listings.setStatus);
  const removeListing = useMutation(api.listings.remove);

  const [activeImage, setActiveImage] = useState(0);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [messageBody, setMessageBody] = useState("");
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewCounted = useRef<string | null>(null);

  useEffect(() => {
    if (!id || viewCounted.current === id) return;
    viewCounted.current = id;
    void bumpViews({ id: listingId });
  }, [id, listingId, bumpViews]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (result === undefined) {
    return (
      <AppShell>
        <div className="cm-shell">
          <Loading label="Opening this post" />
        </div>
      </AppShell>
    );
  }

  if (result === null) {
    return (
      <AppShell>
        <div className="cm-shell">
          <EmptyState
            eyebrow="Gone"
            title="This post is no longer on CampusMart"
            body="It may have sold, or the student who posted it took it down. Plenty of other things are still on the board."
          >
            <Link to="/market" className="cm-btn">
              Back to the marketplace
            </Link>
          </EmptyState>
        </div>
      </AppShell>
    );
  }

  const { listing, related } = result;
  const meta = KIND_META[listing.kind];
  const images = listing.images ?? [];
  const otherId = listing.seller._id;
  const returnPath = `/listing/${listing._id}`;

  const requireAccount = () => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(returnPath)}`);
      return false;
    }
    if (!canTrade) {
      navigate(`/welcome?returnTo=${encodeURIComponent(returnPath)}`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!requireAccount()) return;
    setError(null);
    try {
      const next = await toggleSave({ listingId: listing._id });
      setFeedback(next.saved ? "Saved to your list." : "Removed from your saved list.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this post.");
    }
  };

  const handleSend = async () => {
    if (!messageBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { conversationId } = await sendMessage({
        listingId: listing._id,
        otherUserId: otherId as never,
        body: messageBody,
      });
      navigate(`/messages/${conversationId}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace(/^\[.*?\]\s*/, "")
          : "Your message could not be sent.",
      );
      setBusy(false);
    }
  };

  const handleReport = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitReport({
        listingId: listing._id,
        reason: reportReason,
        note: reportNote || undefined,
      });
      setDialog(null);
      setReportNote("");
      setFeedback("Thanks — this has been flagged for review.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send the report.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOwnerStatus = async (status: "live" | "reserved" | "sold" | "closed") => {
    setBusy(true);
    setError(null);
    try {
      await setStatus({ id: listing._id, status });
      setFeedback(`Post marked as ${statusLabel(status).toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the post.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete this post? Anyone who saved it will lose the link.",
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await removeListing({ id: listing._id });
      navigate("/my-listings");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the post.");
      setBusy(false);
    }
  };

  const openConversation = () => {
    if (!requireAccount()) return;
    setMessageBody(MESSAGE_STARTERS[listing.kind][0]);
    setDialog("message");
  };

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[
            { label: CAMPUS_NAME, to: "/" },
            { label: meta.label, to: meta.route },
            { label: listing.title },
          ]}
        />
      </div>

      <div className="cm-shell cm-detail">
        <div className="cm-gallery">
          <div className="cm-gallery__main">
            {images.length > 0 ? (
              <img src={images[activeImage]} alt={listing.title} />
            ) : (
              <Plate listing={listing} showPrice={false} />
            )}
          </div>

          {images.length > 1 && (
            <div className="cm-gallery__thumbs">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className="cm-gallery__thumb"
                  data-active={index === activeImage}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Photo ${index + 1}`}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="cm-band--tight" style={{ borderTop: "1px solid var(--cm-rule)", marginTop: 10 }}>
            <p className="cm-eyebrow" style={{ marginBottom: 14 }}>
              Description
              <span className="cm-eyebrow__rule" />
            </p>
            <p className="cm-prose">{listing.description}</p>
            {images.length === 0 && (
              <p className="cm-note" style={{ marginTop: 16 }}>
                {listing.isOwner
                  ? "You have not added photos to this post yet. Edit it to upload a few — posts with photos get replies much faster."
                  : "This post has no photos yet. Ask the seller for a picture in messages before you commit."}
              </p>
            )}
          </div>
        </div>

        <aside className="cm-detail__info">
          <div className="cm-stack" style={{ gap: 12 }}>
            <p className="cm-eyebrow">
              {meta.noun} · {listing.category}
              <span className="cm-eyebrow__rule" />
              {relativeTime(listing.createdAt)}
            </p>
            <h1 className="cm-display cm-detail__title">{listing.title}</h1>
            <p className="cm-detail__price">
              {formatPrice(listing.price)}
              {listing.priceNote && <small className="cm-mono">{listing.priceNote}</small>}
            </p>
            <div className="cm-actions">
              <span className="cm-badge cm-badge--accent">{meta.label}</span>
              {listing.status !== "live" && (
                <span className="cm-badge">{statusLabel(listing.status)}</span>
              )}
              {listing.views > 0 && (
                <span className="cm-badge cm-badge--status">
                  {listing.views} view{listing.views === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {feedback && <Notice tone="ok">{feedback}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}

          {listing.isOwner ? (
            <div className="cm-owner-bar">
              <span className="cm-mono">Your post</span>
              <div className="cm-actions">
                <Link
                  to={`/listing/${listing._id}/edit`}
                  className="cm-textlink"
                >
                  Edit
                </Link>
                {listing.status !== "live" && (
                  <button
                    type="button"
                    className="cm-textlink"
                    disabled={busy}
                    onClick={() => handleOwnerStatus("live")}
                  >
                    Relist
                  </button>
                )}
                {listing.kind === "item" && listing.status === "live" && (
                  <>
                    <button
                      type="button"
                      className="cm-textlink"
                      disabled={busy}
                      onClick={() => handleOwnerStatus("reserved")}
                    >
                      Mark reserved
                    </button>
                    <button
                      type="button"
                      className="cm-textlink"
                      disabled={busy}
                      onClick={() => handleOwnerStatus("sold")}
                    >
                      Mark sold
                    </button>
                  </>
                )}
                {listing.kind !== "item" && listing.status === "live" && (
                  <button
                    type="button"
                    className="cm-textlink"
                    disabled={busy}
                    onClick={() => handleOwnerStatus("closed")}
                  >
                    Close post
                  </button>
                )}
                <button
                  type="button"
                  className="cm-textlink cm-textlink--danger"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="cm-actions__stack">
              <button
                type="button"
                className="cm-btn cm-btn--accent cm-btn--lg cm-btn--block"
                onClick={openConversation}
              >
                Message {listing.seller.name.split(" ")[0]}
              </button>
              <div className="cm-actions">
                <button
                  type="button"
                  className="cm-btn cm-btn--quiet"
                  onClick={handleSave}
                  disabled={busy}
                >
                  {listing.saved ? "Saved" : "Save for later"}
                </button>
                <button
                  type="button"
                  className="cm-textlink"
                  onClick={() => {
                    if (!requireAccount()) return;
                    setDialog("report");
                  }}
                >
                  Report post
                </button>
              </div>
            </div>
          )}

          <dl className="cm-spec">
            {listingFacts(listing).map((fact) => (
              <div className="cm-spec__row" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="cm-seller">
            <div className="cm-seller__head">
              <Initials name={listing.seller.name} />
              <div style={{ minWidth: 0 }}>
                <p className="cm-seller__name">{listing.seller.name}</p>
                <p className="cm-seller__meta">
                  {[listing.seller.year, listing.seller.branch]
                    .filter(Boolean)
                    .join(" · ") || "Branch and year not shared"}
                </p>
              </div>
            </div>
            <div className="cm-seller__body">
              <div className="cm-actions" style={{ marginBottom: 12 }}>
                <VerifiedBadge
                  verified={listing.seller.verified}
                  campusAccount={listing.seller.campusAccount}
                />
                <Link
                  to={`/students/${listing.seller._id}`}
                  className="cm-textlink"
                >
                  View profile
                </Link>
              </div>
              <p className="cm-note">
                Contact happens inside {CAMPUS_NAME} messages. Email addresses
                and phone numbers are never shown on a post.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="cm-band">
          <div className="cm-shell">
            <div className="cm-section-head">
              <h2 className="cm-display cm-h3">
                More {meta.label.toLowerCase()} on campus
              </h2>
              <Link to={meta.route} className="cm-textlink">
                See everything
              </Link>
            </div>
            <div className="cm-market-grid">
              {related.map((row) => (
                <ListingCard key={row._id} listing={row} />
              ))}
            </div>
          </div>
        </section>
      )}

      {dialog === "message" && (
        <div
          className="cm-modal-backdrop"
          role="presentation"
          onClick={() => setDialog(null)}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Message ${listing.seller.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="cm-eyebrow">
              Message · {listing.seller.name}
              <span className="cm-eyebrow__rule" />
            </p>
            <p className="cm-note">
              About “{listing.title}” · {formatPrice(listing.price)}
            </p>

            <div className="cm-msg-starters">
              {MESSAGE_STARTERS[listing.kind].map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="cm-msg-starter"
                  onClick={() => setMessageBody(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>

            <textarea
              className="cm-textarea"
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Say hello, ask what you need to know, suggest where to meet."
              maxLength={2000}
              autoFocus
            />

            {error && <Notice tone="error">{error}</Notice>}

            <div className="cm-actions">
              <button
                type="button"
                className="cm-btn cm-btn--accent"
                onClick={handleSend}
                disabled={busy || !messageBody.trim()}
              >
                {busy ? "Sending…" : "Send message"}
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === "report" && (
        <div
          className="cm-modal-backdrop"
          role="presentation"
          onClick={() => setDialog(null)}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Report this post"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="cm-eyebrow">
              Report a post
              <span className="cm-eyebrow__rule" />
            </p>
            <p className="cm-note">
              Reports go to the student who moderates {CAMPUS_NAME}. Your name is
              not shown to the person who posted it.
            </p>

            <label className="cm-field">
              <span className="cm-label">What is wrong</span>
              <span className="cm-select-wrap">
                <select
                  className="cm-select"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="cm-field">
              <span className="cm-label">Anything else (optional)</span>
              <textarea
                className="cm-textarea"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Add a sentence if it helps explain the problem."
                maxLength={400}
              />
            </label>

            <div className="cm-actions">
              <button
                type="button"
                className="cm-btn cm-btn--accent"
                onClick={handleReport}
                disabled={busy}
              >
                {busy ? "Sending…" : "Send report"}
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
