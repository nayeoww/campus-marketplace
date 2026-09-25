import { AppShell } from "@/components/campus/AppShell";
import { Initials, Loading, Notice, VerifiedBadge } from "@/components/campus/Bits";
import { RequireAuth } from "@/components/RequireAuth";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import { BRANCHES, CAMPUS_NAME, CAMPUS_SHORT, HOSTELS, YEARS } from "@/lib/campus";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

function ProfileForm({
  initial,
  isReturning,
}: {
  initial: {
    name: string;
    branch: string;
    year: string;
    hostel: string;
    bio: string;
  };
  isReturning: boolean;
}) {
  const saveProfile = useMutation(api.profiles.saveProfile);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/market";

  const [name, setName] = useState(initial.name);
  const [branch, setBranch] = useState(initial.branch);
  const [year, setYear] = useState(initial.year);
  const [hostel, setHostel] = useState(initial.hostel);
  const [bio, setBio] = useState(initial.bio);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await saveProfile({
        name,
        branch,
        year,
        hostel: hostel || undefined,
        bio: bio || undefined,
      });
      navigate(returnTo.startsWith("/") ? returnTo : "/market");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace(/^\[.*?\]\s*/, "")
          : "We could not save your profile. Try again.",
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="cm-composer">
      <form onSubmit={handleSubmit} className="cm-form-block">
        <div>
          <p className="cm-eyebrow">
            Student profile
            <span className="cm-eyebrow__rule" />
          </p>
          <h1 className="cm-display cm-h3" style={{ marginTop: 12 }}>
            {isReturning ? "Your student details" : "Set up your student card"}
          </h1>
          <p className="cm-note" style={{ marginTop: 8 }}>
            This is what classmates see on everything you post. Your email
            address is never shown to anyone.
          </p>
        </div>

        {isReturning && (
          <Notice tone="ok">
            Your account is already set up. Change anything that is out of date.
          </Notice>
        )}

        <div className="cm-form-grid">
          <label className="cm-field cm-form-grid--full">
            <span className="cm-label">Full name</span>
            <input
              className="cm-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nayan Verma"
              maxLength={60}
              required
            />
          </label>

          <label className="cm-field">
            <span className="cm-label">Branch</span>
            <span className="cm-select-wrap">
              <select
                className="cm-select"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                required
              >
                <option value="">Select your branch</option>
                {BRANCHES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="cm-field">
            <span className="cm-label">Year of study</span>
            <span className="cm-select-wrap">
              <select
                className="cm-select"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              >
                <option value="">Select your year</option>
                {YEARS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="cm-field">
            <span className="cm-label">Where you stay</span>
            <span className="cm-select-wrap">
              <select
                className="cm-select"
                value={hostel}
                onChange={(event) => setHostel(event.target.value)}
              >
                <option value="">Prefer not to say</option>
                {HOSTELS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="cm-field">
            <span className="cm-label">One line about you</span>
            <input
              className="cm-input"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Third year CSE. Sells calculators, fixes laptops."
              maxLength={280}
            />
          </label>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="cm-actions">
          <button
            type="submit"
            className="cm-btn cm-btn--accent"
            disabled={isSaving || !name.trim() || !branch || !year}
          >
            {isSaving ? "Saving…" : isReturning ? "Save changes" : "Save and continue"}
          </button>
          <Link to={returnTo.startsWith("/") ? returnTo : "/market"} className="cm-btn cm-btn--quiet">
            Skip for now
          </Link>
        </div>
      </form>

      <aside className="cm-preview">
        <p className="cm-preview__label">Preview — your listing byline</p>

        <div className="cm-seller">
          <div className="cm-seller__head">
            <Initials name={name || "CampusMart student"} />
            <div>
              <p className="cm-seller__name">
                {name.trim() || `New ${CAMPUS_SHORT} student`}
              </p>
              <p className="cm-seller__meta">
                {[year, branch].filter(Boolean).join(" · ") ||
                  "Branch and year pending"}
              </p>
            </div>
          </div>
          <div className="cm-seller__body">
            <div className="cm-actions" style={{ marginBottom: 12 }}>
              <VerifiedBadge verified campusAccount />
              {hostel && <span className="cm-badge">{hostel}</span>}
            </div>
            <p>{bio.trim() || "Add a line about yourself so buyers know it is you."}</p>
          </div>
        </div>

        <div className="cm-fact-list">
          <div className="cm-fact">
            <span>Shown publicly</span>
            <span className="cm-mono">Name, branch, year</span>
          </div>
          <div className="cm-fact">
            <span>Never shown</span>
            <span className="cm-mono">Email, phone</span>
          </div>
          <div className="cm-fact">
            <span>Where you trade</span>
            <span className="cm-mono">Anywhere on campus</span>
          </div>
        </div>

        <p className="cm-note">
          {CAMPUS_NAME} keeps contact inside messages until you decide to share
          more.
        </p>
      </aside>
    </div>
  );
}

export default function Welcome() {
  const { isLoading, me } = useCampusUser();

  if (isLoading || !me) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="cm-shell">
            <Loading label="Opening your profile" />
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  const fallbackName =
    me.name ??
    (me.email ? me.email.split("@")[0].replace(/[._-]+/g, " ") : "");

  return (
    <RequireAuth>
      <AppShell>
        <div className="cm-shell">
          <nav className="cm-crumbs" aria-label="Breadcrumb">
            <Link to="/market">Marketplace</Link>
            <span aria-hidden="true"> / </span>
            <span>Your profile</span>
          </nav>

          <ProfileForm
            key={me._id}
            isReturning={Boolean(me.profile)}
            initial={{
              name: fallbackName,
              branch: me.profile?.branch ?? "",
              year: me.profile?.year ?? "",
              hostel: me.profile?.hostel ?? "",
              bio: me.profile?.bio ?? "",
            }}
          />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
