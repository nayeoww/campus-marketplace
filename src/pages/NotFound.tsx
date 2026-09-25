import { AppShell } from "@/components/campus/AppShell";
import { CAMPUS_NAME } from "@/lib/campus";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <AppShell>
      <div className="cm-shell cm-gate">
        <div className="cm-stack" style={{ gap: 18 }}>
          <p className="cm-eyebrow">
            404
            <span className="cm-eyebrow__rule" />
            Nothing here
          </p>
          <h1 className="cm-display cm-h2">
            This page is not on the board
          </h1>
          <p className="cm-lede">
            The link you followed may be out of date, or the post it pointed to
            has already been sold and taken down.
          </p>
          <div className="cm-actions" style={{ marginTop: 6 }}>
            <Link to="/market" className="cm-btn cm-btn--accent">
              Back to the marketplace
            </Link>
            <Link to="/" className="cm-btn cm-btn--quiet">
              Go to the {CAMPUS_NAME} home page
            </Link>
          </div>
        </div>

        <aside className="cm-panel">
          <p className="cm-meta">Try one of these instead</p>
          <div className="cm-rail-group" style={{ marginTop: 12 }}>
            <Link to="/market" className="cm-rail-link">
              <span>Buy &amp; sell</span>
              <small>Items</small>
            </Link>
            <Link to="/services" className="cm-rail-link">
              <span>Services</span>
              <small>Skills</small>
            </Link>
            <Link to="/gigs" className="cm-rail-link">
              <span>Gigs</span>
              <small>Jobs</small>
            </Link>
            <Link to="/post" className="cm-rail-link">
              <span>Post something</span>
              <small>Free</small>
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
