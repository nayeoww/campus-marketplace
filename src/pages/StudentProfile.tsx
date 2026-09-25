import { AppShell } from "@/components/campus/AppShell";
import {
  Breadcrumbs,
  EmptyState,
  Initials,
  Loading,
  Notice,
  VerifiedBadge,
} from "@/components/campus/Bits";
import { ListingCard } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import { CAMPUS_NAME, joinedLabel, type ListingRow } from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, canTrade, me } = useCampusUser();
  const viewerId = me?._id ?? null;

  const student = useQuery(api.profiles.byId, id ? { userId: id as never } : "skip");
  const startConversation = useMutation(api.messaging.start);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPath = `/students/${id}`;
  const isSelf = Boolean(viewerId && viewerId === student?._id);

  const openDialog = () => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!canTrade) {
      navigate(`/welcome?returnTo=${encodeURIComponent(returnPath)}`);
      return;
    }
    setBody(
      `Hi${student?.name ? ` ${student.name.split(" ")[0]}` : ""}! I found you on ${CAMPUS_NAME}.`,
    );
    setDialogOpen(true);
  };

  const handleSend = async () => {
    if (!student || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { conversationId } = await startConversation({
        otherUserId: student._id as never,
        body,
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

  if (student === undefined) {
    return (
      <AppShell>
        <div className="cm-shell">
          <Loading label="Opening this profile" />
        </div>
      </AppShell>
    );
  }

  // Rows come straight from the database, so attach the identity the card needs
  // and flag the viewer's own posts so they are never offered a self-message.
  const listings: ListingRow[] = student.liveListings.map((listing) => ({
    ...listing,
    seller: {
      _id: student._id as string,
      name: student.name,
      branch: student.branch,
      year: student.year,
      verified: student.verified,
      campusAccount: student.campusAccount,
    },
    saved: false,
    isOwner: viewerId === (student._id as string),
  }));

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[
            { label: CAMPUS_NAME, to: "/" },
            { label: "Students", to: "/market" },
            { label: student.name },
          ]}
        />

        <header className="cm-profile-head">
          <div>
            <div className="cm-identity">
              <Initials name={student.name} accent />
              <h1 className="cm-display cm-identity__name">{student.name}</h1>
            </div>

            <div className="cm-identity__meta">
              <span>{student.year ?? "Year not shared"}</span>
              <span>{student.branch ?? "Branch not shared"}</span>
              {student.hostel && <span>{student.hostel}</span>}
              {student.joinedAt && <span>Joined {joinedLabel(student.joinedAt)}</span>}
            </div>

            <div className="cm-actions" style={{ marginTop: 18 }}>
              <VerifiedBadge
                verified={student.verified}
                campusAccount={student.campusAccount}
              />
              {student.hostel && (
                <span className="cm-badge cm-badge--status">{student.hostel}</span>
              )}
            </div>

            <p className="cm-lede" style={{ marginTop: 20 }}>
              {student.bio ?? "This student has not written anything about themselves yet."}
            </p>

            <div className="cm-actions" style={{ marginTop: 22 }}>
              {isSelf ? (
                <Link to="/profile" className="cm-btn cm-btn--accent">
                  This is your profile — edit it
                </Link>
              ) : (
                <button
                  type="button"
                  className="cm-btn cm-btn--accent"
                  onClick={openDialog}
                >
                  Message {student.name.split(" ")[0]}
                </button>
              )}
              <Link to="/market" className="cm-btn cm-btn--quiet">
                Back to the marketplace
              </Link>
            </div>
          </div>

          <aside className="cm-stack" style={{ gap: 18 }}>
            <div className="cm-fact-list">
              <div className="cm-fact">
                <span>Live posts</span>
                <strong>{student.liveCount}</strong>
              </div>
              <div className="cm-fact">
                <span>Completed sales</span>
                <strong>{student.soldCount}</strong>
              </div>
              <div className="cm-fact">
                <span>Account</span>
                <span className="cm-meta">
                  {student.campusAccount ? "SSIPMT email" : "Verified email"}
                </span>
              </div>
            </div>
            <p className="cm-note">
              Contact happens inside {CAMPUS_NAME} messages. Email addresses and
              phone numbers are never shown here.
            </p>
          </aside>
        </header>

        <section style={{ marginTop: 30, paddingBottom: 60 }}>
          <div className="cm-section-head">
            <h2 className="cm-display cm-h3">On the board right now</h2>
            <span className="cm-section-head__meta">
              {student.liveCount} live {student.liveCount === 1 ? "post" : "posts"}
            </span>
          </div>

          {listings.length === 0 ? (
            <EmptyState
              eyebrow="Nothing live"
              title={`${student.name} has nothing on the board`}
              body="Everything they had posted has sold or been taken down. You can still send a message to ask what they might have."
            />
          ) : (
            <div className="cm-market-grid">
              {listings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>

      {dialogOpen && student && (
        <div
          className="cm-modal-backdrop"
          role="presentation"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Message ${student.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="cm-eyebrow">
              Message · {student.name}
              <span className="cm-eyebrow__rule" />
            </p>
            <p className="cm-note">
              Say what you are after. You can mention a listing title if you are
              asking about something specific.
            </p>

            <textarea
              className="cm-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              autoFocus
            />

            {error && <Notice tone="error">{error}</Notice>}

            <div className="cm-actions">
              <button
                type="button"
                className="cm-btn cm-btn--accent"
                onClick={handleSend}
                disabled={busy || !body.trim()}
              >
                {busy ? "Sending…" : "Send message"}
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => setDialogOpen(false)}
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
