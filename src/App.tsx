import { Home } from "./pages/Home";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-center" expand={false} richColors />
      <Home />
    </ErrorBoundary>
  );
}
