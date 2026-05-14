import { useState } from "react";
import { Home } from "./pages/Home";
import { AuthCallback } from "./pages/AuthCallback";
import { SharedReportView } from "./pages/SharedReportView";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";

function useMagicLinkRoute(): boolean {
  const [flag] = useState(() => {
    if (typeof window === "undefined") return false;
    const p = window.location.pathname;
    const h = window.location.hash;
    return p === "/auth/callback" || (p === "/" && h.includes("access_token"));
  });
  return flag;
}

function parseShareTokenFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  const raw = m?.[1];
  return raw ? decodeURIComponent(raw) : null;
}

function useShareRouteToken(): string | null {
  const [token] = useState(parseShareTokenFromPath);
  return token;
}

export default function App() {
  const showAuthCallback = useMagicLinkRoute();
  const shareToken = useShareRouteToken();

  if (showAuthCallback) {
    return (
      <ErrorBoundary>
        <Toaster position="top-center" expand={false} richColors />
        <AuthCallback />
      </ErrorBoundary>
    );
  }

  if (shareToken) {
    return (
      <ErrorBoundary>
        <Toaster position="top-center" expand={false} richColors />
        <SharedReportView token={shareToken} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-center" expand={false} richColors />
      <Home />
    </ErrorBoundary>
  );
}
