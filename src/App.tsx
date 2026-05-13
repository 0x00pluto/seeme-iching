import { useState } from "react";
import { Home } from "./pages/Home";
import { AuthCallback } from "./pages/AuthCallback";
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

export default function App() {
  const showAuthCallback = useMagicLinkRoute();

  return (
    <ErrorBoundary>
      <Toaster position="top-center" expand={false} richColors />
      {showAuthCallback ? <AuthCallback /> : <Home />}
    </ErrorBoundary>
  );
}
