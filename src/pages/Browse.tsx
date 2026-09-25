import { AppShell } from "@/components/campus/AppShell";
import { Breadcrumbs, EmptyState, Loading, Notice } from "@/components/campus/Bits";
import { ListingGrid } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import {
  CATEGORIES,
  CAMPUS_NAME,
  KIND_META,
  SORT_OPTIONS,
  type ListingKind,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

export default function Browse({ kind }: { kind: ListingKind }) {
  const meta = KIND_META[kind];
  const { isAuthenticated } = useCampusUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const sortParam = searchParams.get("sort") ?? "recent";
  const sort = (SORT_OPTIONS.find((option) => option.value === sortParam)?.value ??
    "recent") as "recent" | "price_low" | "price_high";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  const feed = useQuery(api.listings.feed, {
    kind,
    category: category || undefined,
    search: debounced || undefined,
    sort,
    limit: 36,
  });
  const allFeed = useQuery(api.listings.feed, { kind, limit: 60 });
  const stats = useQuery(api.listings.campusStats);
  const seed = useMutation(api.seed.loadDemoListings);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const postHref = isAuthenticated ? "/post" : "/auth?returnTo=%2Fpost";
  const listings = feed?.listings ?? [];
  const total = allFeed?.listings.length ?? 0;
  const campusEmpty = stats !== undefined && stats.listings === 0;

  const updateParams = (next: { category?: string; sort?: string }) => {
    const params = new URLSearchParams(searchParams);
    const entries = Object.entries(next);
    for (const [key, value] of entries) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };

  const countFor = (option: string) =>
    (allFeed?.listings ?? []).filter((listing) => listing.category === option).length;

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
      <div className="cm-shell">
        <Breadcrumbs
          items={[{ label: CAMPUS_NAME, to: "/" }, { label: meta.label }]}
        />

        <header className="cm-page-head">
          <div>
            <p className="cm-eyebrow">
              {meta.label}
              <span className="cm-eyebrow__rule" />
              {total} live
            </p>
            <h1 className="cm-display cm-h2 cm-page-head__title">
              {meta.headline}
            </h1>
            <p className="cm-lede" style={{ marginTop: 16 }}>
              {meta.blurb}
            </p>
          </div>

          <div className="cm-stack" style={{ gap: 14 }}>
            <p className="cm-note">
              Everything here is posted by verified students of the institute.
              Meet on campus, check the item, then pay.
            </p>
            <Link to={postHref} className="cm-btn cm-btn--accent">
              {meta.cta}
            </Link>
          </div>
        </header>

        <div className="cm-toolbar">
          <label className="cm-search">
            <span className="cm-meta">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                kind === "item"
                  ? "calculator, hostel, notes…"
                  : kind === "service"
                    ? "coding, tutoring, posters…"
                    : "printing, errands, photos…"
              }
              aria-label={`Search ${meta.label.toLowerCase()}`}
            />
          </label>

          <label className="cm-search cm-search--sort">
            <span className="cm-meta">Sort</span>
            <span className="cm-select-wrap" style={{ width: "100%" }}>
              <select
                className="cm-select"
                value={sort}
                onChange={(event) => updateParams({ sort: event.target.value })}
                aria-label="Sort listings"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {(category || debounced) && (
            <button
              type="button"
              className="cm-textlink"
              onClick={() => {
                setSearch("");
                updateParams({ category: "" });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="cm-shell cm-split cm-split--market" style={{ paddingBlock: "38px 64px" }}>
        <aside className="cm-rail">
          <div className="cm-rail-group">
            <p className="cm-rail-group__title">Categories</p>
            <button
              type="button"
              className="cm-rail-link"
              data-active={!category}
              onClick={() => updateParams({ category: "" })}
            >
              <span>All {meta.label.toLowerCase()}</span>
              <small>{total}</small>
            </button>
            {CATEGORIES[kind].map((option) => (
              <button
                key={option}
                type="button"
                className="cm-rail-link"
                data-active={category === option}
                onClick={() => updateParams({ category: option })}
              >
                <span>{option}</span>
                <small>{countFor(option)}</small>
              </button>
            ))}
          </div>

          <div className="cm-panel">
            <p className="cm-meta">Keep it on campus</p>
            <p className="cm-note" style={{ marginTop: 10 }}>
              Agree on a place inside the campus, check what you are buying
              before you pay, and never send money in advance to someone you
              have not met.
            </p>
          </div>
        </aside>

        <div>
          {feed === undefined ? (
            <Loading label={`Loading ${meta.label.toLowerCase()}`} />
          ) : listings.length > 0 ? (
            <>
              <div className="cm-section-head">
                <p className="cm-meta">
                  {category || "Everything"} · {listings.length}{" "}
                  {listings.length === 1 ? "post" : "posts"}
                </p>
                <span className="cm-section-head__meta">
                  Updated as students post
                </span>
              </div>
              <ListingGrid listings={listings} />
            </>
          ) : campusEmpty ? (
            <EmptyState
              eyebrow="Empty board"
              title="The board is empty — be the first"
              body={`No one has posted anything on ${CAMPUS_NAME} yet. Load a set of example listings to see the marketplace with content in it, or put up your own post right away.`}
            >
              <div className="cm-actions">
                <button type="button" className="cm-btn" onClick={handleSeed} disabled={seeding}>
                  {seeding ? "Adding examples…" : "Load example listings"}
                </button>
                <Link to={postHref} className="cm-btn cm-btn--quiet">
                  {meta.cta}
                </Link>
              </div>
              {seedError && <Notice tone="error">{seedError}</Notice>}
            </EmptyState>
          ) : (
            <EmptyState
              eyebrow="No matches"
              title={`Nothing here matches ${debounced ? `“${debounced}”` : category}`}
              body="Try a broader category or clear the filters. New posts land on this board every day."
            >
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => {
                  setSearch("");
                  updateParams({ category: "" });
                }}
              >
                Clear filters
              </button>
            </EmptyState>
          )}
        </div>
      </div>
    </AppShell>
  );
}
