import { AppShell } from "@/components/campus/AppShell";
import { EmptyState, Loading, Notice } from "@/components/campus/Bits";
import { ListingCard } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import {
  CATEGORIES,
  CAMPUS_DOMAIN,
  CAMPUS_NAME,
  CAMPUS_SHORT,
  formatPrice,
  relativeTime,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";

/** Shown until the first students post, so the board is never a blank box. */
const SAMPLE_ROWS = [
  {
    kicker: "For sale · Calculators",
    title: "Casio fx-991ES PLUS, spare battery included",
    price: 650,
    seller: "Nayan",
    time: "2 hours ago",
  },
  {
    kicker: "Service · Coding",
    title: "Python and DSA assignment help",
    price: 500,
    seller: "Ipsita",
    time: "6 hours ago",
  },
  {
    kicker: "For sale · Books",
    title: "Concepts of Physics, both volumes",
    price: 380,
    seller: "Ananya",
    time: "Yesterday",
  },
  {
    kicker: "Gig · Errands",
    title: "Collect a certificate from the admin block",
    price: 100,
    seller: "Devansh",
    time: "Yesterday",
  },
  {
    kicker: "Service · Design",
    title: "Poster design for club events",
    price: 800,
    seller: "Rehan",
    time: "2 days ago",
  },
];

const HOW_IT_WORKS = [
  {
    index: "01",
    title: "Register with your SSIPMT email",
    body: `Sign in with your @${CAMPUS_DOMAIN} address. A six-digit code proves the address is yours, and no one from outside the institute can get an account.`,
  },
  {
    index: "02",
    title: "Set up your student card",
    body: "Add your name, branch and year. That is what classmates see on everything you post — never your email or phone number.",
  },
  {
    index: "03",
    title: "Post something, or reply to a post",
    body: "List an item you are done with, offer the work you are good at, or ask for a small gig. Messaging opens the moment you find someone.",
  },
  {
    index: "04",
    title: "Settle it on campus",
    body: "Check the item, agree on the price and hand it over at the canteen, the library or your block. CampusMart takes no cut and ships nothing.",
  },
];

export default function Landing() {
  const { isAuthenticated } = useCampusUser();
  const itemFeed = useQuery(api.listings.feed, { kind: "item", limit: 24 });
  const serviceFeed = useQuery(api.listings.feed, { kind: "service", limit: 4 });
  const gigFeed = useQuery(api.listings.feed, { kind: "gig", limit: 4 });
  const stats = useQuery(api.listings.campusStats);
  const seed = useMutation(api.seed.loadDemoListings);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const postHref = isAuthenticated ? "/post" : "/auth?returnTo=%2Fpost";

  const items = itemFeed?.listings ?? [];
  const services = serviceFeed?.listings ?? [];
  const gigs = gigFeed?.listings ?? [];

  const boardRows =
    items.length + services.length + gigs.length > 0
      ? [...items.slice(0, 3), ...services.slice(0, 1), ...gigs.slice(0, 1)]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5)
      : [];

  const categoryCounts = CATEGORIES.item.map((category) => ({
    category,
    count: items.filter((listing) => listing.category === category).length,
  }));

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      await seed({});
    } catch (error) {
      setSeedError(
        error instanceof Error ? error.message : "Could not add the examples.",
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppShell>
      {/* ------------------------------------------------------------ hero */}
      <section className="cm-hero">
        <div className="cm-shell cm-hero__grid">
          <div>
            <p className="cm-eyebrow">
              {CAMPUS_SHORT} student marketplace
              <span className="cm-eyebrow__rule" />
              Est. 2026
            </p>

            <h1 className="cm-display cm-h1 cm-hero__headline">
              <span>Buy from students.</span>
              <span>Sell to students.</span>
              <span>
                <em>Work</em> with students.
              </span>
            </h1>

            <p className="cm-hero__lede">
              {CAMPUS_NAME} is the marketplace for {CAMPUS_SHORT} — textbooks,
              calculators, hostel gear, typed notes, and the design or coding
              work your classmates already do well. Every post comes from a
              verified student, so the person on the other end of the deal is
              someone you can actually meet between lectures.
            </p>

            <div className="cm-hero__cta">
              <Link to="/market" className="cm-btn cm-btn--accent cm-btn--lg">
                Explore the marketplace
              </Link>
              <Link to={postHref} className="cm-btn cm-btn--quiet cm-btn--lg">
                List something
              </Link>
            </div>

            <div className="cm-hero__terms">
              <span>@{CAMPUS_DOMAIN} accounts only</span>
              <span>No listing fees</span>
              <span>Handovers on campus</span>
              <span>No phone numbers shown</span>
            </div>
          </div>

          {/* Vertical stack of real listings instead of an illustration. */}
          <aside className="cm-board" aria-label="Latest listings">
            <div className="cm-board__head">
              <span className="cm-meta">
                {boardRows.length > 0 ? "Latest on campus" : "What gets posted"}
              </span>
              {boardRows.length > 0 ? (
                <span className="cm-board__live">
                  <i />
                  Live
                </span>
              ) : (
                <span className="cm-meta">Examples</span>
              )}
            </div>

            {itemFeed === undefined ? (
              <div className="cm-board__row">
                <span className="cm-board__kicker">Loading the board</span>
              </div>
            ) : boardRows.length > 0 ? (
              boardRows.map((listing) => (
                <Link
                  key={listing._id}
                  to={`/listing/${listing._id}`}
                  className="cm-board__row"
                >
                  <span>
                    <span className="cm-board__kicker">
                      {listing.category}
                    </span>
                    <span className="cm-board__title">{listing.title}</span>
                  </span>
                  <span className="cm-board__price">
                    {formatPrice(listing.price)}
                  </span>
                  <span className="cm-board__meta">
                    {listing.seller.name}
                    <span aria-hidden="true">·</span>
                    {relativeTime(listing.createdAt)}
                  </span>
                </Link>
              ))
            ) : (
              SAMPLE_ROWS.map((row) => (
                <div key={row.title} className="cm-board__row">
                  <span>
                    <span className="cm-board__kicker">{row.kicker}</span>
                    <span className="cm-board__title">{row.title}</span>
                  </span>
                  <span className="cm-board__price">
                    {formatPrice(row.price)}
                  </span>
                  <span className="cm-board__meta">
                    {row.seller}
                    <span aria-hidden="true">·</span>
                    {row.time}
                  </span>
                </div>
              ))
            )}

            <div className="cm-board__foot">
              {boardRows.length > 0 ? (
                <>
                  <span className="cm-meta">
                    {stats?.listings ?? boardRows.length} live posts
                  </span>
                  <Link to="/market" className="cm-textlink">
                    Open marketplace
                  </Link>
                </>
              ) : (
                <>
                  <span className="cm-meta">Nothing posted yet</span>
                  <Link to={postHref} className="cm-textlink">
                    Post the first listing
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* -------------------------------------------------------- category */}
      <nav className="cm-cat-strip" aria-label="Browse by category">
        {categoryCounts.map(({ category, count }) => (
          <Link
            key={category}
            to={`/market?category=${encodeURIComponent(category)}`}
            className="cm-cat-strip__item"
          >
            <span>{category}</span>
            <small>{count > 0 ? `${count} live` : "Nothing yet"}</small>
          </Link>
        ))}
      </nav>

      {/* ---------------------------------------------------- fresh on campus */}
      <section className="cm-band">
        <div className="cm-shell cm-split cm-split--market">
          <div className="cm-rail">
            <h2 className="cm-display cm-h2">Fresh on campus</h2>
            <p className="cm-note">
              The newest posts from students across all three parts of{" "}
              {CAMPUS_NAME}.
            </p>
            <div className="cm-fact-list">
              <div className="cm-fact">
                <span>Live posts</span>
                <strong>{stats?.listings ?? 0}</strong>
              </div>
              <div className="cm-fact">
                <span>Students selling</span>
                <strong>{stats?.students ?? 0}</strong>
              </div>
              <div className="cm-fact">
                <span>Services offered</span>
                <strong>{stats?.services ?? 0}</strong>
              </div>
              <div className="cm-fact">
                <span>Gigs open</span>
                <strong>{stats?.gigs ?? 0}</strong>
              </div>
            </div>
            <Link to="/market" className="cm-textlink">
              All listings
            </Link>
          </div>

          <div>
            {itemFeed === undefined ? (
              <Loading label="Loading listings" />
            ) : items.length > 0 ? (
              <div className="cm-columns-2">
                {items.slice(0, 4).map((listing) => (
                  <ListingCard key={listing._id} listing={listing} />
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="Empty shelves"
                title="Nothing has been posted yet"
                body={`${CAMPUS_NAME} is brand new, so the marketplace is still empty. Load a handful of example listings to see how a busy campus looks, or post the first real one.`}
              >
                <div className="cm-actions">
                  <button
                    type="button"
                    className="cm-btn"
                    onClick={handleSeed}
                    disabled={seeding}
                  >
                    {seeding ? "Adding examples…" : "Load example listings"}
                  </button>
                  <Link to={postHref} className="cm-btn cm-btn--quiet">
                    Post something real
                  </Link>
                </div>
                {seedError && <Notice tone="error">{seedError}</Notice>}
              </EmptyState>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- three modes */}
      <section className="cm-band cm-band--deep">
        <div className="cm-shell">
          <div className="cm-section-head">
            <h2 className="cm-display cm-h2">Three ways to use it</h2>
            <span className="cm-section-head__meta">
              Marketplace · Services · Gigs
            </span>
          </div>

          <div className="cm-columns-3">
            <div className="cm-entry">
              <span className="cm-entry__index">01 / MARKETPLACE</span>
              <h3 className="cm-entry__title">
                Buy and sell what you are done with
              </h3>
              <p className="cm-entry__body">
                Textbooks, calculators, headphones, drawing boards — priced by
                the student who used them, inspected in person before money
                changes hands.
              </p>
              <span className="cm-entry__meta">
                {stats?.items ?? 0} live listings
              </span>
              <Link to="/market" className="cm-textlink">
                Browse listings
              </Link>
            </div>

            <div className="cm-entry">
              <span className="cm-entry__index">02 / SERVICES</span>
              <h3 className="cm-entry__title">
                Offer the work you are already good at
              </h3>
              <p className="cm-entry__body">
                Typesetting, posters, tutoring, laptop repairs, reel editing.
                Set your own price, say how long it takes, and take on as much
                as your timetable allows.
              </p>
              <span className="cm-entry__meta">
                {stats?.services ?? 0} services offered
              </span>
              <Link to="/services" className="cm-textlink">
                See student services
              </Link>
            </div>

            <div className="cm-entry">
              <span className="cm-entry__index">03 / GIGS</span>
              <h3 className="cm-entry__title">
                Hand the small jobs to someone nearby
              </h3>
              <p className="cm-entry__body">
                A printout, a certificate at the admin counter, an hour of
                photography for a club event. Post what you need and name what
                you will pay.
              </p>
              <span className="cm-entry__meta">{stats?.gigs ?? 0} gigs open</span>
              <Link to="/gigs" className="cm-textlink">
                Look at open gigs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- services + gigs */}
      {(services.length > 0 || gigs.length > 0) && (
        <section className="cm-band">
          <div className="cm-shell">
            <div className="cm-section-head">
              <h2 className="cm-display cm-h2">Work on the board right now</h2>
              <span className="cm-section-head__meta">
                Skills and jobs posted this week
              </span>
            </div>
            <div className="cm-columns-4">
              {[...services.slice(0, 2), ...gigs.slice(0, 2)].map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- how it works */}
      <section className="cm-band cm-band--deep">
        <div className="cm-shell">
          <div className="cm-section-head">
            <h2 className="cm-display cm-h2">How {CAMPUS_NAME} works</h2>
            <span className="cm-section-head__meta">Four steps, no fees</span>
          </div>
          <div className="cm-columns-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.index} className="cm-entry">
                <span className="cm-entry__index">{step.index}</span>
                <h3 className="cm-entry__title">{step.title}</h3>
                <p className="cm-entry__body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- closing cta */}
      <section className="cm-band cm-band--ink">
        <div className="cm-shell cm-cta-band">
          <div>
            <p className="cm-eyebrow cm-eyebrow--ink">
              One campus, one marketplace
              <span className="cm-eyebrow__rule" />
            </p>
            <h2 className="cm-display cm-h2" style={{ marginTop: 18 }}>
              That calculator in your bag is somebody&apos;s first year.
            </h2>
            <p className="cm-lede cm-on-navy" style={{ marginTop: 18 }}>
              Post the things you have outgrown, the notes you typed yourself,
              or an hour of the help you are good at. Somebody two blocks away
              is looking for exactly that.
            </p>
          </div>
          <div className="cm-cta-band__actions">
            <Link to={postHref} className="cm-btn cm-btn--accent cm-btn--lg">
              Post something on {CAMPUS_NAME}
            </Link>
            <Link to="/market" className="cm-btn cm-btn--quiet cm-btn--lg">
              Browse the marketplace
            </Link>
            <p className="cm-meta cm-on-navy">
              Registration limited to @{CAMPUS_DOMAIN} accounts
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
