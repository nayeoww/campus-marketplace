import { Initials } from "@/components/campus/Bits";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { CAMPUS_DOMAIN, CAMPUS_NAME, CAMPUS_SHORT } from "@/lib/campus";
import { useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";

type NavItem = {
  to: string;
  label: string;
  gated?: boolean;
  badge?: boolean;
};

const NAV: NavItem[] = [
  { to: "/market", label: "Marketplace" },
  { to: "/services", label: "Services" },
  { to: "/gigs", label: "Gigs" },
  { to: "/my-listings", label: "My listings", gated: true },
  { to: "/messages", label: "Messages", gated: true, badge: true },
  { to: "/profile", label: "Profile", gated: true },
];

function hrefFor(item: NavItem, signedIn: boolean) {
  if (!item.gated || signedIn) return item.to;
  return `/auth?returnTo=${encodeURIComponent(item.to)}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const me = useQuery(api.profiles.me);
  const unread = useQuery(api.messaging.unreadTotal);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="cm-app">
      <header className="cm-header">
        <div className="cm-shell">
          <div className="cm-header__inner">
            <Link to="/" className="cm-brand">
              <span className="cm-brand__mark">{CAMPUS_NAME}</span>
              <span className="cm-brand__campus">
                {CAMPUS_SHORT}
                <br />
                marketplace
              </span>
            </Link>

            <nav className="cm-nav" aria-label="Primary">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={hrefFor(item, isAuthenticated)}
                  className="cm-nav__link"
                  data-active={isActive(item.to)}
                >
                  {item.label}
                  {item.badge && !!unread && (
                    <span className="cm-nav__count">{unread}</span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="cm-header__actions">
              {isAuthenticated ? (
                <>
                  <Link to="/post" className="cm-btn cm-btn--accent cm-btn--sm">
                    Post something
                  </Link>
                  <Link to="/profile" className="cm-account">
                    <Initials name={me?.name} small />
                    <span className="cm-account__text">
                      <span className="cm-account__name">
                        {me?.name ?? "Your profile"}
                      </span>
                      <span className="cm-account__meta">
                        {me?.profile
                          ? `${me.profile.year} · ${me.profile.branch.split(" ")[0]}`
                          : "Finish setup"}
                      </span>
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth" className="cm-btn cm-btn--quiet cm-btn--sm">
                    Sign in
                  </Link>
                  <Link
                    to="/auth?returnTo=%2Fpost"
                    className="cm-btn cm-btn--accent cm-btn--sm"
                  >
                    Post something
                  </Link>
                </>
              )}

              <button
                type="button"
                className="cm-menu-toggle"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>

          <nav
            className="cm-mobile-nav"
            data-open={menuOpen}
            aria-label="Primary mobile"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={hrefFor(item, isAuthenticated)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
                {item.badge && !!unread && (
                  <span className="cm-nav__count">{unread}</span>
                )}
              </Link>
            ))}
            {isAuthenticated ? (
              <button
                type="button"
                className="cm-btn cm-btn--quiet cm-btn--sm"
                style={{ marginTop: 14, alignSelf: "flex-start" }}
                onClick={handleSignOut}
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                onClick={() => setMenuOpen(false)}
                style={{ marginTop: 14 }}
              >
                Sign in / register
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="cm-main">{children}</main>

      <footer className="cm-footer">
        <div className="cm-shell">
          <div className="cm-footer__grid">
            <div className="cm-footer__col">
              <span className="cm-brand__mark">{CAMPUS_NAME}</span>
              <p>
                The student marketplace for {CAMPUS_SHORT}. Buy and sell what
                you have finished with, offer the skills you already have, and
                hand small jobs to the next hostel block.
              </p>
              <p className="cm-note">
                Built and run by one student. Accounts are limited to
                @{CAMPUS_DOMAIN} email addresses.
              </p>
            </div>

            <div className="cm-footer__col">
              <span className="cm-footer__title">Marketplace</span>
              <Link to="/market" className="cm-link">
                Buy &amp; sell
              </Link>
              <Link to="/services" className="cm-link">
                Services
              </Link>
              <Link to="/gigs" className="cm-link">
                Gigs
              </Link>
            </div>

            <div className="cm-footer__col">
              <span className="cm-footer__title">Your account</span>
              <Link to="/post" className="cm-link">
                Post something
              </Link>
              <Link to="/my-listings" className="cm-link">
                My listings
              </Link>
              <Link to="/messages" className="cm-link">
                Messages
              </Link>
              <Link to="/profile" className="cm-link">
                Profile
              </Link>
            </div>

            <div className="cm-footer__col">
              <span className="cm-footer__title">Campus rules</span>
              <span>Verified {CAMPUS_SHORT} students only</span>
              <span>Meet on campus, check before you pay</span>
              <span>Report anything that looks off</span>
            </div>
          </div>

          <div className="cm-footer__base">
            <span>
              © {new Date().getFullYear()} {CAMPUS_NAME}
            </span>
            <span>One campus · No fees · No shipping</span>
            <span>Not affiliated with the institute administration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
