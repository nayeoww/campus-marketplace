import { AppShell } from "@/components/campus/AppShell";
import {
  Breadcrumbs,
  Initials,
  Loading,
  Notice,
  VerifiedBadge,
} from "@/components/campus/Bits";
import { ListingCard } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCampusUser } from "@/hooks/use-campus-user";
import { CAMPUS_NAME, CAMPUS_SHORT, formatPrice, joinedLabel } from "@/lib/campus";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router";

function maskEmail(email: string | null) {
  if (!email) return "Not available";
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 2)}•••@${domain}`;
}

export default function Profile() {
  const { me } = useCampusUser();
  const mine = useQuery(api.listings.mine);
  const saved = useQuery(api.listings.saved);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!me) {
    return (
      <AppShell>
        <div className="cm-shell">
          <Loading label="Opening your profile" />
        </div>
      </AppShell>
    );
  }

  const counts = mine?.counts ?? { live: 0, reserved: 0, sold: 0, closed: 0 };
  const liveListings = (mine?.listings ?? []).filter(
    (listing) => listing.status === "live",
  );
  const listedValue = liveListings.reduce(
    (total, listing) => total + (listing.price ?? 0),
    0,
  );

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[{ label: CAMPUS_NAME, to: "/" }, { label: "Your profile" }]}
        />

        <header className="cm-profile-head">
          <div>
            <div className="cm-identity">
              <Initials name={me.name ?? "CampusMart student"} accent />
              <h1 className="cm-display cm-identity__name">
                {me.name ?? `New ${CAMPUS_SHORT} student`}
              </h1>
            </div>

            <div className="cm-identity__meta">
              <span>{me.profile?.year ?? "Year not set"}</span>
              <span>{me.profile?.branch ?? "Branch not set"}</span>
              {me.profile?.hostel && <span>{me.profile.hostel}</span>}
              <span>Joined {joinedLabel(me.memberSince)}</span>
            </div>

            <div className="cm-actions" style={{ marginTop: 18 }}>
              <VerifiedBadge
                verified={me.emailVerified}
                campusAccount={me.campusAccount}
              />
              <span className="cm-badge cm-badge--status">
                {maskEmail(me.email)}
              </span>
            </div>

            <p className="cm-lede" style={{ marginTop: 20 }}>
              {me.profile?.bio ??
                "You have not written a line about yourself yet. A sentence helps buyers trust the post."}
            </p>

            <div className="cm-actions" style={{ marginTop: 22 }}>
              <Link to="/welcome" className="cm-btn">
                Edit my details
              </Link>
              <Link to="/post" className="cm-btn cm-btn--accent">
                Post something
              </Link>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          </div>

          <aside className="cm-stack" style={{ gap: 18 }}>
            {!me.emailVerified && (
              <Notice tone="warn">
                Your email is not confirmed yet, so your posts show without the
                verified student mark. Sign in again with the code we email you
                to confirm it.
              </Notice>
            )}

            <div className="cm-fact-list">
              <div className="cm-fact">
                <span>Live posts</span>
                <strong>{counts.live}</strong>
              </div>
              <div className="cm-fact">
                <span>Reserved</span>
                <strong>{counts.reserved}</strong>
              </div>
              <div className="cm-fact">
                <span>Sold or closed</span>
                <strong>{counts.sold + counts.closed}</strong>
              </div>
              <div className="cm-fact">
                <span>Saved listings</span>
                <strong>{saved?.length ?? 0}</strong>
              </div>
              <div className="cm-fact">
                <span>Live list value</span>
                <strong>{formatPrice(listedValue)}</strong>
              </div>
            </div>

            <p className="cm-note">
              Only your name, branch, year and the line above are shown to other
              students. Your email address stays private.
            </p>
          </aside>
        </header>

        <section style={{ marginTop: 30 }}>
          <div className="cm-section-head">
            <h2 className="cm-display cm-h3">Saved for later</h2>
            <span className="cm-section-head__meta">
              {saved?.length ?? 0} saved
            </span>
          </div>

          {saved === undefined ? (
            <Loading label="Loading your saved list" />
          ) : saved.length === 0 ? (
            <p className="cm-note">
              Nothing saved yet. Tap “Save for later” on any listing and it will
              wait for you here.
            </p>
          ) : (
            <div className="cm-market-grid">
              {saved.slice(0, 6).map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 46 }}>
          <div className="cm-section-head">
            <h2 className="cm-display cm-h3">Your live posts</h2>
            <Link to="/my-listings" className="cm-section-head__meta">
              Manage all posts
            </Link>
          </div>

          {mine === undefined ? (
            <Loading label="Loading your posts" />
          ) : liveListings.length === 0 ? (
            <p className="cm-note">
              Nothing live right now.{" "}
              <Link to="/post" className="cm-link">
                Post something
              </Link>{" "}
              and it will appear on the board immediately.
            </p>
          ) : (
            <div className="cm-market-grid">
              {liveListings.slice(0, 6).map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
