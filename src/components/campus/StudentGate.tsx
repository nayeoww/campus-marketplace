import { AppShell } from "@/components/campus/AppShell";
import { Loading } from "@/components/campus/Bits";
import { RequireAuth } from "@/components/RequireAuth";
import { useCampusUser } from "@/hooks/use-campus-user";
import { CAMPUS_NAME, CAMPUS_SHORT } from "@/lib/campus";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Signed in is not enough on CampusMart — a student needs a branch and a year
 * before they can post, message or be shown as a verified seller. Browsing
 * stays open to everyone.
 */
export function StudentGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, profileComplete } = useCampusUser();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <AppShell>
        <div className="cm-shell">
          <Loading label="Opening your account" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return <RequireAuth>{null}</RequireAuth>;
  }

  if (!profileComplete) {
    const returnTo = `${location.pathname}${location.search}`;

    return (
      <AppShell>
        <div className="cm-shell cm-gate">
          <div className="cm-stack" style={{ gap: 18 }}>
            <p className="cm-eyebrow">
              One more step
              <span className="cm-eyebrow__rule" />
            </p>
            <h1 className="cm-display cm-h2">Finish your student profile</h1>
            <p className="cm-lede">
              {CAMPUS_NAME} shows your branch and year next to everything you
              post, so classmates know who they are dealing with. It takes about
              thirty seconds.
            </p>
            <div className="cm-actions" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="cm-btn cm-btn--accent"
                onClick={() =>
                  navigate(`/welcome?returnTo=${encodeURIComponent(returnTo)}`)
                }
              >
                Add my branch and year
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--quiet"
                onClick={() => navigate("/market")}
              >
                Back to the marketplace
              </button>
            </div>
          </div>

          <aside className="cm-panel">
            <p className="cm-mono">What everyone sees</p>
            <div className="cm-fact-list" style={{ marginTop: 12 }}>
              <div className="cm-fact">
                <span>Your name</span>
                <span className="cm-mono">Required</span>
              </div>
              <div className="cm-fact">
                <span>Branch and year</span>
                <span className="cm-mono">Required</span>
              </div>
              <div className="cm-fact">
                <span>Hostel or day scholar</span>
                <span className="cm-mono">Optional</span>
              </div>
              <div className="cm-fact">
                <span>Email address</span>
                <span className="cm-mono">Never shown</span>
              </div>
            </div>
            <p className="cm-note" style={{ marginTop: 14 }}>
              Only {CAMPUS_SHORT} students can reach this page, so your details
              never leave campus.
            </p>
          </aside>
        </div>
      </AppShell>
    );
  }

  return children;
}
