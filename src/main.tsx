import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { StudentGate } from "@/components/campus/StudentGate";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import "./styles/campusmart.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const Browse = lazy(() => import("./pages/Browse.tsx"));
const ListingDetail = lazy(() => import("./pages/ListingDetail.tsx"));
const PostListing = lazy(() => import("./pages/PostListing.tsx"));
const MyListings = lazy(() => import("./pages/MyListings.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const StudentProfile = lazy(() => import("./pages/StudentProfile.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="cm-app">
      <div className="cm-shell">
        <div className="cm-loading" role="status">
          <i />
          Loading CampusMart
        </div>
      </div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="cm-app">
          <div className="cm-shell">
            <div className="cm-state">
              <p className="cm-eyebrow">
                CampusMart
                <span className="cm-eyebrow__rule" />
                Runtime error
              </p>
              <h1 className="cm-display cm-h3">
                Something broke while rendering this page
              </h1>
              <p className="cm-note">{this.state.message}</p>
              {this.state.stack && (
                <pre className="cm-prose" style={{ fontSize: 11, maxHeight: 220, overflow: "auto" }}>
                  {this.state.stack}
                </pre>
              )}
              <a href="/" className="cm-btn cm-btn--quiet">
                Reload CampusMart
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Public: the storefront, browsing and student profiles */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage redirectAfterAuth="/market" />} />
              <Route path="/market" element={<Browse kind="item" />} />
              <Route path="/services" element={<Browse kind="service" />} />
              <Route path="/listing/:id" element={<ListingDetail />} />
              <Route path="/students/:id" element={<StudentProfile />} />

              {/* Signed in, with a finished student profile */}
              <Route path="/welcome" element={<Welcome />} />
              <Route
                path="/post"
                element={
                  <StudentGate>
                    <PostListing mode="create" />
                  </StudentGate>
                }
              />
              <Route
                path="/listing/:id/edit"
                element={
                  <StudentGate>
                    <PostListing mode="edit" />
                  </StudentGate>
                }
              />
              <Route
                path="/my-listings"
                element={
                  <StudentGate>
                    <MyListings />
                  </StudentGate>
                }
              />
              <Route
                path="/messages"
                element={
                  <StudentGate>
                    <Messages />
                  </StudentGate>
                }
              />
              <Route
                path="/messages/:conversationId"
                element={
                  <StudentGate>
                    <Messages />
                  </StudentGate>
                }
              />
              <Route
                path="/profile"
                element={
                  <StudentGate>
                    <Profile />
                  </StudentGate>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
