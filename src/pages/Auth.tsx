import { AppShell } from "@/components/campus/AppShell";
import { Notice } from "@/components/campus/Bits";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCampusUser } from "@/hooks/use-campus-user";
import {
  CAMPUS_DOMAIN,
  CAMPUS_EMAIL_HINT,
  CAMPUS_NAME,
  CAMPUS_SHORT,
  isCampusEmail,
} from "@/lib/campus";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/market") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/** Convex wraps thrown errors in deployment noise; show the human sentence. */
function readableAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.toLowerCase().includes("ssipmt")) {
    return `CampusMart runs on @${CAMPUS_DOMAIN} addresses only. Use the email address the institute gave you.`;
  }
  // Delivery and configuration problems carry an actionable provider message,
  // so pass it through instead of burying it under the generic inbox line.
  if (raw.includes("could not email your code")) {
    return raw.slice(0, 300);
  }
  if (
    raw.toLowerCase().includes("invalid") ||
    raw.toLowerCase().includes("code") ||
    raw.toLowerCase().includes("expired")
  ) {
    return "That code did not match. Check the six digits and try again, or send a new code.";
  }
  return "Something went wrong on the way to your inbox. Try again in a moment.";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isAuthenticated, signIn } = useAuth();
  const { me } = useCampusUser();
  const navigate = useNavigate();
  const requestOtp = useAction(api.otp.request);
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the session lands, students without a profile finish setup first.
  useEffect(() => {
    if (!isAuthenticated || me === undefined) return;
    if (me && !me.profile) {
      navigate(`/welcome?returnTo=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }
    navigate(redirect, { replace: true });
  }, [isAuthenticated, me, navigate, redirect]);

  const sendCode = async (address: string) => {
    // Convex applies the campus-domain gate, cooldowns and caps; Better Auth
    // generates the code and Resend emails it. No session is created here.
    await requestOtp({ email: address });
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();

    if (!isCampusEmail(address)) {
      setError(
        `CampusMart is open to ${CAMPUS_SHORT} students only. Use your @${CAMPUS_DOMAIN} email address.`,
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await sendCode(address);
      setEmail(address);
      setStep("code");
    } catch (caught) {
      setError(readableAuthError(caught));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = new FormData();
      data.set("email", email);
      data.set("code", code.trim());
      await signIn("email-otp", data);
      // Routing happens in the effect above once the session is live.
    } catch (caught) {
      setError(readableAuthError(caught));
      setCode("");
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="cm-auth">
        <aside className="cm-auth__side">
          <div className="cm-stack" style={{ gap: 20 }}>
            <p className="cm-eyebrow">
              {CAMPUS_SHORT} student marketplace
              <span className="cm-eyebrow__rule" />
            </p>
            <h1 className="cm-display cm-h2">
              One account. One campus. No strangers.
            </h1>
            <p className="cm-lede">
              {CAMPUS_NAME} only accepts addresses issued by the institute, so
              every listing, service and message comes from a real{" "}
              {CAMPUS_SHORT} student.
            </p>
          </div>

          <ul className="cm-checklist">
            <li>
              <span className="cm-checklist__num">01</span>
              <span>
                Sign in with your @{CAMPUS_DOMAIN} email — new students get an
                account automatically.
              </span>
            </li>
            <li>
              <span className="cm-checklist__num">02</span>
              <span>
                Enter the six-digit code we email you. It is the whole
                verification step.
              </span>
            </li>
            <li>
              <span className="cm-checklist__num">03</span>
              <span>
                Add your name, branch and year so classmates know who they are
                dealing with.
              </span>
            </li>
            <li style={{ borderBottom: "none", paddingBottom: 0 }}>
              <span className="cm-checklist__num">04</span>
              <span>
                Post, message and trade. Your email address is never shown.
              </span>
            </li>
          </ul>

          <p className="cm-note">
            Run by one student, for one campus. No fees, no shipping, no
            middlemen.
          </p>
        </aside>

        <div className="cm-auth__form-wrap">
          <div className="cm-auth__form">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="cm-stack" style={{ gap: 20 }}>
                <div>
                  <p className="cm-eyebrow">
                    Step 1 of 2
                    <span className="cm-eyebrow__rule" />
                  </p>
                  <h2
                    className="cm-display cm-h3"
                    style={{ marginTop: 14, marginBottom: 10 }}
                  >
                    Sign in or register
                  </h2>
                  <p className="cm-note">
                    We email a six-digit code to your institute address. There
                    is no password to remember.
                  </p>
                </div>

                <label className="cm-field">
                  <span className="cm-label">Institutional email</span>
                  <input
                    className="cm-input"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                    }}
                    placeholder={CAMPUS_EMAIL_HINT}
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                  <span className="cm-field__hint">
                    Must end in @{CAMPUS_DOMAIN}. Nothing else gets through.
                  </span>
                </label>

                {error && <Notice tone="error">{error}</Notice>}

                <button
                  type="submit"
                  className="cm-btn cm-btn--accent cm-btn--block"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending your code…" : "Send me a code"}
                </button>

                <p className="cm-note">
                  By continuing you agree to keep deals on campus and to treat
                  other students the way you would want to be treated.
                </p>
              </form>
            ) : (
              <form onSubmit={handleCodeSubmit} className="cm-stack" style={{ gap: 20 }}>
                <div>
                  <p className="cm-eyebrow">
                    Step 2 of 2
                    <span className="cm-eyebrow__rule" />
                  </p>
                  <h2
                    className="cm-display cm-h3"
                    style={{ marginTop: 14, marginBottom: 10 }}
                  >
                    Check your inbox
                  </h2>
                  <p className="cm-note">
                    We emailed a six-digit code to{" "}
                    <strong style={{ color: "var(--cm-accent-strong)" }}>{email}</strong>.
                    It stays valid for a few minutes.
                  </p>
                </div>

                <label className="cm-field">
                  <span className="cm-label">Six-digit code</span>
                  <input
                    className="cm-otp-single"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setError(null);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="000000"
                    required
                  />
                </label>

                {error && <Notice tone="error">{error}</Notice>}

                <button
                  type="submit"
                  className="cm-btn cm-btn--accent cm-btn--block"
                  disabled={isLoading || code.length !== 6}
                >
                  {isLoading ? "Verifying…" : "Verify and continue"}
                </button>

                <div className="cm-actions">
                  <button
                    type="button"
                    className="cm-textlink"
                    disabled={isLoading}
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        await sendCode(email);
                      } catch (caught) {
                        setError(readableAuthError(caught));
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Send a new code
                  </button>
                  <button
                    type="button"
                    className="cm-textlink"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function AuthPage(props: AuthProps) {
  return <Auth {...props} />;
}
