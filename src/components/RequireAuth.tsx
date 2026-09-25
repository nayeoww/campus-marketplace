import { AppShell } from "@/components/campus/AppShell";
import { Loading } from "@/components/campus/Bits";
import { useAuth } from "@/hooks/use-auth";
import { CAMPUS_DOMAIN, CAMPUS_NAME, CAMPUS_SHORT } from "@/lib/campus";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/**
 * Wraps a route that requires a signed-in student.
 *
 * Signed-out visitors used to be bounced straight to `/auth`, which left them
 * on a bare sign-in form with no idea which page they had asked for or why they
 * were moved. The block is now stated on the page they landed on, and sign-in
 * still returns them to it via `returnTo`. Pass `redirectImmediately` for a
 * route where the bounce really is the better experience.
 */
export function RequireAuth({
  children,
  title = "Sign in to continue",
  description = `Listing, saving and messaging on ${CAMPUS_NAME} is limited to verified ${CAMPUS_SHORT} students.`,
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Headline on the blocked screen. */
  title?: string;
  /** Says what the visitor gets by signing in. */
  description?: string;
  /** Skip the explanation and go straight to `/auth`. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <AppShell>
        <div className="cm-shell">
          <Loading label="Checking your session" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <AppShell>
        <div className="cm-shell cm-gate">
          <div className="cm-stack" style={{ gap: 18 }}>
            <p className="cm-eyebrow">
              {CAMPUS_SHORT} students only
              <span className="cm-eyebrow__rule" />
            </p>
            <h1 className="cm-display cm-h2">{title}</h1>
            <p className="cm-lede">{description}</p>
            <p className="cm-note">
              Sign in with the email address issued by the institute
              (@{CAMPUS_DOMAIN}). You will come straight back to this page.
            </p>
            <div className="cm-actions" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="cm-btn cm-btn--accent"
                onClick={() => navigate(signInHref)}
              >
                Sign in with your {CAMPUS_SHORT} email
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => navigate("/market")}
              >
                Browse the marketplace instead
              </button>
            </div>
          </div>

          <aside className="cm-panel">
            <p className="cm-mono">Why signing in is required</p>
            <div className="cm-fact-list" style={{ marginTop: 12 }}>
              <div className="cm-fact">
                <span>Verified {CAMPUS_SHORT} students only</span>
                <span className="cm-mono">01</span>
              </div>
              <div className="cm-fact">
                <span>No phone numbers shown publicly</span>
                <span className="cm-mono">02</span>
              </div>
              <div className="cm-fact">
                <span>Deals happen on campus, in person</span>
                <span className="cm-mono">03</span>
              </div>
            </div>
          </aside>
        </div>
      </AppShell>
    );
  }

  return children;
}
